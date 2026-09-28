import { clothAlerts, stockAlerts } from "./alerts";
import { orderPaid, orderTotal } from "./order-status";
import { prisma } from "./prisma";

export type KpiScope = {
  campusId?: string | null;
  includeMoney: boolean;
  includeProduction: boolean;
  asOf?: Date;
};

export type CampusKpi = {
  id: string;
  code: string;
  name: string;
  enrolled: number;
  onFile: number;
  withKit: number;
  coveragePct: number;
  coupons: number;
  unpaid: number;
  paidWaiting: number;
  ready: number;
  fulfilled: number;
  issuedPcs: number;
  onHand: number;
  lowSizes: number;
  paymentsTzs: number;
  outstandingTzs: number;
  issuedRevenueTzs: number;
  issuedCostTzs: number;
};

export type PipelineKpi = { status: string; count: number };

export type SizeKpi = { sku: string; size: string; qty: number };

export type PurchasedSkuKpi = { sku: string; size: string; qty: number; costTzs: number };

export type SupplierKpi = { supplierName: string; poCount: number; receivedQty: number; costTzs: number };

export type AgingKpi = {
  ref: string;
  studentName: string;
  campusName: string;
  status: string;
  days: number;
  ready: boolean;
  outstandingTzs: number;
};

export type KpiReport = {
  asOf: Date;
  campusCode: string | null;
  campusName: string | null;
  enrolled: number;
  onFile: number;
  withKit: number;
  coveragePct: number;
  quietCampuses: string[];
  openCoupons: number;
  unpaidCoupons: number;
  paidWaiting: number;
  readyToCollect: number;
  fulfilled: number;
  outstandingTzs: number;
  paymentsTzs: number;
  issuedRevenueTzs: number;
  issuedCostTzs: number;
  onHand: number;
  stockValueTzs: number;
  lowSizes: number;
  fillRate: number;
  payRate: number;
  orderedPcs: number;
  issuedPcs: number;
  openRequests: number;
  sewingOpen: number;
  sewnPcs: number;
  clothShortfalls: number;
  remainingBudgetTzs: number | null;
  pipeline: PipelineKpi[];
  campuses: CampusKpi[];
  hottest: SizeKpi[];
  dead: { location: string; sku: string; size: string; qty: number }[];
  topPurchasedSkus: PurchasedSkuKpi[];
  topSuppliers: SupplierKpi[];
  aging: AgingKpi[];
  readyList: AgingKpi[];
  attention: { tone: "gold" | "pink"; title: string; detail: string }[];
};

const OPEN = ["ORDERED", "PAID", "PARTIAL"] as const;

export function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

export function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export async function listCampuses() {
  return prisma.campus.findMany({ orderBy: { name: "asc" }, select: { id: true, code: true, name: true } });
}

export async function campusIdForCode(code?: string | null) {
  const cleaned = String(code ?? "").trim().toUpperCase();
  if (!cleaned) return null;
  return prisma.campus.findUnique({ where: { code: cleaned }, select: { id: true, code: true, name: true } });
}

