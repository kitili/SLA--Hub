"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { makeRef } from "@/lib/refs";
import { applyMove, campusStore, StockError } from "@/lib/stock";
import { parseTzs, tzs } from "@/lib/money";
import type { Role } from "@/lib/constants";
import { fail } from "@/lib/form";
import { writeAudit } from "@/lib/audit";
import { edadminConfigured } from "@/lib/edadmin/client";
import { syncStudentByRegNo } from "@/lib/edadmin/sync";
import { familyScopeForUser, normalizeReg } from "@/lib/family";
import { canIssueKit, orderPaid, orderRecordedPaid, orderTotal, statusAfterPayment } from "@/lib/order-status";
import { canIssue, canIssueFromLocation, canSeeOrder, canTakePayment, canWriteOrders } from "@/lib/visibility";

function collectLines(formData: FormData) {
  const skuIds = formData.getAll("skuId").map(String);
  const sizes = formData.getAll("size").map(String);
  const qtys = formData.getAll("qty").map((v) => Number.parseInt(String(v), 10));
  return skuIds
    .map((skuId, i) => ({ skuId, size: sizes[i] ?? "", qty: qtys[i] ?? 0 }))
    .filter((line) => line.skuId && line.size && line.qty > 0);
}

async function resolveStudent(regNo: string) {
  if (!regNo) return null;
  const cleaned = normalizeReg(regNo);
  let student = await prisma.student.findFirst({
    where: { OR: [{ regNo: cleaned }, { regNo: cleaned.toUpperCase() }] },
    include: { campus: true },
  });
  if (!student && edadminConfigured()) {
    const synced = await syncStudentByRegNo(cleaned);
    if (synced) {
      student = await prisma.student.findUnique({
        where: { id: synced.id },
        include: { campus: true },
      });
    }
  }
  return student;
}

export async function lookupStudent(regNo: string, campusId?: string | null) {
  const student = await resolveStudent(regNo.trim());
  if (!student) return null;
  if (campusId && student.campusId !== campusId) return null;
  // Surfaced so staff/parents see it BEFORE creating a duplicate coupon,
  // not just findable afterward via /orders search. Read-only - doesn't
  // block creation, just warns.
  const openOrders = await prisma.parentOrder.findMany({
    where: { studentId: student.id, status: { in: ["ORDERED", "PAID", "PARTIAL"] } },
    select: { ref: true, status: true, orderedAt: true },
    orderBy: { orderedAt: "desc" },
  });
  return {
    id: student.id,
    name: student.name,
    className: student.className,
    gender: student.gender,
    campusId: student.campusId,
    campusName: student.campus.name,
    regNo: student.regNo,
    openOrders: openOrders.map((o) => ({
      ref: o.ref,
      status: o.status,
      orderedAt: o.orderedAt.toISOString().slice(0, 10),
    })),
  };
}

async function createOrderFromForm(
  formData: FormData,
  actor: { id: string; role: Role; campusId: string | null },
) {
  const lines = collectLines(formData);
  if (!lines.length) return { error: "Add at least one item." };

  const regNo = String(formData.get("regNo") ?? "").trim();
  const student = await resolveStudent(regNo);
  let campusId = String(formData.get("campusId") ?? student?.campusId ?? actor.campusId ?? "");
  if (actor.role === "PARENT") {
    if (!student) return { error: "Pick a linked child — use their registration number." };
    const scope = await familyScopeForUser(actor.id);
    if (!scope?.studentIds.includes(student.id)) {
      return { error: "That child is not on your account. Add them as a sibling first." };
    }
    campusId = student.campusId;
  }
  if ((actor.role === "ADMIN" || actor.role === "HEAD_TEACHER") && actor.campusId) {
    campusId = actor.campusId;
  } else if (actor.role === "ADMIN" || actor.role === "HEAD_TEACHER") {
    const campus = await prisma.campus.findUnique({ where: { id: campusId } });
    if (!campus) return { error: "Pick a school." };
  }
  if (!campusId) return { error: "Campus is required." };

  const studentName = String(formData.get("studentName") ?? student?.name ?? "").trim();
  const className = String(formData.get("className") ?? student?.className ?? "").trim();
  const gender = String(formData.get("gender") ?? student?.gender ?? "").trim();
  if (!studentName || !className || !gender) {
    return { error: "Student name, class, and gender are required." };
  }

  const skus = await prisma.sku.findMany({
    where: { id: { in: lines.map((l) => l.skuId) } },
  });
  const skuMap = Object.fromEntries(skus.map((s) => [s.id, s]));

  const order = await prisma.parentOrder.create({
    data: {
      ref: makeRef("ORD"),
      campusId,
      studentId: student?.id,
      studentName,
      className,
      gender,
      regNo: student?.regNo ?? regNo,
      kind: String(formData.get("kind") ?? "SCHOOL"),
      status: "ORDERED",
      notes: String(formData.get("notes") ?? ""),
      placedById: actor.role === "PARENT" ? actor.id : null,
      lines: {
        create: lines.map((line) => ({
          skuId: line.skuId,
          size: line.size,
          qty: line.qty,
          unitTzs: skuMap[line.skuId]?.sellTzs ?? 0,
        })),
      },
    },
  });
  return { ok: true, ref: order.ref, id: order.id };
}

