import { prisma } from "./prisma";
import {
  buildOverallPlan,
  planVsBudget,
  poMoney,
  remainingBudgetTzs,
  rollupOverall,
  type OverallRow,
} from "./sheet-math";

export async function loadOverallPlan(year = 2027): Promise<OverallRow[]> {
  const [enrolment, fits, skus, balances] = await Promise.all([
    prisma.campusEnrolment.findMany({ where: { year }, include: { campus: true } }),
    prisma.sizeFit.findMany(),
    prisma.sku.findMany(),
    prisma.stockBalance.findMany({ include: { location: true } }),
  ]);
  return buildOverallPlan({
    enrolment: enrolment.map((e) => ({
      campusId: e.campusId,
      campusName: e.campus.name,
      className: e.className,
      expectedHeadcount: e.expectedHeadcount,
    })),
    fits: fits.map((f) => ({
      className: f.className,
      gender: f.gender,
      skuId: f.skuId,
      size: f.size,
    })),
    skus: skus.map((s) => ({
      id: s.id,
      code: s.code,
      kind: s.kind,
      gender: s.gender,
      buyTzs: s.buyTzs,
      sellTzs: s.sellTzs,
    })),
    onHand: balances.map((b) => ({
      campusId: b.location.campusId,
      skuId: b.skuId,
      size: b.size,
      qty: b.qty,
    })),
  });
}

export async function loadPlanBudget(year = 2027) {
  const [plan, budget, pos, matReqs] = await Promise.all([
    loadOverallPlan(year),
    prisma.budget.findFirst({ orderBy: { year: "desc" } }),
    prisma.purchaseOrder.findMany({ include: { lines: true } }),
    prisma.materialRequest.findMany({ where: { status: { in: ["APPROVED", "FULFILLED"] } }, include: { lines: true } }),
  ]);
  const totals = rollupOverall(plan);
  const { committed, receivedPo } = poMoney(pos.filter((p) => p.ref !== `PO-PLAN-${year}`));
  // Same money this page's own "Remaining after POs & requests" figure
  // subtracts — folded into `committed` here so every "remaining budget"
  // figure across the app (this plan, /finance, /sizes) agrees.
  const matReqSpend = matReqs.reduce((s, r) => s + r.lines.reduce((a, l) => a + l.qty * l.unitCostTzs, 0), 0);
  const leftover = remainingBudgetTzs(budget?.allocatedTzs ?? 0, receivedPo, committed + matReqSpend);
  return {
    plan,
    totals,
    budget,
    committed,
    receivedPo,
    ...planVsBudget(totals.orderCostTzs, leftover),
  };
}