export async function buildKpiReport(scope: KpiScope): Promise<KpiReport> {
  const asOf = scope.asOf ?? new Date();
  const campusWhere = scope.campusId ? { campusId: scope.campusId } : {};
  const stockWhere = scope.campusId ? { location: { campusId: scope.campusId } } : undefined;
  const alertFilter = scope.campusId ? { campusId: scope.campusId } : undefined;
  const cutoff = new Date(asOf.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [campuses, orders, issues, balances, requests, sewing, budget, pos, matReqs, stock, cloth, students, enrolment] = await Promise.all([
    prisma.campus.findMany({ orderBy: { name: "asc" } }),
    prisma.parentOrder.findMany({
      where: campusWhere,
      include: { campus: true, lines: true, pays: true },
    }),
    prisma.parentIssue.findMany({
      where: scope.campusId ? { order: { campusId: scope.campusId } } : undefined,
      include: { sku: true, order: { include: { campus: true } } },
    }),
    prisma.stockBalance.findMany({
      where: stockWhere,
      include: { sku: true, location: true },
    }),
    prisma.campusRequest.count({
      where: { status: "OPEN", ...campusWhere },
    }),
    scope.includeProduction
      ? prisma.sewingJob.findMany()
      : Promise.resolve([]),
    scope.includeMoney && !scope.campusId
      ? prisma.budget.findFirst({ where: { year: asOf.getFullYear() } })
      : Promise.resolve(null),
    scope.includeMoney && !scope.campusId
      ? prisma.purchaseOrder.findMany({ include: { lines: { include: { sku: true } }, supplier: true } })
      : Promise.resolve([]),
    scope.includeMoney && !scope.campusId
      ? prisma.materialRequest.findMany({ where: { status: { in: ["APPROVED", "FULFILLED"] } }, include: { lines: true } })
      : Promise.resolve([]),
    stockAlerts(alertFilter),
    scope.includeProduction ? clothAlerts() : Promise.resolve([]),
    prisma.student.findMany({
      where: campusWhere,
      select: { id: true, campusId: true },
    }),
    prisma.campusEnrolment.findMany({
      where: { year: 2027, ...campusWhere },
    }),
  ]);

  const scopedCampuses = scope.campusId
    ? campuses.filter((c) => c.id === scope.campusId)
    : campuses;

  const pipelineStatuses = ["ORDERED", "PAID", "PARTIAL", "FULFILLED"] as const;
  const pipeline = pipelineStatuses.map((status) => ({
    status,
    count: orders.filter((o) => o.status === status).length,
  }));

  // FULFILLED and CANCELLED are both terminal/resolved — neither should count
  // toward "still needs attention" figures like outstanding balance or aging.
  const isOpen = (status: string) => status !== "FULFILLED" && status !== "CANCELLED";

  let outstandingTzs = 0;
  let paymentsTzs = 0;
  let orderValueTzs = 0;
  let orderedPcs = 0;
  let issuedFromLines = 0;
  const aging: AgingKpi[] = [];
  const readyList: AgingKpi[] = [];

  for (const order of orders) {
    const total = orderTotal(order.lines);
    const paid = orderPaid(order.pays);
    const due = Math.max(0, total - paid);
    orderValueTzs += total;
    paymentsTzs += paid;
    if (isOpen(order.status)) outstandingTzs += due;
    for (const line of order.lines) {
      orderedPcs += line.qty;
      issuedFromLines += line.issued;
    }
    const days = daysBetween(order.orderedAt, asOf);
    const row: AgingKpi = {
      ref: order.ref,
      studentName: order.studentName,
      campusName: order.campus.name,
      status: order.status,
      days,
      ready: Boolean(order.readyAt),
      outstandingTzs: due,
    };
    if (isOpen(order.status) && days >= 14) aging.push(row);
    if (isOpen(order.status) && order.readyAt) readyList.push(row);
  }

  aging.sort((a, b) => b.days - a.days);
  readyList.sort((a, b) => b.days - a.days);

  const issuedPcs = issues.reduce((s, i) => s + i.qty, 0);
  const issuedRevenueTzs = issues.reduce((s, i) => s + i.qty * i.sku.sellTzs, 0);
  const issuedCostTzs = issues.reduce((s, i) => s + i.qty * i.sku.buyTzs, 0);
  const onHand = balances.reduce((s, b) => s + b.qty, 0);
  const stockValueTzs = balances.reduce((s, b) => s + b.qty * b.sku.sellTzs, 0);

  const hottestMap = new Map<string, SizeKpi>();
  for (const issue of issues) {
    const key = `${issue.sku.code}|${issue.size}`;
    const prev = hottestMap.get(key) ?? { sku: issue.sku.code, size: issue.size, qty: 0 };
    prev.qty += issue.qty;
    hottestMap.set(key, prev);
  }
  const hottest = [...hottestMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 8);

  const recentKeys = new Set(
    issues.filter((i) => i.createdAt >= cutoff).map((i) => `${i.skuId}|${i.size}`),
  );
  const dead = balances
    .filter((b) => b.qty > 0 && !recentKeys.has(`${b.skuId}|${b.size}`))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8)
    .map((b) => ({ location: b.location.name, sku: b.sku.code, size: b.size, qty: b.qty }));

  const withKitIds = new Set(
    issues.map((i) => i.order.studentId).filter((id): id is string => Boolean(id)),
  );

  const campusRows: CampusKpi[] = scopedCampuses.map((campus) => {
    const slice = orders.filter((o) => o.campusId === campus.id);
    const issueSlice = issues.filter((i) => i.order.campusId === campus.id);
    const stockSlice = balances.filter((b) => b.location.campusId === campus.id);
    const onFile = students.filter((s) => s.campusId === campus.id);
    const withKit = onFile.filter((s) => withKitIds.has(s.id)).length;
    const enrolled = enrolment
      .filter((e) => e.campusId === campus.id)
      .reduce((s, e) => s + e.expectedHeadcount, 0);
    let payments = 0;
    let outstanding = 0;
    for (const order of slice) {
      const total = orderTotal(order.lines);
      const paid = orderPaid(order.pays);
      payments += paid;
      if (isOpen(order.status)) outstanding += Math.max(0, total - paid);
    }
    return {
      id: campus.id,
      code: campus.code,
      name: campus.name,
      enrolled,
      onFile: onFile.length,
      withKit,
      coveragePct: pct(withKit, enrolled || onFile.length),
      coupons: slice.length,
      unpaid: slice.filter((o) => o.status === "ORDERED").length,
      paidWaiting: slice.filter((o) => o.status === "PAID" || o.status === "PARTIAL").length,
      ready: slice.filter((o) => isOpen(o.status) && o.readyAt).length,
      fulfilled: slice.filter((o) => o.status === "FULFILLED").length,
      issuedPcs: issueSlice.reduce((s, i) => s + i.qty, 0),
      onHand: stockSlice.reduce((s, b) => s + b.qty, 0),
      lowSizes: stockSlice.filter((b) => b.qty <= b.sku.reorder).length,
      paymentsTzs: payments,
      outstandingTzs: outstanding,
      issuedRevenueTzs: issueSlice.reduce((s, i) => s + i.qty * i.sku.sellTzs, 0),
      issuedCostTzs: issueSlice.reduce((s, i) => s + i.qty * i.sku.buyTzs, 0),
    };
  });

  let remainingBudgetTzs: number | null = null;
  if (budget) {
    const committed = pos
      .filter((p) => ["SENT", "PARTIAL", "DRAFT"].includes(p.status))
      .reduce((s, p) => s + p.lines.reduce((a, l) => a + (l.qty - l.received) * l.unitTzs, 0), 0);
    const receivedPo = pos.reduce(
      (s, p) => s + p.lines.reduce((a, l) => a + l.received * l.unitTzs, 0),
      0,
    );
    // Same formula as the Finance page's own "Remaining after POs &
    // requests" — kept in sync deliberately so leadership's number here
    // never quietly disagrees with Finance's.
    const matReqSpend = matReqs.reduce((s, r) => s + r.lines.reduce((a, l) => a + l.qty * l.unitCostTzs, 0), 0);
    remainingBudgetTzs = budget.allocatedTzs - receivedPo - committed - matReqSpend;
  }

  // Ranked by what's actually landed (received), not just ordered — a
  // cancelled or still-in-transit line hasn't really been "bought" yet.
  const purchasedMap = new Map<string, PurchasedSkuKpi>();
  const supplierMap = new Map<string, SupplierKpi>();
  for (const po of pos) {
    if (po.status === "CANCELLED") continue;
    const supplierPrev = supplierMap.get(po.supplierId) ?? {
      supplierName: po.supplier.name,
      poCount: 0,
      receivedQty: 0,
      costTzs: 0,
    };
    supplierPrev.poCount += 1;
    for (const line of po.lines) {
      if (line.received <= 0) continue;
      const key = `${line.sku.code}|${line.size}`;
      const prev = purchasedMap.get(key) ?? { sku: line.sku.code, size: line.size, qty: 0, costTzs: 0 };
      prev.qty += line.received;
      prev.costTzs += line.received * line.unitTzs;
      purchasedMap.set(key, prev);
      supplierPrev.receivedQty += line.received;
      supplierPrev.costTzs += line.received * line.unitTzs;
    }
    supplierMap.set(po.supplierId, supplierPrev);
  }
  const topPurchasedSkus = [...purchasedMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 8);
  const topSuppliers = [...supplierMap.values()].sort((a, b) => b.costTzs - a.costTzs).slice(0, 8);

  const attention: KpiReport["attention"] = [];
  if (readyList.length) {
    attention.push({
      tone: "gold",
      title: "Kits waiting at the window",
      detail: `${readyList.length} paid ${readyList.length === 1 ? "kit is" : "kits are"} marked ready and not collected.`,
    });
  }
  if (aging.length) {
    attention.push({
      tone: "gold",
      title: "Aging coupons",
      detail: `${aging.length} open ${aging.length === 1 ? "coupon is" : "coupons are"} older than 14 days.`,
    });
  }
  if (stock.length) {
    attention.push({
      tone: "pink",
      title: "Low sizes",
      detail: `${stock.length} size rows sit at or below reorder.`,
    });
  }
  if (cloth.length) {
    attention.push({
      tone: "pink",
      title: "Cloth shortfall",
      detail: `${cloth.length} material ${cloth.length === 1 ? "line needs" : "lines need"} a buy before open sewing jobs finish.`,
    });
  }
  const enrolled = campusRows.reduce((s, c) => s + c.enrolled, 0);
  const onFile = campusRows.reduce((s, c) => s + c.onFile, 0);
  const withKit = campusRows.reduce((s, c) => s + c.withKit, 0);
  const coveragePct = pct(withKit, enrolled || onFile);

  if (enrolled && coveragePct < 20) {
    attention.push({
      tone: "pink",
      title: "Kit coverage",
      detail: `${withKit} of ${enrolled} planned children have received at least one piece (${coveragePct}%).`,
    });
  }

  const quiet = campusRows.filter((c) => c.coupons === 0);
  if (quiet.length && !scope.campusId) {
    attention.push({
      tone: "gold",
      title: "Quiet campuses",
      detail: `${quiet.map((c) => c.name).join(", ")} ${quiet.length === 1 ? "has" : "have"} no parent coupons yet.`,
    });
  }

  return {
    asOf,
    campusCode: scopedCampuses.length === 1 ? scopedCampuses[0].code : null,
    campusName: scopedCampuses.length === 1 ? scopedCampuses[0].name : null,
    enrolled,
    onFile,
    withKit,
    coveragePct,
    quietCampuses: quiet.map((c) => c.name),
    openCoupons: orders.filter((o) => (OPEN as readonly string[]).includes(o.status)).length,
    unpaidCoupons: orders.filter((o) => o.status === "ORDERED").length,
    paidWaiting: orders.filter((o) => o.status === "PAID" || o.status === "PARTIAL").length,
    readyToCollect: readyList.length,
    fulfilled: orders.filter((o) => o.status === "FULFILLED").length,
    outstandingTzs,
    paymentsTzs,
    issuedRevenueTzs,
    issuedCostTzs,
    onHand,
    stockValueTzs,
    lowSizes: stock.length,
    fillRate: pct(issuedFromLines, orderedPcs),
    payRate: pct(paymentsTzs, orderValueTzs),
    orderedPcs,
    issuedPcs,
    openRequests: requests,
    sewingOpen: sewing.filter((j) => j.status !== "DONE").length,
    sewnPcs: sewing.reduce((s, j) => s + j.actual, 0),
    clothShortfalls: cloth.length,
    remainingBudgetTzs,
    pipeline,
    campuses: campusRows,
    hottest,
    dead,
    topPurchasedSkus,
    topSuppliers,
    aging: aging.slice(0, 12),
    readyList: readyList.slice(0, 12),
    attention,
  };
}
