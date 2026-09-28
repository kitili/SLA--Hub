"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { makeRef } from "@/lib/refs";
import { applyMove, locationByCode, StockError } from "@/lib/stock";
import { parseTzs } from "@/lib/money";
import { fail } from "@/lib/form";
import { writeAudit } from "@/lib/audit";
import { loadOverallPlan } from "@/lib/overall-plan";
import { collapsePlanLines } from "@/lib/sheet-math";

function linesFrom(formData: FormData) {
  const skuIds = formData.getAll("skuId").map(String);
  const sizes = formData.getAll("size").map(String);
  const qtys = formData.getAll("qty").map((v) => Number.parseInt(String(v), 10));
  const costs = formData.getAll("unitTzs").map((v) => parseTzs(v));
  return skuIds
    .map((skuId, i) => ({
      skuId,
      size: sizes[i] ?? "",
      qty: qtys[i] ?? 0,
      unitTzs: costs[i] ?? 0,
    }))
    .filter((l) => l.skuId && l.size && l.qty > 0);
}

async function requireDraftPo(poId: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { lines: true },
  });
  if (!po) return fail("PO not found.");
  if (po.status !== "DRAFT") {
    await fail(`${po.ref} is ${po.status} — only DRAFT POs can be changed.`);
  }
  if (po.lines.some((l) => l.received > 0)) {
    await fail(`${po.ref} already has receipts — cannot change lines.`);
  }
  return po;
}

export async function createPurchaseOrder(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const supplierId = String(formData.get("supplierId") ?? "");
  const lines = linesFrom(formData);
  if (!supplierId || !lines.length) await fail("Supplier and lines required.");

  await prisma.purchaseOrder.create({
    data: {
      ref: makeRef("PO"),
      supplierId,
      raisedById: user.id,
      status: "DRAFT",
      lines: { create: lines },
    },
  });
  revalidatePath("/purchase-orders");
}

export async function draftPoFromPlan(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const supplierId = String(formData.get("supplierId") ?? "");
  const year = Number.parseInt(String(formData.get("year") ?? "2027"), 10);
  if (!supplierId) await fail("Pick a supplier.");
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) await fail("Supplier not found.");

  const lines = collapsePlanLines(await loadOverallPlan(year));
  if (!lines.length) await fail("Nothing to buy — MAIN and campus stock cover the pack.");

  const ref = `PO-PLAN-${year}`;
  const existing = await prisma.purchaseOrder.findUnique({
    where: { ref },
    include: { lines: true },
  });
  if (existing && !["DRAFT", "CANCELLED"].includes(existing.status)) {
    await fail(`${ref} is already ${existing.status}. Receive it or raise a new PO by hand.`);
  }

  const po = existing
    ? await prisma.$transaction(async (tx) => {
        await tx.purchaseOrderLine.deleteMany({ where: { poId: existing.id } });
        return tx.purchaseOrder.update({
          where: { id: existing.id },
          data: {
            supplierId,
            raisedById: user.id,
            status: "DRAFT",
            lines: { create: lines.map((l) => ({ skuId: l.skuId, size: l.size, qty: l.qty, unitTzs: l.unitTzs })) },
          },
        });
      })
    : await prisma.purchaseOrder.create({
        data: {
          ref,
          supplierId,
          raisedById: user.id,
          status: "DRAFT",
          lines: { create: lines.map((l) => ({ skuId: l.skuId, size: l.size, qty: l.qty, unitTzs: l.unitTzs })) },
        },
      });

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: existing ? "UPDATE" : "CREATE",
    entity: "PurchaseOrder",
    entityId: po.id,
    ref: po.ref,
    note: `OVERALL ${year} buy plan · ${lines.length} lines`,
  });
  revalidatePath("/purchase-orders");
  revalidatePath("/sizes");
  revalidatePath("/finance");
  revalidatePath("/audit");
  redirect("/purchase-orders");
}

export async function approvePurchaseOrder(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const id = String(formData.get("poId") ?? "");
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) await fail("PO not found.");
  if (po.approveStatus !== "PENDING") await fail(`${po.ref}'s approval is already ${po.approveStatus}.`);

  await prisma.purchaseOrder.update({
    where: { id },
    data: { approveStatus: "APPROVED", approvedById: user.id, approvedAt: new Date() },
  });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "APPROVE",
    entity: "PurchaseOrder",
    entityId: po.id,
    ref: po.ref,
  });
  revalidatePath("/purchase-orders");
  revalidatePath("/finance");
  revalidatePath("/audit");
}

export async function rejectPurchaseOrder(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const id = String(formData.get("poId") ?? "");
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) await fail("PO not found.");
  if (po.approveStatus !== "PENDING") await fail(`${po.ref}'s approval is already ${po.approveStatus}.`);

  await prisma.purchaseOrder.update({
    where: { id },
    data: { approveStatus: "REJECTED", approvedById: user.id, approvedAt: new Date() },
  });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "REJECT",
    entity: "PurchaseOrder",
    entityId: po.id,
    ref: po.ref,
  });
  revalidatePath("/purchase-orders");
  revalidatePath("/finance");
  revalidatePath("/audit");
}

