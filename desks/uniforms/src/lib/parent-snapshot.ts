import { prisma } from "@/lib/prisma";
import type { ParentSnapshot } from "@/lib/parent-cache";
import { familyScopeForUser } from "@/lib/family";
import { orderPaid, orderRecordedPaid } from "@/lib/order-status";
import { parentCollects } from "@/lib/ready";

const OPEN = ["ORDERED", "PAID", "PARTIAL"] as const;

export async function buildParentSnapshot(
  userId: string,
  campusId: string,
  campusName: string | null,
  parentName: string,
): Promise<ParentSnapshot> {
  const scope = await familyScopeForUser(userId);
  const familyFilter =
    scope && (scope.userIds.length || scope.studentIds.length)
      ? {
          OR: [
            { placedById: { in: scope.userIds.length ? scope.userIds : ["__none__"] } },
            { studentId: { in: scope.studentIds.length ? scope.studentIds : ["__none__"] } },
          ],
        }
      : { placedById: userId };

  const [skus, fits, children, mine, queue, family] = await Promise.all([
    prisma.sku.findMany({
      where: { active: true },
      include: { sizes: true, recipes: true },
      orderBy: { code: "asc" },
    }),
    prisma.sizeFit.findMany({ include: { sku: true }, orderBy: [{ className: "asc" }, { sku: { code: "asc" } }] }),
    prisma.student.findMany({
      where: scope?.familyId ? { familyId: scope.familyId } : { id: "none" },
      include: { campus: true },
      orderBy: { name: "asc" },
    }),
    prisma.parentOrder.findMany({
      where: familyFilter,
      include: { lines: { include: { sku: true } }, pays: true, campus: true },
      orderBy: { orderedAt: "asc" },
    }),
    prisma.parentOrder.findMany({
      where: { status: { in: [...OPEN] } },
      include: { campus: true },
      orderBy: { orderedAt: "asc" },
    }),
    scope?.familyId
      ? prisma.family.findUnique({ where: { id: scope.familyId } })
      : Promise.resolve(null),
  ]);

  const mineIds = new Set(mine.map((o) => o.id));

  return {
    savedAt: new Date().toISOString(),
    campusId,
    campusName,
    parentName,
    phone: family?.phone ?? "",
    children: children.map((c) => ({
      id: c.id,
      regNo: c.regNo,
      name: c.name,
      className: c.className,
      gender: c.gender,
      campusId: c.campusId,
      campusName: c.campus.name,
    })),
    skus: skus.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      colour: s.colour,
      kind: s.kind,
      gender: s.gender,
      sellTzs: s.sellTzs,
      sizes: s.sizes.map((x) => x.size),
      materialHint: [...new Set(s.recipes.map((r) => r.materialName))].join(" · ") || s.colour,
    })),
    fits: fits.map((f) => ({
      className: f.className,
      gender: f.gender,
      skuId: f.skuId,
      skuCode: f.sku.code,
      skuName: f.sku.name,
      garmentKind: f.sku.kind,
      size: f.size,
      note: f.note,
    })),
    orders: mine.map((order) => ({
      id: order.id,
      ref: order.ref,
      status: order.status,
      studentName: order.studentName,
      className: order.className,
      gender: order.gender,
      kind: order.kind,
      campusName: order.campus.name,
      orderedAt: order.orderedAt.toISOString(),
      queuePlace: queue.findIndex((q) => q.id === order.id) + 1,
      totalTzs: order.lines.reduce((s, l) => s + l.qty * l.unitTzs, 0),
      // What the family actually handed over, including money still
      // awaiting Finance's confirmation — so a parent who just paid never
      // sees "paid 0" and wonders where their money went. Whether they can
      // actually *collect* stays gated on confirmed money only, below.
      paidTzs: orderRecordedPaid(order.pays),
      collect: parentCollects({
        status: order.status,
        readyAt: order.readyAt,
        paid: orderPaid(order.pays),
        total: order.lines.reduce((s, l) => s + l.qty * l.unitTzs, 0),
      }),
      readyAt: order.readyAt?.toISOString() ?? null,
      lines: order.lines.map((l) => ({
        skuId: l.skuId,
        name: l.sku.name,
        size: l.size,
        qty: l.qty,
        issued: l.issued,
      })),
    })),
    queue: queue.map((order, i) => ({
      id: order.id,
      place: i + 1,
      ref: order.ref,
      studentName: order.studentName,
      campusName: order.campus.name,
      className: order.className,
      status: order.status,
      orderedAt: order.orderedAt.toISOString().slice(0, 10),
      mine: mineIds.has(order.id),
    })),
  };
}
