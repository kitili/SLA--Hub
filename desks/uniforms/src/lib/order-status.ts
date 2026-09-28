/** Coupon money vs kit. PARTIAL means some pieces issued, not a part-payment. */

export function orderTotal(lines: { qty: number; unitTzs: number }[]) {
  return lines.reduce((s, l) => s + l.qty * l.unitTzs, 0);
}

// The "official" paid figure — only money Finance has actually confirmed
// reached her. This is what decides status, kit issuance, and the kit-ready
// notification. A campus admin telling a parent "you're paid up" does not
// make it true here until Finance says so.
export function orderPaid(pays: { amountTzs: number; confirmStatus: string }[]) {
  return pays.filter((p) => p.confirmStatus === "CONFIRMED").reduce((s, p) => s + p.amountTzs, 0);
}

// What the family/campus actually handed over and hasn't been disputed —
// includes money still awaiting Finance's confirmation, excludes anything
// she's rejected. For parent/campus-facing "you've paid X" displays only;
// never use this to decide whether a kit can be issued.
export function orderRecordedPaid(pays: { amountTzs: number; confirmStatus: string }[]) {
  return pays.filter((p) => p.confirmStatus !== "REJECTED").reduce((s, p) => s + p.amountTzs, 0);
}

export function isPaidInFull(paid: number, total: number) {
  return total > 0 && paid >= total;
}

/** Stay ORDERED until the balance is cleared. Do not overwrite issue states. */
export function statusAfterPayment(current: string, paid: number, total: number) {
  // CANCELLED is just as sticky as FULFILLED/PARTIAL — a payment confirmed
  // or voided after cancellation must not silently resurrect the order.
  if (current === "FULFILLED" || current === "PARTIAL" || current === "CANCELLED") return current;
  return isPaidInFull(paid, total) ? "PAID" : "ORDERED";
}

export function canIssueKit(paid: number, total: number, status: string) {
  return status !== "FULFILLED" && status !== "CANCELLED" && isPaidInFull(paid, total);
}

export function waitingAtWindow(order: {
  status: string;
  paid: number;
  total: number;
}) {
  return order.status !== "FULFILLED" && order.status !== "CANCELLED" && isPaidInFull(order.paid, order.total);
}
