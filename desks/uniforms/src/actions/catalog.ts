"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTzs } from "@/lib/money";
import { fail } from "@/lib/form";
import { writeAudit } from "@/lib/audit";

function parseSizes(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createSku(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const colour = String(formData.get("colour") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();
  const gender = String(formData.get("gender") ?? "UNISEX");
  const buyTzs = parseTzs(formData.get("buyTzs"));
  const sellTzs = parseTzs(formData.get("sellTzs"));
  const sizes = parseSizes(String(formData.get("sizes") ?? ""));
  if (!code || !name || !colour || !kind || !sizes.length) {
    await fail("Code, name, colour, kind, and at least one size are required.");
  }
  if (buyTzs <= 0 || sellTzs <= 0) await fail("Buy and sell price must be real amounts.");

  const existing = await prisma.sku.findUnique({ where: { code } });
  if (existing) await fail(`${code} already exists.`);

  const sku = await prisma.sku.create({
    data: {
      code,
      name,
      colour,
      kind,
      gender,
      buyTzs,
      sellTzs,
      sizes: { create: sizes.map((size) => ({ size })) },
    },
  });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "CREATE",
    entity: "Sku",
    entityId: sku.id,
    ref: sku.code,
    note: `${name} · ${sizes.join(", ")}`,
  });
  revalidatePath("/catalog");
  revalidatePath("/orders");
  revalidatePath("/requests");
  revalidatePath("/purchase-orders");
  revalidatePath("/sewing");
  revalidatePath("/parent");
  revalidatePath("/audit");
}

// Sizes are additive-only here — a size already offered (and possibly
// already sold against) is never removed, since SkuSize has no soft-delete
// flag of its own to hide it without losing history. Retire the whole Sku
// instead if a size genuinely needs to stop being offered.
export async function updateSku(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const skuId = String(formData.get("skuId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const colour = String(formData.get("colour") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();
  const gender = String(formData.get("gender") ?? "UNISEX");
  const buyTzs = parseTzs(formData.get("buyTzs"));
  const sellTzs = parseTzs(formData.get("sellTzs"));
  const sizes = parseSizes(String(formData.get("sizes") ?? ""));
  if (!name || !colour || !kind || !sizes.length) {
    await fail("Name, colour, kind, and at least one size are required.");
  }
  if (buyTzs <= 0 || sellTzs <= 0) await fail("Buy and sell price must be real amounts.");

  const sku = await prisma.sku.findUnique({ where: { id: skuId }, include: { sizes: true } });
  if (!sku) await fail("Item not found.");

  const existingSizes = new Set(sku.sizes.map((s) => s.size));
  const newSizes = sizes.filter((s) => !existingSizes.has(s));

  await prisma.$transaction(async (tx) => {
    await tx.sku.update({ where: { id: skuId }, data: { name, colour, kind, gender, buyTzs, sellTzs } });
    if (newSizes.length) {
      await tx.skuSize.createMany({ data: newSizes.map((size) => ({ skuId, size })) });
    }
  });

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPDATE",
    entity: "Sku",
    entityId: skuId,
    ref: sku.code,
    note: newSizes.length ? `Updated · added sizes ${newSizes.join(", ")}` : "Updated",
  });
  revalidatePath("/catalog");
  revalidatePath("/orders");
  revalidatePath("/requests");
  revalidatePath("/purchase-orders");
  revalidatePath("/sewing");
  revalidatePath("/parent");
  revalidatePath("/audit");
}

// Soft-retire only — never a hard delete, since a Sku has required relations
// to ParentOrderLine/StockBalance/StockMove/etc. history that must survive.
// `active` gates the SKU pickers used when creating something NEW (walk-in
// coupons, campus requests, POs, sewing jobs, stock adjustments) — it does
// not touch past orders/stock/moves, which keep referencing this Sku exactly
// as before.
export async function retireSku(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const skuId = String(formData.get("skuId") ?? "");
  const sku = await prisma.sku.findUnique({ where: { id: skuId } });
  if (!sku) return fail("Item not found.");
  if (!sku.active) return fail(`${sku.code} is already retired.`);

  await prisma.sku.update({ where: { id: skuId }, data: { active: false } });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPDATE",
    entity: "Sku",
    entityId: skuId,
    ref: sku.code,
    note: `Retired ${sku.code}`,
  });
  revalidatePath("/catalog");
  revalidatePath("/orders");
  revalidatePath("/parent");
}

export async function reactivateSku(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const skuId = String(formData.get("skuId") ?? "");
  const sku = await prisma.sku.findUnique({ where: { id: skuId } });
  if (!sku) return fail("Item not found.");

  await prisma.sku.update({ where: { id: skuId }, data: { active: true } });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPDATE",
    entity: "Sku",
    entityId: skuId,
    ref: sku.code,
    note: `Reactivated ${sku.code}`,
  });
  revalidatePath("/catalog");
}
