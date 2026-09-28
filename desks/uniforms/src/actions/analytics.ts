"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { loadOverallPlan } from "@/lib/overall-plan";
import { prisma } from "@/lib/prisma";

export async function runYearEnd(formData: FormData) {
  await requireUser(["STORE", "FINANCE"]);
  const year = Number.parseInt(String(formData.get("year") ?? "2026"), 10);
  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  const issues = await prisma.parentIssue.findMany({
    where: { createdAt: { gte: start, lt: end } },
    include: { sku: true, order: true },
  });
  const balances = await prisma.stockBalance.findMany({ include: { sku: true } });

  type Key = string;
  const rows = new Map<
    Key,
    { campusId: string | null; skuId: string; size: string; issuedQty: number; revenueTzs: number; costTzs: number }
  >();

  for (const issue of issues) {
    const key = `${issue.order.campusId}|${issue.skuId}|${issue.size}`;
    const prev = rows.get(key) ?? {
      campusId: issue.order.campusId,
      skuId: issue.skuId,
      size: issue.size,
      issuedQty: 0,
      revenueTzs: 0,
      costTzs: 0,
    };
    prev.issuedQty += issue.qty;
    prev.revenueTzs += issue.qty * issue.sku.sellTzs;
    prev.costTzs += issue.qty * issue.sku.buyTzs;
    rows.set(key, prev);
  }

  await prisma.yearEndSnapshot.deleteMany({ where: { year } });
  for (const row of rows.values()) {
    const stockLeft = balances
      .filter((b) => b.skuId === row.skuId && b.size === row.size)
      .reduce((s, b) => s + b.qty, 0);
    await prisma.yearEndSnapshot.create({
      data: { year, ...row, stockLeft },
    });
  }

  revalidatePath("/analytics");
  revalidatePath("/sizes");
}

export async function runForecast(formData: FormData) {
  await requireUser(["STORE", "FINANCE"]);
  const year = Number.parseInt(String(formData.get("year") ?? "2027"), 10);
  const plan = await loadOverallPlan(year);

  await prisma.sizeForecast.deleteMany({ where: { year } });
  for (const row of plan) {
    if (row.orderQty <= 0) continue;
    await prisma.sizeForecast.create({
      data: {
        year,
        campusId: row.campusId,
        skuId: row.skuId,
        size: row.size,
        suggestedBuy: row.orderQty,
        method: row.method,
      },
    });
  }

  revalidatePath("/sizes");
  revalidatePath("/analytics");
}
