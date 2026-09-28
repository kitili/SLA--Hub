import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadOverallPlan } from "@/lib/overall-plan";
import { prisma } from "@/lib/prisma";
import { rollupOverall } from "@/lib/sheet-math";

export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== "STORE" && session.role !== "FINANCE" && session.role !== "CEO")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [plan, issues] = await Promise.all([
    loadOverallPlan(2027),
    prisma.parentIssue.findMany({ include: { sku: true, order: { include: { campus: true } } } }),
  ]);

  const issued = new Map<string, number>();
  for (const issue of issues) {
    const key = `${issue.order.campusId}|${issue.skuId}|${issue.size}`;
    issued.set(key, (issued.get(key) ?? 0) + issue.qty);
  }

  const totals = rollupOverall(plan);
  const header = "campus,sku,size,required,campus_on_hand,main_cover,order_qty,buy_tzs,order_cost_tzs,order_sell_tzs,profit_tzs,issued_qty,method\n";
  const body = plan
    .map((r) => {
      const issuedQty = issued.get(`${r.campusId}|${r.skuId}|${r.size}`) ?? 0;
      return [
        csv(r.campusName),
        r.skuCode,
        r.size,
        r.required,
        r.remaining,
        r.mainCover,
        r.orderQty,
        r.buyTzs,
        r.orderCostTzs,
        r.orderSellTzs,
        r.profitTzs,
        issuedQty,
        csv(r.method),
      ].join(",");
    })
    .join("\n");
  const footer = [
    "TOTAL",
    "",
    "",
    totals.required,
    totals.remaining,
    totals.mainCover,
    totals.orderQty,
    "",
    totals.orderCostTzs,
    totals.orderSellTzs,
    totals.profitTzs,
    "",
    "",
  ].join(",");

  return new NextResponse(`${header}${body}\n${footer}\n`, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=overall-buy-plan-2027.csv",
    },
  });
}

function csv(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}
