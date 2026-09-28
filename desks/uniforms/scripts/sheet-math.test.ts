import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allocateMainCover,
  buildOverallPlan,
  buyCost,
  collapsePlanLines,
  couponGap,
  expandEnrolment,
  orderQty,
  packQty,
  planVsBudget,
  profitTzs,
  remainingBudgetTzs,
  requiredQty,
  sewingPnl,
  splitGender,
} from "../src/lib/sheet-math";

test("OVERALL required and order qty", () => {
  assert.equal(requiredQty(30, 2), 60);
  assert.equal(orderQty(60, 8), 52);
  assert.equal(orderQty(10, 40), 0);
});

test("Summary profit = sell − buy", () => {
  assert.equal(profitTzs(2, 11000, 15000), 8000);
  assert.equal(buyCost(52, 11000), 572000);
});

test("coupon vs distribution", () => {
  assert.equal(couponGap(5, 1), 4);
});

test("sewing P&L vs city buy", () => {
  const pnl = sewingPnl(12, 18000, 40000, 20000);
  assert.equal(pnl.replacementTzs, 216000);
  assert.equal(pnl.sewnCostTzs, 60000);
  assert.equal(pnl.savedTzs, 156000);
});

test("ALL enrolment splits across P1–P6", () => {
  const rows = expandEnrolment([
    { campusId: "u", campusName: "Usa", className: "ALL", expectedHeadcount: 180 },
  ]);
  assert.equal(rows.length, 6);
  assert.equal(rows.reduce((s, r) => s + r.expectedHeadcount, 0), 180);
});

test("pack and gender", () => {
  assert.equal(packQty("PT1", "SCHOOL"), 2);
  assert.equal(packQty("GS1", "SCHOOL"), 1);
  assert.deepEqual(splitGender(15), { GIRL: 7, BOY: 8 });
});

test("enrolment × pack − on-hand for one class", () => {
  const plan = buildOverallPlan({
    enrolment: [{ campusId: "usa", campusName: "Usa River", className: "P4", expectedHeadcount: 30 }],
    fits: [
      { className: "P4", gender: "GIRL", skuId: "pt", size: "24" },
      { className: "P4", gender: "BOY", skuId: "pt", size: "24" },
    ],
    skus: [{ id: "pt", code: "PT1", kind: "SCHOOL", gender: "UNISEX", buyTzs: 11000, sellTzs: 15000 }],
    onHand: [{ campusId: "usa", skuId: "pt", size: "24", qty: 4 }],
  });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].required, 60);
  assert.equal(plan[0].remaining, 4);
  assert.equal(plan[0].mainCover, 0);
  assert.equal(plan[0].orderQty, 56);
  assert.equal(plan[0].orderCostTzs, 56 * 11000);
  assert.equal(plan[0].profitTzs, 56 * 4000);
});

test("MAIN leftover covers campus shortfall before city buy", () => {
  const plan = buildOverallPlan({
    enrolment: [
      { campusId: "am", campusName: "Arusha Town (AM)", className: "P4", expectedHeadcount: 30 },
      { campusId: "usa", campusName: "Usa River", className: "P4", expectedHeadcount: 30 },
    ],
    fits: [
      { className: "P4", gender: "GIRL", skuId: "pt", size: "24" },
      { className: "P4", gender: "BOY", skuId: "pt", size: "24" },
    ],
    skus: [{ id: "pt", code: "PT1", kind: "SCHOOL", gender: "UNISEX", buyTzs: 11000, sellTzs: 15000 }],
    onHand: [
      { campusId: "usa", skuId: "pt", size: "24", qty: 4 },
      { campusId: null, skuId: "pt", size: "24", qty: 20 },
    ],
  });
  const am = plan.find((r) => r.campusId === "am");
  const usa = plan.find((r) => r.campusId === "usa");
  assert.equal(am?.required, 60);
  assert.equal(am?.remaining, 0);
  assert.equal(am?.mainCover, 20);
  assert.equal(am?.orderQty, 40);
  assert.equal(usa?.remaining, 4);
  assert.equal(usa?.mainCover, 0);
  assert.equal(usa?.orderQty, 56);
});

test("allocate MAIN in campus-name order", () => {
  const cover = allocateMainCover(
    [
      { campusId: "usa", campusName: "Usa River", shortfall: 10 },
      { campusId: "am", campusName: "Arusha Town (AM)", shortfall: 8 },
    ],
    10,
  );
  assert.equal(cover.get("am"), 8);
  assert.equal(cover.get("usa"), 2);
});

test("plan vs budget and collapse PO lines", () => {
  assert.equal(remainingBudgetTzs(50_000_000, 10_000_000, 5_000_000), 35_000_000);
  assert.deepEqual(planVsBudget(40_000_000, 35_000_000), {
    remainingBudgetTzs: 35_000_000,
    orderCostTzs: 40_000_000,
    overByTzs: 5_000_000,
    fits: false,
  });
  const lines = collapsePlanLines([
    {
      campusId: "a",
      campusName: "A",
      skuId: "pt",
      skuCode: "PT1",
      size: "24",
      required: 10,
      remaining: 0,
      mainCover: 0,
      orderQty: 6,
      buyTzs: 11000,
      sellTzs: 15000,
      orderCostTzs: 66000,
      orderSellTzs: 90000,
      profitTzs: 24000,
      method: "x",
    },
    {
      campusId: "b",
      campusName: "B",
      skuId: "pt",
      skuCode: "PT1",
      size: "24",
      required: 10,
      remaining: 0,
      mainCover: 0,
      orderQty: 4,
      buyTzs: 11000,
      sellTzs: 15000,
      orderCostTzs: 44000,
      orderSellTzs: 60000,
      profitTzs: 16000,
      method: "x",
    },
  ]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].qty, 10);
  assert.equal(lines[0].unitTzs, 11000);
});
