import { prisma } from "./prisma";
import { formatQty, planMaterials } from "./materials";
import { canIssueKit, orderPaid, orderTotal } from "./order-status";

export type StockAlert = {
  location: string;
  sku: string;
  name: string;
  size: string;
  qty: number;
  reorder: number;
};

export type ClothAlert = {
  material: string;
  kind: string;
  remaining: string;
  need: string;
  buy: string;
};

export async function stockAlerts(locationFilter?: { code?: { in: string[] }; campusId?: string; kind?: string }) {
  const rows = await prisma.stockBalance.findMany({
    where: locationFilter ? { location: locationFilter } : undefined,
    include: { sku: true, location: true },
  });
  return rows
    .filter((r) => r.qty <= r.sku.reorder)
    .map((r) => ({
      location: r.location.name,
      sku: r.sku.code,
      name: r.sku.name,
      size: r.size,
      qty: r.qty,
      reorder: r.sku.reorder,
    }))
    .sort((a, b) => a.qty - b.qty);
}

export type BlockedOrderAlert = {
  orderId: string;
  orderRef: string;
  studentName: string;
  campusId: string;
  campusName: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  size: string;
  needed: number;
  onHand: number;
  shortfall: number;
};

// Paid orders that genuinely can't be issued right now because the campus
// store doesn't have the stock — a sharper, more urgent signal than a plain
// reorder-threshold warning, since there's a real family waiting on this
// specific shortfall. Fires off *confirmed* payment (canIssueKit already
// only considers Finance-confirmed money via orderPaid), not the raw order,
// so this never nags anyone about demand that might not materialize.
export async function blockedOrderAlerts(campusId?: string): Promise<BlockedOrderAlert[]> {
  const orders = await prisma.parentOrder.findMany({
    where: {
      status: { in: ["PAID", "PARTIAL"] },
      ...(campusId ? { campusId } : {}),
    },
    include: { lines: { include: { sku: true } }, pays: true, campus: true },
  });

  // A shortfall that's already been asked for shouldn't nag again — an
  // admin acting on this row has no way to tell they'd already sent the
  // request, which is exactly what led to double-sends. Summed per
  // campus+sku+size since the "Request" button always asks for the exact
  // shortfall at send time, so an OPEN request covering that much means
  // this specific ask has already gone out.
  const openRequestLines = await prisma.campusRequestLine.findMany({
    where: { request: { status: "OPEN" } },
    select: { skuId: true, size: true, qty: true, request: { select: { campusId: true } } },
  });
  const alreadyRequested = new Map<string, number>();
  for (const l of openRequestLines) {
    const key = `${l.request.campusId}:${l.skuId}:${l.size}`;
    alreadyRequested.set(key, (alreadyRequested.get(key) ?? 0) + l.qty);
  }

  const results: BlockedOrderAlert[] = [];
  for (const order of orders) {
    const paid = orderPaid(order.pays);
    const total = orderTotal(order.lines);
    if (!canIssueKit(paid, total, order.status)) continue;

    const store = await prisma.location.findFirst({ where: { campusId: order.campusId, kind: "CAMPUS" } });
    if (!store) continue;

    for (const line of order.lines) {
      const needed = line.qty - line.issued;
      if (needed <= 0) continue;
      const balance = await prisma.stockBalance.findFirst({
        where: { locationId: store.id, skuId: line.skuId, size: line.size },
      });
      const onHand = balance?.qty ?? 0;
      if (onHand < needed) {
        const shortfall = needed - onHand;
        const key = `${order.campusId}:${line.skuId}:${line.size}`;
        if ((alreadyRequested.get(key) ?? 0) >= shortfall) continue;
        results.push({
          orderId: order.id,
          orderRef: order.ref,
          studentName: order.studentName,
          campusId: order.campusId,
          campusName: order.campus.name,
          skuId: line.skuId,
          skuCode: line.sku.code,
          skuName: line.sku.name,
          size: line.size,
          needed,
          onHand,
          shortfall,
        });
      }
    }
  }
  return results;
}

