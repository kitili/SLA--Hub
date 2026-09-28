"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { canActForCampus, canRequestForCampus } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { makeRef } from "@/lib/refs";
import { fail, succeed } from "@/lib/form";
import { writeAudit } from "@/lib/audit";

function linesFrom(formData: FormData) {
  const skuIds = formData.getAll("skuId").map(String);
  const sizes = formData.getAll("size").map(String);
  const qtys = formData.getAll("qty").map((v) => Number.parseInt(String(v), 10));
  return skuIds
    .map((skuId, i) => ({ skuId, size: sizes[i] ?? "", qty: qtys[i] ?? 0 }))
    .filter((l) => l.skuId && l.size && l.qty > 0);
}

async function requireOpenRequest(requestId: string) {
  const user = await requireUser(["ADMIN", "HEAD_TEACHER"]);
  const request = await prisma.campusRequest.findUnique({
    where: { id: requestId },
    include: { lines: true, campus: true },
  });
  if (!request) return fail("Request not found.");
  if (user.campusId) {
    if (request.campusId !== user.campusId) await fail("Not your campus.");
    if (!user.campusCode || !canRequestForCampus(user.role, user.campusCode)) {
      await fail("Your role cannot change requests for this campus.");
    }
  } else if (!canActForCampus(user, request.campus.code)) {
    await fail("Your role cannot change requests for this campus.");
  }
  if (request.status !== "OPEN") {
    await fail(`${request.ref} is ${request.status} — only OPEN requests can be changed.`);
  }
  return { user, request };
}

export async function createCampusRequest(formData: FormData) {
  const user = await requireUser(["ADMIN", "HEAD_TEACHER"]);
  let campusId = user.campusId;
  if (campusId) {
    if (!user.campusCode || !canRequestForCampus(user.role, user.campusCode)) {
      await fail("Your role cannot request stock for this campus.");
    }
  } else {
    campusId = String(formData.get("campusId") ?? "");
    const campus = await prisma.campus.findUnique({ where: { id: campusId } });
    if (!campus || !canActForCampus(user, campus.code)) {
      return fail("Pick a school.");
    }
  }

  const lines = linesFrom(formData);
  if (!lines.length) await fail("Add at least one line.");

  const request = await prisma.campusRequest.create({
    data: {
      ref: makeRef("REQ"),
      campusId,
      requesterId: user.id,
      status: "OPEN",
      neededBy: String(formData.get("neededBy") ?? ""),
      note: String(formData.get("note") ?? "").trim(),
      lines: { create: lines },
    },
  });

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "CREATE",
    entity: "CampusRequest",
    entityId: request.id,
    ref: request.ref,
    note: `${lines.length} lines`,
  });
  revalidatePath("/requests");
  revalidatePath("/distribution");
  revalidatePath("/desk");
  revalidatePath("/audit");
  revalidatePath("/alerts");
  await succeed(`${request.ref} sent to Imani.`);
}

export async function cancelCampusRequest(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const { user, request } = await requireOpenRequest(requestId);

  // Re-check freshness inside a transaction, same as updateCampusRequest —
  // without this, a cancel racing a fulfillRequest/createDistribution could
  // stomp an already-FULFILLED status back to CANCELLED with no revalidation.
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.campusRequest.findUnique({ where: { id: requestId } });
    if (!fresh || fresh.status !== "OPEN") {
      await fail(`${request.ref} is no longer open.`);
    }
    await tx.campusRequest.update({ where: { id: requestId }, data: { status: "CANCELLED" } });
  });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "CANCEL",
    entity: "CampusRequest",
    entityId: request.id,
    ref: request.ref,
    note: request.campus.name,
  });
  revalidatePath("/requests");
  revalidatePath("/distribution");
  revalidatePath("/desk");
  revalidatePath("/audit");
}

export async function updateCampusRequest(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const lines = linesFrom(formData);
  if (!lines.length) await fail("Add at least one line.");
  const { user, request } = await requireOpenRequest(requestId);

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.campusRequest.findUnique({ where: { id: requestId } });
    if (!fresh || fresh.status !== "OPEN") {
      await fail(`${request.ref} is no longer open.`);
    }
    await tx.campusRequestLine.deleteMany({ where: { requestId } });
    await tx.campusRequestLine.createMany({
      data: lines.map((line) => ({ requestId, ...line })),
    });
  });

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPDATE",
    entity: "CampusRequest",
    entityId: request.id,
    ref: request.ref,
    note: `Lines updated · ${lines.length} items`,
  });
  revalidatePath("/requests");
  revalidatePath("/distribution");
  revalidatePath("/desk");
  revalidatePath("/audit");
}
