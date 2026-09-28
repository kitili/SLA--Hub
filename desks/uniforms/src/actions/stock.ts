"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { makeRef } from "@/lib/refs";
import { applyMove, StockError } from "@/lib/stock";
import { fail } from "@/lib/form";
import { writeAudit } from "@/lib/audit";

export async function adjustStock(formData: FormData) {
  const user = await requireUser(["STORE"]);
  const locationId = String(formData.get("locationId") ?? "");
  const skuId = String(formData.get("skuId") ?? "");
  const size = String(formData.get("size") ?? "");
  const qty = Number.parseInt(String(formData.get("qty") ?? "0"), 10);
  const note = String(formData.get("note") ?? "").trim();
  if (!locationId || !skuId || !size || !qty || !note) {
    await fail("Location, SKU, size, qty, and a reason are required.");
  }
  const ref = makeRef("ADJ");
  try {
    await prisma.$transaction(async (tx) => {
      await applyMove(tx, {
        locationId,
        skuId,
        size,
        qty,
        reason: "ADJUST",
        ref,
        note: `${note} · by ${user.name}`,
      });
    });
  } catch (err) {
    await fail(err instanceof StockError ? err.message : "Adjust failed.");
  }
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "ADJUST",
    entity: "Stock",
    ref,
    note,
  });
  revalidatePath("/stock");
  revalidatePath("/stock/moves");
  revalidatePath("/audit");
}

export async function transferToShop(formData: FormData) {
  const user = await requireUser(["STORE", "TAILOR"]);
  const skuId = String(formData.get("skuId") ?? "");
  const size = String(formData.get("size") ?? "");
  const qty = Number.parseInt(String(formData.get("qty") ?? "0"), 10);
  if (!skuId || !size || qty <= 0) await fail("SKU, size, and qty required.");

  const main = await prisma.location.findUnique({ where: { code: "MAIN" } });
  const shop = await prisma.location.findUnique({ where: { code: "SHOP_USA" } });
  if (!main || !shop) return fail("Warehouses missing.");
  const ref = makeRef("XFR");
  try {
    await prisma.$transaction(async (tx) => {
      await applyMove(tx, {
        locationId: main.id,
        skuId,
        size,
        qty: -qty,
        reason: "TRANSFER_OUT",
        ref,
        note: "MAIN → SHOP_USA",
      });
      await applyMove(tx, {
        locationId: shop.id,
        skuId,
        size,
        qty,
        reason: "TRANSFER_IN",
        ref,
        note: "MAIN → SHOP_USA",
      });
    });
  } catch (err) {
    await fail(err instanceof StockError ? err.message : "Transfer failed.");
  }
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "TRANSFER",
    entity: "Stock",
    ref,
    note: `MAIN → SHOP_USA ${qty} ${size}`,
  });
  revalidatePath("/stock");
  revalidatePath("/purchase-orders");
  revalidatePath("/audit");
}

export async function reverseStockAdjust(formData: FormData) {
  const user = await requireUser(["STORE"]);
  const moveId = String(formData.get("moveId") ?? "");
  const move = await prisma.stockMove.findUnique({
    where: { id: moveId },
    include: { sku: true, location: true },
  });
  if (!move) return fail("Move not found.");
  if (move.reason !== "ADJUST") return fail("Only manual adjustments can be reversed.");

  const ref = makeRef("REV");
  try {
    await prisma.$transaction(async (tx) => {
      await applyMove(tx, {
        locationId: move.locationId,
        skuId: move.skuId,
        size: move.size,
        qty: -move.qty,
        reason: "ADJUST",
        ref,
        note: `Reverse ${move.ref} · ${user.name}`,
      });
    });
  } catch (err) {
    await fail(err instanceof StockError ? err.message : "Reverse failed.");
  }

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "ADJUST",
    entity: "Stock",
    ref,
    note: `Reversed ${move.ref} (${move.sku.code} ${move.size})`,
  });
  revalidatePath("/stock");
  revalidatePath("/stock/moves");
  revalidatePath("/audit");
}