export async function parentCreateOrder(formData: FormData) {
  const user = await requireUser(["PARENT"]);
  const result = await createOrderFromForm(formData, user);
  if ("error" in result) return fail(result.error ?? "Could not create order");
  revalidatePath("/parent");
  revalidatePath("/orders");
  // Returned so the New-order confirmation flow can show the real ref —
  // harmless for the offline-queue-flush caller, which already ignores it.
  return result;
}

export async function staffCreateOrder(formData: FormData) {
  const user = await requireUser(["STORE", "ADMIN", "HEAD_TEACHER"]);
  if (!canWriteOrders(user.role)) return fail("Not allowed.");
  const result = await createOrderFromForm(formData, user);
  if ("error" in result) return fail(result.error ?? "Could not create order");
  revalidatePath("/orders");
}

export async function recordPayment(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE", "ADMIN", "HEAD_TEACHER"]);
  if (!canTakePayment(user.role)) return fail("Not allowed.");
  const orderId = String(formData.get("orderId") ?? "");
  const amountTzs = parseTzs(formData.get("amountTzs"));
  const channel = String(formData.get("channel") ?? "CASH");
  if (!orderId || amountTzs <= 0) await fail("Order and amount are required.");

  const order = await prisma.parentOrder.findUnique({
    where: { id: orderId },
    include: { lines: true, pays: true },
  });
  if (!order || !canSeeOrder(user, order)) return fail("Order not found.");
  if (order.status === "CANCELLED") return fail("This coupon was cancelled — no payment can be recorded against it.");

  // Cap against confirmed + already-pending, not just confirmed — otherwise
  // several pending entries could each individually look fine yet add up to
  // more than the order ever owed once Finance confirms them.
  const confirmedPaid = orderPaid(order.pays);
  const pendingPaid = orderRecordedPaid(order.pays) - confirmedPaid;
  const total = orderTotal(order.lines);
  const remaining = total - confirmedPaid - pendingPaid;
  if (amountTzs > remaining) {
    return fail(`Amount is more than the remaining balance (${tzs(remaining)} owed).`);
  }

  // Imani (STORE, who also covers Finance) recording her own entry needs no
  // one else to approve it — a campus's entry sits PENDING until she confirms
  // the money actually reached her (see confirmPayment/rejectPayment below).
  const selfConfirmed = user.role === "STORE" || user.role === "FINANCE";
  await prisma.payment.create({
    data: {
      orderId,
      amountTzs,
      channel,
      ref: makeRef("PAY"),
      cashierId: user.id,
      confirmStatus: selfConfirmed ? "CONFIRMED" : "PENDING",
      resolvedAt: selfConfirmed ? new Date() : null,
      resolvedById: selfConfirmed ? user.id : null,
    },
  });

  if (selfConfirmed) {
    const paid = confirmedPaid + amountTzs;
    const next = statusAfterPayment(order.status, paid, total);
    if (next !== order.status || (next === "PAID" && !order.paidAt)) {
      await prisma.parentOrder.update({
        where: { id: orderId },
        data: {
          status: next,
          paidAt: next === "PAID" && !order.paidAt ? new Date() : order.paidAt,
        },
      });
    }
  }
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "PAY",
    entity: "Payment",
    entityId: orderId,
    ref: order.ref,
    note: `${channel} ${amountTzs}${selfConfirmed ? "" : " (pending confirmation)"}`,
  });
  revalidatePath("/parent");
  revalidatePath("/finance");
  revalidatePath("/audit");
}

