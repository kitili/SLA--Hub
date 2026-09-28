"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { makeRef } from "@/lib/refs";
import { parseTzs } from "@/lib/money";
import { fail } from "@/lib/form";
import { writeAudit } from "@/lib/audit";

function matLinesFrom(formData: FormData) {
  const kinds = formData.getAll("kind").map(String);
  const materialKinds = formData.getAll("materialKind").map(String);
  const descriptions = formData.getAll("description").map(String);
  const qtys = formData.getAll("qty").map((v) => Number.parseInt(String(v), 10));
  const units = formData.getAll("unit").map(String);
  const costs = formData.getAll("unitCostTzs").map((v) => parseTzs(v));
  const payeeIds = formData.getAll("payeeId").map(String);
  return kinds
    .map((kind, i) => ({
      kind,
      materialKind: materialKinds[i] || "FABRIC",
      description: (descriptions[i] ?? "").trim(),
      qty: qtys[i] || 0,
      unit: units[i] || "pcs",
      unitCostTzs: costs[i] || 0,
      payeeId: payeeIds[i] || "",
    }))
    .filter((l) => l.description && l.qty > 0);
}

export async function requestMaterials(formData: FormData) {
  const user = await requireUser(["TAILOR"]);
  const sewingJobId = String(formData.get("sewingJobId") ?? "");
  if (!sewingJobId) await fail("Pick which job this is for.");
  const lines = matLinesFrom(formData);
  if (!lines.length) await fail("Add at least one line.");
  // Labour is money Loveness already knows the real rate for (she negotiates
  // with her own casual tailors) — no reason to let that go through as a
  // placeholder. Materials genuinely need Imani's supplier call first, so
  // those are allowed to start at 0.
  const badLabour = lines.find((l) => l.kind === "LABOUR" && l.unitCostTzs <= 0);
  if (badLabour) await fail(`Enter the real rate for "${badLabour.description}" before submitting.`);

  const request = await prisma.materialRequest.create({
    data: {
      ref: makeRef("MREQ"),
      sewingJobId,
      requestedById: user.id,
      status: "PENDING_STORE",
      lines: {
        create: lines.map((l) => ({
          kind: l.kind,
          materialKind: l.materialKind,
          description: l.description,
          qty: l.qty,
          unit: l.unit,
          unitCostTzs: l.unitCostTzs,
          payeeId: l.kind === "LABOUR" && l.payeeId ? l.payeeId : null,
        })),
      },
    },
  });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "CREATE",
    entity: "MaterialRequest",
    entityId: request.id,
    ref: request.ref,
    note: `${lines.length} lines`,
  });
  revalidatePath("/sewing");
  revalidatePath("/slm");
  revalidatePath("/audit");
}

export async function cancelMaterialRequest(formData: FormData) {
  const user = await requireUser(["TAILOR", "STORE"]);
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const request = await prisma.materialRequest.findUnique({ where: { id: requestId } });
  if (!request) await fail("Request not found.");
  // Matches what the UI already only offers to: Store (network-wide) or the
  // tailor who actually submitted it — not just any tailor.
  if (user.role !== "STORE" && user.id !== request.requestedById) {
    await fail("You can only cancel your own request.");
  }
  if (!["PENDING_STORE", "PENDING_FINANCE"].includes(request.status)) {
    await fail(`${request.ref} is ${request.status} — only requests still awaiting review can be cancelled.`);
  }
  if (!reason) await fail("Say why this is being cancelled.");
  await prisma.materialRequest.update({ where: { id: requestId }, data: { status: "CANCELLED" } });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "CANCEL",
    entity: "MaterialRequest",
    entityId: request.id,
    ref: request.ref,
    note: reason,
  });
  revalidatePath("/sewing");
  revalidatePath("/slm");
  revalidatePath("/finance");
  revalidatePath("/audit");
}

