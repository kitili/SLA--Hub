import { isPaidInFull, orderPaid, orderTotal } from "./order-status";

export function collectMessage(input: {
  studentName: string;
  campusName: string;
  ref: string;
  sw?: boolean;
}) {
  if (input.sw) {
    return `Habari, sare ya ${input.studentName} (${input.ref}) iko tayari kuchukuliwa ${input.campusName}. Tafadhali njoo na kuponi. — Silverleaf`;
  }
  return `Hello, ${input.studentName}'s uniform (${input.ref}) is ready to collect at ${input.campusName}. Please bring the coupon. — Silverleaf`;
}

export function parentCollects(order: {
  status: string;
  readyAt?: Date | string | null;
  paid: number;
  total: number;
}) {
  if (order.status === "FULFILLED") return false;
  if (!isPaidInFull(order.paid, order.total)) return false;
  return Boolean(order.readyAt) || order.status === "PAID" || order.status === "PARTIAL";
}

export function coverLines(
  lines: { skuId: string; size: string; qty: number; issued: number }[],
  stock: { skuId: string; size: string; qty: number }[],
) {
  const map = new Map(stock.map((s) => [`${s.skuId}|${s.size}`, s.qty]));
  return lines.every((l) => {
    const need = l.qty - l.issued;
    if (need <= 0) return true;
    return (map.get(`${l.skuId}|${l.size}`) ?? 0) >= need;
  });
}

export function moneyOnOrder(order: {
  status: string;
  readyAt?: Date | string | null;
  lines: { qty: number; unitTzs: number; issued?: number }[];
  pays: { amountTzs: number; confirmStatus: string }[];
}) {
  const total = orderTotal(order.lines);
  const paid = orderPaid(order.pays);
  return {
    total,
    paid,
    collect: parentCollects({ status: order.status, readyAt: order.readyAt, paid, total }),
  };
}
