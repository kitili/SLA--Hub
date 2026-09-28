"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/form";
import { parseTzs } from "@/lib/money";
import { prisma } from "@/lib/prisma";

function refreshPlan() {
  revalidatePath("/sizes");
  revalidatePath("/finance");
  revalidatePath("/analytics");
  revalidatePath("/reports");
}

// Upserts by campusId+year+className instead of only updating an existing
// row's id — that's the only way a brand-new year, or a campus/class
// combination that never had a row, can ever get one without a direct DB
// edit. Skips creating a real row for cells nobody touched (still 0, never
// existed) so saving a mostly-blank form doesn't bulk-create empty rows.
export async function saveEnrolment(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const year = Number.parseInt(String(formData.get("year") ?? "2027"), 10);
  if (!year || year < 2000) await fail("Enter a real year.");
  const campusIds = formData.getAll("campusId").map(String);
  const classNames = formData.getAll("className").map(String);
  const heads = formData.getAll("heads").map((v) => Number.parseInt(String(v), 10));
  if (!campusIds.length) await fail("No enrolment rows.");

  let changed = 0;
  for (let i = 0; i < campusIds.length; i += 1) {
    const campusId = campusIds[i];
    const className = classNames[i];
    if (!campusId || !className) continue;
    const expectedHeadcount = Number.isFinite(heads[i]) ? Math.max(0, heads[i]) : 0;
    const existing = await prisma.campusEnrolment.findUnique({
      where: { campusId_year_className: { campusId, year, className } },
    });
    if (existing && existing.expectedHeadcount === expectedHeadcount) continue;
    if (!existing && expectedHeadcount === 0) continue;
    await prisma.campusEnrolment.upsert({
      where: { campusId_year_className: { campusId, year, className } },
      update: { expectedHeadcount },
      create: { campusId, year, className, expectedHeadcount },
    });
    changed += 1;
  }

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPSERT",
    entity: "CampusEnrolment",
    ref: String(year),
    note: `Updated ${changed} class headcounts`,
  });
  refreshPlan();
}

export async function savePrices(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const skuIds = formData.getAll("skuId").map(String);
  const buys = formData.getAll("buyTzs").map((v) => parseTzs(v));
  const sells = formData.getAll("sellTzs").map((v) => parseTzs(v));
  if (!skuIds.length) await fail("No SKUs.");

  let changed = 0;
  for (let i = 0; i < skuIds.length; i += 1) {
    const buyTzs = Math.max(0, buys[i] ?? 0);
    const sellTzs = Math.max(0, sells[i] ?? 0);
    const sku = await prisma.sku.findUnique({ where: { id: skuIds[i] } });
    if (!sku) continue;
    if (sku.buyTzs === buyTzs && sku.sellTzs === sellTzs) continue;
    await prisma.sku.update({
      where: { id: sku.id },
      data: { buyTzs, sellTzs },
    });
    changed += 1;
  }

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPDATE",
    entity: "Sku",
    note: `Updated ${changed} buy/sell prices`,
  });
  refreshPlan();
}