// Imani (Store, who also covers Finance) verifying that money a campus
// recorded has actually reached her — cash in hand or the bank showing it.
// Only after this does it count toward the order's official paid total; see
// orderPaid() in order-status.ts.
export async function confirmPayment(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const paymentId = String(formData.get("paymentId") ?? "");
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: { include: { lines: true, pays: true } } },
  });
  if (!payment) return fail("Payment not found.");
  if (payment.confirmStatus !== "PENDING") return fail("This payment isn't awaiting confirmation.");

  await prisma.payment.update({
    where: { id: paymentId },
    data: { confirmStatus: "CONFIRMED", resolvedAt: new Date(), resolvedById: user.id },
  });

  // payment.order.pays was fetched before the update above, so this specific
  // row is still PENDING in that snapshot and orderPaid() correctly excludes
  // it — add its amount in manually to get the post-confirmation total.
  const total = orderTotal(payment.order.lines);
  const paidAfter = orderPaid(payment.order.pays) + payment.amountTzs;
  const next = statusAfterPayment(payment.order.status, paidAfter, total);
  if (next !== payment.order.status || (next === "PAID" && !payment.order.paidAt)) {
    await prisma.parentOrder.update({
      where: { id: payment.orderId },
      data: { status: next, paidAt: next === "PAID" && !payment.order.paidAt ? new Date() : payment.order.paidAt },
    });
  }

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "CONFIRM",
    entity: "Payment",
    entityId: payment.id,
    ref: payment.order.ref,
    note: `Confirmed ${payment.channel} ${tzs(payment.amountTzs)} (${payment.ref})`,
  });
  revalidatePath("/orders");
  revalidatePath(`/orders/${payment.orderId}`);
  revalidatePath("/parent");
  revalidatePath("/finance");
  revalidatePath("/audit");
}

// The other half of confirmPayment — Imani disputing an entry that turns
// out to be wrong (money never actually arrived, or the amount's off).
// Doesn't touch the order's balance at all: a PENDING payment never counted
// toward it in the first place, so there's nothing to reverse. Whoever made
// the mistake re-enters the correct amount as a fresh payment.
export async function rejectPayment(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const paymentId = String(formData.get("paymentId") ?? "");
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!payment) return fail("Payment not found.");
  if (payment.confirmStatus !== "PENDING") return fail("This payment isn't awaiting confirmation.");

  await prisma.payment.update({
    where: { id: paymentId },
    data: { confirmStatus: "REJECTED", resolvedAt: new Date(), resolvedById: user.id },
  });

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "REJECT",
    entity: "Payment",
    entityId: payment.id,
    ref: payment.order.ref,
    note: `Rejected ${payment.channel} ${tzs(payment.amountTzs)} (${payment.ref}) — money not received`,
  });
  revalidatePath("/orders");
  revalidatePath(`/orders/${payment.orderId}`);
  revalidatePath("/parent");
  revalidatePath("/finance");
  revalidatePath("/audit");
}