export type MainShortageAlert = {
  requestId: string;
  requestRef: string;
  campusName: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  size: string;
  needed: number;
  onHand: number;
  shortfall: number;
};

// One level up from blockedOrderAlerts: an open campus request Imani can't
// actually fill because MAIN itself is short. Without this she only finds
// out by clicking "Send from MAIN" and hitting a StockError.
export async function mainShortageAlerts(): Promise<MainShortageAlert[]> {
  const requests = await prisma.campusRequest.findMany({
    where: { status: "OPEN" },
    include: { campus: true, lines: { include: { sku: true } } },
  });
  if (!requests.length) return [];

  const main = await prisma.location.findFirst({ where: { code: "MAIN" } });
  if (!main) return [];

  // Already in flight — an open sewing job or an unreceived PO line for the
  // same sku+size means someone already acted on this shortfall; don't nag
  // again until it's actually resolved.
  const [openJobs, openPoLines] = await Promise.all([
    prisma.sewingJob.findMany({ where: { status: { not: "DONE" } } }),
    prisma.purchaseOrderLine.findMany({ where: { po: { status: { in: ["DRAFT", "SENT", "PARTIAL"] } } } }),
  ]);
  const inFlight = new Map<string, number>();
  for (const j of openJobs) {
    const key = `${j.skuId}:${j.size}`;
    inFlight.set(key, (inFlight.get(key) ?? 0) + Math.max(0, j.expected - j.actual));
  }
  for (const l of openPoLines) {
    const key = `${l.skuId}:${l.size}`;
    inFlight.set(key, (inFlight.get(key) ?? 0) + Math.max(0, l.qty - l.received));
  }

  const results: MainShortageAlert[] = [];
  for (const request of requests) {
    for (const line of request.lines) {
      const balance = await prisma.stockBalance.findFirst({
        where: { locationId: main.id, skuId: line.skuId, size: line.size },
      });
      const onHand = balance?.qty ?? 0;
      if (onHand >= line.qty) continue;
      const shortfall = line.qty - onHand;
      const key = `${line.skuId}:${line.size}`;
      if ((inFlight.get(key) ?? 0) >= shortfall) continue;
      results.push({
        requestId: request.id,
        requestRef: request.ref,
        campusName: request.campus.name,
        skuId: line.skuId,
        skuCode: line.sku.code,
        skuName: line.sku.name,
        size: line.size,
        needed: line.qty,
        onHand,
        shortfall,
      });
    }
  }
  return results;
}

export async function clothAlerts(): Promise<ClothAlert[]> {
  const [jobs, materials, recipes] = await Promise.all([
    prisma.sewingJob.findMany({
      where: { status: { not: "DONE" } },
      include: { sku: true },
    }),
    prisma.materialBatch.findMany(),
    prisma.garmentRecipe.findMany({ include: { sku: true } }),
  ]);
  const plan = planMaterials(
    recipes.map((r) => ({
      skuId: r.skuId,
      skuCode: r.sku.code,
      skuName: r.sku.name,
      garmentKind: r.sku.kind,
      size: r.size,
      materialKind: r.materialKind,
      materialName: r.materialName,
      qtyPerPiece: r.qtyPerPiece,
      unit: r.unit,
    })),
    materials,
    jobs.map((j) => ({
      skuId: j.skuId,
      skuCode: j.sku.code,
      skuName: j.sku.name,
      garmentKind: j.sku.kind,
      size: j.size,
      pieces: j.expected,
    })),
  );
  return plan
    .filter((p) => p.shortfall > 0)
    .map((p) => ({
      material: p.materialName,
      kind: p.materialKind,
      remaining: formatQty(p.remaining, p.unit),
      need: formatQty(p.needForJobs, p.unit),
      buy: formatQty(p.shortfall, p.unit),
    }));
}