export async function sendPurchaseOrder(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const id = String(formData.get("poId") ?? "");
  const po = await requireDraftPo(id);
  if (po.approveStatus !== "APPROVED") {
    await fail(`${po.ref} needs Finance approval before it can be sent to a supplier.`);
  }
  await prisma.purchaseOrder.update({ where: { id }, data: { status: "SENT" } });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPDATE",
    entity: "PurchaseOrder",
    entityId: po.id,
    ref: po.ref,
    note: "Marked sent to supplier",
  });
  revalidatePath("/purchase-orders");
  revalidatePath("/finance");
  revalidatePath("/audit");
}

export async function receivePurchaseOrder(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const poId = String(formData.get("poId") ?? "");
  const target = String(formData.get("locationCode") ?? "MAIN");
  if (target !== "MAIN") {
    await fail("Goods receipt can only land in MAIN warehouse.");
  }
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { lines: true, supplier: true },
  });
  if (!po) return fail("PO not found.");
  // A PO can only have real goods to receive once it's actually gone to a
  // supplier — DRAFT means it's never been sent, and sendPurchaseOrder is
  // where Finance approval is enforced. Without this, receiving straight off
  // a DRAFT would move real stock and post a real expense with zero
  // approval, defeating the whole gate.
  if (po.status === "DRAFT") {
    await fail(`${po.ref} hasn't been sent to the supplier yet — nothing to receive.`);
  }

  const lineIds = formData.getAll("lineId").map(String);
  const qtys = formData.getAll("receiveQty").map((v) => Number.parseInt(String(v), 10));
  const main = await locationByCode("MAIN");

  try {
    await prisma.$transaction(async (tx) => {
      let receivedValue = 0;
      for (const line of po.lines) {
        const idx = lineIds.indexOf(line.id);
        const qty = idx >= 0 ? Math.max(0, qtys[idx] || 0) : 0;
        const remaining = line.qty - line.received;
        const take = Math.min(qty, remaining);
        if (take <= 0) continue;
        await applyMove(tx, {
          locationId: main.id,
          skuId: line.skuId,
          size: line.size,
          qty: take,
          reason: "RECEIVE",
          ref: po.ref,
          note: `${po.supplier.name} · ${user.name}`,
        });
        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: { received: line.received + take },
        });
        receivedValue += take * line.unitTzs;
      }
      if (receivedValue > 0) {
        await tx.expense.create({
          data: {
            kind: "SUPPLIER",
            amountTzs: receivedValue,
            note: `Receive ${po.ref}`,
            poId: po.id,
          },
        });
      }
      const fresh = await tx.purchaseOrderLine.findMany({ where: { poId } });
      const allIn = fresh.every((l) => l.received >= l.qty);
      const anyIn = fresh.some((l) => l.received > 0);
      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: allIn ? "CLOSED" : anyIn ? "PARTIAL" : po.status === "DRAFT" ? "SENT" : po.status },
      });
    });
  } catch (err) {
    await fail(err instanceof StockError ? err.message : "Receive failed.");
  }

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "RECEIVE",
    entity: "PurchaseOrder",
    entityId: poId,
    ref: po.ref,
    note: "MAIN receive",
  });
  revalidatePath("/purchase-orders");
  revalidatePath("/stock");
  revalidatePath("/finance");
  revalidatePath("/audit");
}

// Also the escape hatch for a PO stuck SENT/PARTIAL forever (supplier never
// delivers the rest, or raises a price you won't pay) — cancel writes off
// only the undelivered remainder; whatever already arrived (received > 0)
// stays real and untouched. Once CANCELLED it drops out of the
// SENT/PARTIAL/DRAFT filter finance/page.tsx uses for "committed", so it
// stops permanently tying up budget for money that's never coming.
export async function cancelPurchaseOrder(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const poId = String(formData.get("poId") ?? "");
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId }, include: { lines: true } });
  if (!po) await fail("PO not found.");
  if (po.status === "CLOSED" || po.status === "CANCELLED") {
    await fail(`${po.ref} is already ${po.status} — nothing to cancel.`);
  }
  const anyReceived = po.lines.some((l) => l.received > 0);
  await prisma.purchaseOrder.update({ where: { id: poId }, data: { status: "CANCELLED" } });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "CANCEL",
    entity: "PurchaseOrder",
    entityId: po.id,
    ref: po.ref,
    note: anyReceived
      ? "Cancelled — undelivered remainder written off, what already arrived stays"
      : "Cancelled before any receipt",
  });
  revalidatePath("/purchase-orders");
  revalidatePath("/finance");
  revalidatePath("/audit");
}

export async function updatePurchaseOrder(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const poId = String(formData.get("poId") ?? "");
  const lines = linesFrom(formData);
  if (!lines.length) await fail("Add at least one line.");
  const po = await requireDraftPo(poId);

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrderLine.deleteMany({ where: { poId } });
    await tx.purchaseOrder.update({
      where: { id: poId },
      data: {
        raisedById: user.id,
        // Any approval already given was for the old figures — changing the
        // lines means Finance needs to see the new total before it can send.
        approveStatus: "PENDING",
        approvedById: null,
        approvedAt: null,
        lines: { create: lines },
      },
    });
  });

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPDATE",
    entity: "PurchaseOrder",
    entityId: po.id,
    ref: po.ref,
    note: `Draft lines updated · ${lines.length} lines · approval reset`,
  });
  revalidatePath("/purchase-orders");
  revalidatePath("/finance");
  revalidatePath("/audit");
}