// Corrects a mistaken payment without editing or deleting the original row —
// posts an equal-and-opposite negative Payment instead, same pattern as
// reverseStockAdjust for stock. Keeps the full history intact (what was
// recorded, and that it was later corrected) rather than silently rewriting
// what happened. voidOfId is @unique in the schema, so a payment can only
// ever be voided once — enforced at the DB level, not just here. Only
// applies to already-CONFIRMED payments; a still-PENDING one that's wrong
// gets rejectPayment instead, since it never touched the balance to begin
// with.
export async function voidPayment(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE", "ADMIN", "HEAD_TEACHER"]);
  if (!canTakePayment(user.role)) return fail("Not allowed.");
  const paymentId = String(formData.get("paymentId") ?? "");

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: { include: { lines: true, pays: true } }, voidedBy: true },
  });
  if (!payment) return fail("Payment not found.");
  if (!canSeeOrder(user, payment.order)) return fail("Order not found.");
  if (payment.voidOfId) return fail("That's already an undo of another payment — nothing to undo here.");
  if (payment.voidedBy) return fail("This payment has already been undone.");
  if (payment.confirmStatus === "PENDING") {
    return fail("This payment hasn't been confirmed yet — reject it instead of undoing it.");
  }
  if (payment.confirmStatus === "REJECTED") {
    return fail("This payment was already rejected — there's nothing to undo.");
  }

  await prisma.payment.create({
    data: {
      orderId: payment.orderId,
      amountTzs: -payment.amountTzs,
      channel: payment.channel,
      ref: makeRef("UNDO"),
      cashierId: user.id,
      voidOfId: payment.id,
      // A void of already-confirmed money is itself immediately real — it's
      // a correction, not new money someone needs to verify receipt of.
      confirmStatus: "CONFIRMED",
      resolvedAt: new Date(),
      resolvedById: user.id,
    },
  });

  const total = orderTotal(payment.order.lines);
  const paidAfter = orderPaid(payment.order.pays) - payment.amountTzs;
  const next = statusAfterPayment(payment.order.status, paidAfter, total);
  if (next !== payment.order.status) {
    await prisma.parentOrder.update({ where: { id: payment.orderId }, data: { status: next } });
  }

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UNDO",
    entity: "Payment",
    entityId: payment.id,
    ref: payment.order.ref,
    note: `Undone ${payment.channel} ${tzs(payment.amountTzs)} (${payment.ref})`,
  });
  revalidatePath("/orders");
  revalidatePath(`/orders/${payment.orderId}`);
  revalidatePath("/parent");
  revalidatePath("/finance");
  revalidatePath("/audit");
}

export async function issueOrder(formData: FormData) {
  const user = await requireUser(["STORE", "ADMIN", "HEAD_TEACHER"]);
  if (!canIssue(user.role)) return fail("Not allowed.");
  const orderId = String(formData.get("orderId") ?? "");
  const locationId = String(formData.get("locationId") ?? "");
  const order = await prisma.parentOrder.findUnique({
    where: { id: orderId },
    include: { lines: { include: { sku: true } }, pays: true, campus: true },
  });
  if (!order || !canSeeOrder(user, order)) return fail("Order not found.");
  const paid = orderPaid(order.pays);
  const total = orderTotal(order.lines);
  if (!canIssueKit(paid, total, order.status)) return fail("Pay the coupon in full before issuing kit.");
  if (user.campusId && order.campusId !== user.campusId) return fail("Not your campus.");

  let locId = locationId;
  if (!locId) {
    try {
      locId = (await campusStore(order.campusId)).id;
    } catch {
      await fail("Issuing location not found.");
    }
  }
  const loc = await prisma.location.findUnique({ where: { id: locId } });
  if (!loc || !canIssueFromLocation(user, order, loc)) {
    return fail("Not allowed to issue from that location.");
  }

  const remainingLines = order.lines.filter((l) => l.qty - l.issued > 0);
  if (!remainingLines.length) return fail("Nothing left to issue on this order.");

  // No partial handover — a family never gets part of a kit. Check every
  // remaining line against real stock up front, in one shot, so the message
  // names everything missing at once instead of stopping at the first line
  // the transaction happens to hit.
  const missing: string[] = [];
  for (const line of remainingLines) {
    const remaining = line.qty - line.issued;
    const balance = await prisma.stockBalance.findUnique({
      where: { locationId_skuId_size: { locationId: locId, skuId: line.skuId, size: line.size } },
    });
    const onHand = balance?.qty ?? 0;
    if (onHand < remaining) {
      missing.push(`${line.sku.code} ${line.size} (have ${onHand}, need ${remaining})`);
    }
  }
  if (missing.length) {
    await fail(`Can't issue yet — still missing: ${missing.join(", ")}.`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const ref = makeRef("ISS");
      for (const line of remainingLines) {
        const qty = line.qty - line.issued;
        await applyMove(tx, {
          locationId: locId,
          skuId: line.skuId,
          size: line.size,
          qty: -qty,
          reason: "PARENT_ISSUE",
          ref,
          note: `${order.ref} · ${user.name}`,
        });
        await tx.parentIssue.create({
          data: { orderId, skuId: line.skuId, size: line.size, qty, locationId: locId },
        });
        await tx.parentOrderLine.update({
          where: { id: line.id },
          data: { issued: line.issued + qty },
        });
      }
      await tx.parentOrder.update({ where: { id: orderId }, data: { status: "FULFILLED" } });
    });
  } catch (err) {
    await fail(err instanceof StockError ? err.message : "Issue failed.");
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "ISSUE",
    entity: "ParentOrder",
    entityId: orderId,
    ref: order.ref,
    note: "Issued in full",
  });
  revalidatePath("/stock");
  revalidatePath("/parent");
  revalidatePath("/audit");
}

