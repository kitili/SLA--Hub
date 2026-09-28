import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canIssueKit,
  isPaidInFull,
  orderPaid,
  orderRecordedPaid,
  orderTotal,
  statusAfterPayment,
  waitingAtWindow,
} from "../src/lib/order-status";

test("totals and paid sums", () => {
  assert.equal(orderTotal([{ qty: 2, unitTzs: 15000 }, { qty: 1, unitTzs: 25000 }]), 55000);
  assert.equal(
    orderPaid([
      { amountTzs: 20000, confirmStatus: "CONFIRMED" },
      { amountTzs: 35000, confirmStatus: "CONFIRMED" },
    ]),
    55000,
  );
});

test("orderPaid only counts CONFIRMED money, not PENDING or REJECTED", () => {
  const pays = [
    { amountTzs: 20000, confirmStatus: "CONFIRMED" },
    { amountTzs: 35000, confirmStatus: "PENDING" },
    { amountTzs: 9000, confirmStatus: "REJECTED" },
  ];
  assert.equal(orderPaid(pays), 20000);
});

test("orderRecordedPaid counts CONFIRMED and PENDING, excludes REJECTED", () => {
  const pays = [
    { amountTzs: 20000, confirmStatus: "CONFIRMED" },
    { amountTzs: 35000, confirmStatus: "PENDING" },
    { amountTzs: 9000, confirmStatus: "REJECTED" },
  ];
  assert.equal(orderRecordedPaid(pays), 55000);
});

test("part payment stays ORDERED", () => {
  assert.equal(statusAfterPayment("ORDERED", 15000, 30000), "ORDERED");
  assert.equal(isPaidInFull(15000, 30000), false);
  assert.equal(canIssueKit(15000, 30000, "ORDERED"), false);
  assert.equal(waitingAtWindow({ status: "ORDERED", paid: 15000, total: 30000 }), false);
});

test("full payment becomes PAID and can issue", () => {
  assert.equal(statusAfterPayment("ORDERED", 30000, 30000), "PAID");
  assert.equal(canIssueKit(30000, 30000, "PAID"), true);
  assert.equal(waitingAtWindow({ status: "PAID", paid: 30000, total: 30000 }), true);
});

test("issue states are not overwritten by more cash", () => {
  assert.equal(statusAfterPayment("PARTIAL", 30000, 30000), "PARTIAL");
  assert.equal(statusAfterPayment("FULFILLED", 30000, 30000), "FULFILLED");
  assert.equal(canIssueKit(30000, 30000, "FULFILLED"), false);
  assert.equal(waitingAtWindow({ status: "PARTIAL", paid: 30000, total: 30000 }), true);
});