export async function priceAndForward(formData: FormData) {
  const user = await requireUser(["STORE"]);
  const requestId = String(formData.get("requestId") ?? "");
  const request = await prisma.materialRequest.findUnique({
    where: { id: requestId },
    include: { lines: true },
  });
  if (!request) await fail("Request not found.");
  if (request.status !== "PENDING_STORE") {
    await fail(`${request.ref} is ${request.status} — only requests awaiting Store can be priced.`);
  }

  for (const line of request.lines) {
    if (line.kind !== "MATERIAL") continue;
    const raw = formData.get(`unitCostTzs_${line.id}`);
    const unitCostTzs = raw != null ? parseTzs(raw) : line.unitCostTzs;
    await prisma.materialRequestLine.update({ where: { id: line.id }, data: { unitCostTzs } });
  }

  const stillUnpriced = await prisma.materialRequestLine.findFirst({
    where: { requestId, unitCostTzs: { lte: 0 } },
  });
  if (stillUnpriced) {
    await fail(`"${stillUnpriced.description}" still has no real price — call the supplier before forwarding.`);
  }

  await prisma.materialRequest.update({
    where: { id: requestId },
    data: { status: "PENDING_FINANCE", pricedById: user.id, pricedAt: new Date() },
  });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "FORWARD",
    entity: "MaterialRequest",
    entityId: request.id,
    ref: request.ref,
    note: "Priced and forwarded to Finance",
  });
  revalidatePath("/sewing");
  revalidatePath("/slm");
  revalidatePath("/finance");
  revalidatePath("/audit");
}

async function requirePendingFinance(requestId: string) {
  const request = await prisma.materialRequest.findUnique({ where: { id: requestId }, include: { lines: true } });
  if (!request) await fail("Request not found.");
  if (request.status !== "PENDING_FINANCE") {
    await fail(`${request.ref} is ${request.status} — only requests awaiting Finance can be resolved.`);
  }
  return request;
}

export async function approveMaterialRequest(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const requestId = String(formData.get("requestId") ?? "");
  const request = await requirePendingFinance(requestId);

  await prisma.materialRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", resolvedById: user.id, resolvedAt: new Date() },
  });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "APPROVE",
    entity: "MaterialRequest",
    entityId: request.id,
    ref: request.ref,
  });
  revalidatePath("/finance");
  revalidatePath("/sewing");
  revalidatePath("/slm");
  revalidatePath("/audit");
}

export async function rejectMaterialRequest(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const requestId = String(formData.get("requestId") ?? "");
  const request = await requirePendingFinance(requestId);

  await prisma.materialRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", resolvedById: user.id, resolvedAt: new Date() },
  });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "REJECT",
    entity: "MaterialRequest",
    entityId: request.id,
    ref: request.ref,
  });
  revalidatePath("/finance");
  revalidatePath("/sewing");
  revalidatePath("/slm");
  revalidatePath("/audit");
}

// Posts the real MaterialBatch/Expense rows using the already Finance-approved
// figures — no re-typing, and no separate "actual cost" field, since by this
// point the price is a real supplier quote (or Loveness's own known labour
// rate), not an estimate that could drift.
export async function fulfillMaterialRequest(formData: FormData) {
  const user = await requireUser(["STORE"]);
  const requestId = String(formData.get("requestId") ?? "");
  const request = await prisma.materialRequest.findUnique({
    where: { id: requestId },
    include: { lines: true },
  });
  if (!request) await fail("Request not found.");
  if (request.status !== "APPROVED") {
    await fail(`${request.ref} is ${request.status} — only APPROVED requests can be marked bought.`);
  }

  await prisma.$transaction(async (tx) => {
    for (const line of request.lines) {
      if (line.kind === "MATERIAL") {
        const storedQty = line.unit === "m" ? line.qty * 100 : line.qty;
        const storedUnit = line.unit === "m" ? "cm" : line.unit;
        const storedCost = line.unit === "m" ? Math.round(line.unitCostTzs / 100) : line.unitCostTzs;
        const batch = await tx.materialBatch.create({
          data: {
            kind: line.materialKind,
            description: line.description,
            qty: storedQty,
            remaining: storedQty,
            unit: storedUnit,
            unitCostTzs: storedCost,
            sewingJobId: request.sewingJobId,
          },
        });
        await tx.expense.create({
          data: {
            kind: "MATERIAL",
            amountTzs: line.qty * line.unitCostTzs,
            note: `${line.description} · ${line.qty} ${line.unit}`,
            sewingJobId: request.sewingJobId,
            materialId: batch.id,
          },
        });
      } else {
        await tx.expense.create({
          data: {
            kind: "LABOUR",
            amountTzs: line.qty * line.unitCostTzs,
            note: line.description,
            sewingJobId: request.sewingJobId,
            payeeId: line.payeeId,
          },
        });
      }
    }
    await tx.materialRequest.update({
      where: { id: requestId },
      data: { status: "FULFILLED", fulfilledById: user.id, fulfilledAt: new Date() },
    });
  });

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "FULFILL",
    entity: "MaterialRequest",
    entityId: request.id,
    ref: request.ref,
    note: "Bought and posted",
  });
  revalidatePath("/sewing");
  revalidatePath("/slm");
  revalidatePath("/finance");
  revalidatePath("/audit");
}