async function loadOrderForChange(orderId: string) {
  const order = await prisma.parentOrder.findUnique({
    where: { id: orderId },
    include: { lines: true, pays: true },
  });
  if (!order) return fail("Order not found.");
  if (order.status === "FULFILLED" || order.status === "CANCELLED") {
    await fail(`Order is ${order.status}.`);
  }
  if (order.lines.some((l) => l.issued > 0)) {
    await fail("Kit has already started issuing — can't change or cancel lines.");
  }
  return order;
}

function revalidateOrderPaths(orderId: string) {
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/parent");
  revalidatePath("/desk");
  revalidatePath("/finance");
  revalidatePath("/audit");
}

export async function cancelOrder(formData: FormData) {
  // canSeeOrder already scopes ADMIN/HEAD_TEACHER to their own campus's
  // orders below — this just lets them use it for a mistake they made
  // themselves, instead of only STORE being able to fix it.
  const user = await requireUser(["STORE", "ADMIN", "HEAD_TEACHER"]);
  const orderId = String(formData.get("orderId") ?? "");
  const order = await loadOrderForChange(orderId);
  if (!canSeeOrder(user, order)) await fail("Order not found.");

  const paid = orderPaid(order.pays);
  await prisma.parentOrder.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "CANCEL",
    entity: "ParentOrder",
    entityId: order.id,
    ref: order.ref,
    note: paid > 0 ? `Staff cancel · TZS ${paid} paid — Finance to reconcile` : "Staff cancel",
  });
  revalidateOrderPaths(orderId);
}

export async function cancelParentOrder(formData: FormData) {
  const user = await requireUser(["PARENT"]);
  const orderId = String(formData.get("orderId") ?? "");
  const order = await loadOrderForChange(orderId);
  if (order.placedById !== user.id) await fail("Not your order.");
  if (orderPaid(order.pays) > 0) {
    await fail("Can't cancel after payment — talk to the school office.");
  }

  await prisma.parentOrder.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "CANCEL",
    entity: "ParentOrder",
    entityId: order.id,
    ref: order.ref,
    note: "Parent cancel before payment",
  });
  revalidateOrderPaths(orderId);
}

export async function updateOrderLines(formData: FormData) {
  const user = await requireUser(["STORE", "PARENT", "ADMIN", "HEAD_TEACHER"]);
  const orderId = String(formData.get("orderId") ?? "");
  const lines = collectLines(formData);
  if (!lines.length) await fail("Add at least one line.");

  const order = await loadOrderForChange(orderId);
  if (user.role === "PARENT") {
    if (order.placedById !== user.id) await fail("Not your order.");
    if (orderPaid(order.pays) > 0) await fail("Can't edit after payment.");
  } else if (!canSeeOrder(user, order)) {
    await fail("Order not found.");
  }

  const skus = await prisma.sku.findMany({ where: { id: { in: lines.map((l) => l.skuId) } } });
  const skuMap = Object.fromEntries(skus.map((s) => [s.id, s]));

  await prisma.$transaction(async (tx) => {
    await tx.parentOrderLine.deleteMany({ where: { orderId } });
    await tx.parentOrderLine.createMany({
      data: lines.map((line) => ({
        orderId,
        skuId: line.skuId,
        size: line.size,
        qty: line.qty,
        unitTzs: skuMap[line.skuId]?.sellTzs ?? 0,
      })),
    });
  });

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPDATE",
    entity: "ParentOrder",
    entityId: order.id,
    ref: order.ref,
    note: `Lines updated · ${lines.length} items`,
  });
  revalidateOrderPaths(orderId);
}
