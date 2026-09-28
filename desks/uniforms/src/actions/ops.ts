"use server";

import { revalidatePath } from "next/cache";
import { requireUser, toSessionUser, setSessionCookie } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { fail } from "@/lib/form";
import { prisma } from "@/lib/prisma";
import { collectMessage } from "@/lib/ready";
import { canSeeOrder } from "@/lib/visibility";

export async function saveFamilyPhone(formData: FormData) {
  const user = await requireUser(["PARENT"]);
  const phone = String(formData.get("phone") ?? "").trim();
  if (!user.familyId) await fail("No family on this account.");
  await prisma.family.update({ where: { id: user.familyId! }, data: { phone } });
  await prisma.user.update({ where: { id: user.id }, data: { phone } });
  const session = await toSessionUser(user.id);
  if (session) await setSessionCookie(session);
  revalidatePath("/parent");
}

// Notifying a parent their kit is ready is a physical-handover concern, not
// a money one — restricted to whoever's actually holding the uniform
// (Store, or the campus Admin/Head Teacher), not Finance.
export async function markKitReady(formData: FormData) {
  const user = await requireUser(["STORE", "ADMIN", "HEAD_TEACHER"]);
  const orderId = String(formData.get("orderId") ?? "");
  const order = await prisma.parentOrder.findUnique({
    where: { id: orderId },
    include: { campus: true, student: { include: { family: true } }, placedBy: true },
  });
  if (!order || !canSeeOrder(user, order)) return fail("Order not found.");
  if (order.status === "FULFILLED") return fail("Already issued.");
  if (order.status === "ORDERED") return fail("Pay the coupon first.");

  const now = new Date();
  await prisma.parentOrder.update({
    where: { id: orderId },
    data: { readyAt: order.readyAt ?? now, notifiedAt: now },
  });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "READY",
    entity: "ParentOrder",
    entityId: order.id,
    ref: order.ref,
    note: collectMessage({ studentName: order.studentName, campusName: order.campus.name, ref: order.ref, sw: true }),
  });
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/parent");
}
