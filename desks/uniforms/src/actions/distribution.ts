"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { makeRef } from "@/lib/refs";
import { applyMove, campusStore, StockError } from "@/lib/stock";
import { fail } from "@/lib/form";
import { writeAudit } from "@/lib/audit";

type DistLine = { skuId: string; size: string; qty: number };

async function postDistribution(input: {
  fromId: string;
  toCampusId: string;
  requestId: string | null;
  receiver: string;
  issuerId: string;
  issuerName: string;
  lines: DistLine[];
}) {
  const from = await prisma.location.findUnique({ where: { id: input.fromId } });
  if (!from || (from.kind !== "WAREHOUSE" && from.kind !== "SHOP")) {
    await fail("Distribution must leave MAIN or the shop — not a campus store.");
  }
  if (!input.lines.length) await fail("Add at least one line.");

  let dest;
  try {
    dest = await campusStore(input.toCampusId);
  } catch {
    return fail("Campus store not found.");
  }

  const ref = makeRef("DN");
  try {
    await prisma.$transaction(async (tx) => {
      const dn = await tx.distribution.create({
        data: {
          ref,
          requestId: input.requestId,
          fromId: input.fromId,
          toCampusId: input.toCampusId,
          issuerId: input.issuerId,
          receiver: input.receiver,
          lines: { create: input.lines },
        },
      });
      for (const line of input.lines) {
        await applyMove(tx, {
          locationId: input.fromId,
          skuId: line.skuId,
          size: line.size,
          qty: -line.qty,
          reason: "DISTRIBUTE",
          ref: dn.ref,
          note: `to campus · ${input.receiver}`,
        });
        await applyMove(tx, {
          locationId: dest.id,
          skuId: line.skuId,
          size: line.size,
          qty: line.qty,
          reason: "DISTRIBUTE",
          ref: dn.ref,
          note: "incoming DN",
        });
      }
      if (input.requestId) {
        // Re-check freshness inside the transaction — without this, a stale
        // resubmit or a crafted requestId could flip an already-cancelled or
        // already-fulfilled request back to FULFILLED and post a duplicate
        // DN. Failing here rolls back the DN and both stock moves too.
        const fresh = await tx.campusRequest.findUnique({ where: { id: input.requestId } });
        if (!fresh) throw new StockError("That request no longer exists.");
        if (fresh.status !== "OPEN") {
          throw new StockError(`That request is already ${fresh.status} — refresh the page.`);
        }
        await tx.campusRequest.update({
          where: { id: input.requestId },
          data: { status: "FULFILLED" },
        });
      }
    });
  } catch (err) {
    await fail(err instanceof StockError ? err.message : "Distribution failed.");
  }

  await writeAudit({
    actorId: input.issuerId,
    actorName: input.issuerName,
    action: "DISTRIBUTE",
    entity: "Distribution",
    ref,
    note: input.receiver,
  });
  revalidatePath("/distribution");
  revalidatePath("/requests");
  revalidatePath("/stock");
  revalidatePath("/desk");
  revalidatePath("/audit");
}

export async function createDistribution(formData: FormData) {
  const user = await requireUser(["STORE"]);
  const fromId = String(formData.get("fromId") ?? "");
  const toCampusId = String(formData.get("toCampusId") ?? "");
  const requestId = String(formData.get("requestId") ?? "") || null;
  const receiver = String(formData.get("receiver") ?? "").trim();
  if (!fromId || !toCampusId) await fail("From location and campus are required.");

  const skuIds = formData.getAll("skuId").map(String);
  const sizes = formData.getAll("size").map(String);
  const qtys = formData.getAll("qty").map((v) => Number.parseInt(String(v), 10));
  const lines = skuIds
    .map((skuId, i) => ({ skuId, size: sizes[i] ?? "", qty: qtys[i] ?? 0 }))
    .filter((l) => l.skuId && l.size && l.qty > 0);

  await postDistribution({
    fromId,
    toCampusId,
    requestId,
    receiver,
    issuerId: user.id,
    issuerName: user.name,
    lines,
  });
}

export async function fulfillRequest(formData: FormData) {
  const user = await requireUser(["STORE"]);
  const requestId = String(formData.get("requestId") ?? "");
  const fromCode = String(formData.get("fromCode") ?? "MAIN");
  if (!requestId) await fail("Request is required.");

  const [request, from] = await Promise.all([
    prisma.campusRequest.findUnique({
      where: { id: requestId },
      include: { lines: true },
    }),
    prisma.location.findUnique({ where: { code: fromCode } }),
  ]);
  if (!request || request.status !== "OPEN") await fail("That request is not open.");
  if (!from) await fail("Warehouse not found.");

  await postDistribution({
    fromId: from!.id,
    toCampusId: request!.campusId,
    requestId: request!.id,
    receiver: String(formData.get("receiver") ?? "").trim(),
    issuerId: user.id,
    issuerName: user.name,
    lines: request!.lines.map((l) => ({ skuId: l.skuId, size: l.size, qty: l.qty })),
  });
}

export async function voidDistribution(formData: FormData) {
  const user = await requireUser(["STORE"]);
  const distributionId = String(formData.get("distributionId") ?? "");
  const dn = await prisma.distribution.findUnique({
    where: { id: distributionId },
    include: { lines: true, from: true },
  });
  if (!dn) return fail("Delivery note not found.");

  let dest: Awaited<ReturnType<typeof campusStore>>;
  try {
    dest = await campusStore(dn.toCampusId);
  } catch {
    return fail("Campus store not found.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const line of dn.lines) {
        await applyMove(tx, {
          locationId: dest.id,
          skuId: line.skuId,
          size: line.size,
          qty: -line.qty,
          reason: "ADJUST",
          ref: dn.ref,
          note: `Undo DN · ${user.name}`,
        });
        await applyMove(tx, {
          locationId: dn.fromId,
          skuId: line.skuId,
          size: line.size,
          qty: line.qty,
          reason: "ADJUST",
          ref: dn.ref,
          note: `Undo DN · return to ${dn.from.code}`,
        });
      }
      if (dn.requestId) {
        await tx.campusRequest.update({
          where: { id: dn.requestId },
          data: { status: "OPEN" },
        });
      }
      await tx.distribution.delete({ where: { id: distributionId } });
    });
  } catch (err) {
    await fail(err instanceof StockError ? err.message : "Undo failed — campus may have issued stock already.");
  }

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UNDO",
    entity: "Distribution",
    entityId: distributionId,
    ref: dn.ref,
    note: dn.requestId ? "Request reopened" : "Ad-hoc DN undone",
  });
  revalidatePath("/distribution");
  revalidatePath("/requests");
  revalidatePath("/stock");
  revalidatePath("/desk");
  revalidatePath("/audit");
}
