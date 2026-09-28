"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/form";
import { writeAudit } from "@/lib/audit";

export async function createGarmentRecipe(formData: FormData) {
  const user = await requireUser(["STORE", "TAILOR"]);
  const skuId = String(formData.get("skuId") ?? "");
  const size = String(formData.get("size") ?? "").trim();
  const materialKind = String(formData.get("materialKind") ?? "FABRIC");
  const materialName = String(formData.get("materialName") ?? "").trim();
  const qtyPerPiece = Number.parseInt(String(formData.get("qtyPerPiece") ?? "0"), 10);
  const unit = String(formData.get("unit") ?? "cm").trim() || "cm";
  if (!skuId || !size || !materialName || qtyPerPiece <= 0) {
    await fail("SKU, size, material name, and qty per piece are required.");
  }

  const existing = await prisma.garmentRecipe.findUnique({
    where: { skuId_size_materialKind_materialName: { skuId, size, materialKind, materialName } },
  });
  if (existing) {
    await fail(`A recipe for this SKU/size/material already exists — edit it instead of adding a duplicate.`);
  }

  const sku = await prisma.sku.findUnique({ where: { id: skuId } });
  if (!sku) await fail("SKU not found.");

  const recipe = await prisma.garmentRecipe.create({
    data: { skuId, size, materialKind, materialName, qtyPerPiece, unit },
  });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "CREATE",
    entity: "GarmentRecipe",
    entityId: recipe.id,
    ref: `${sku.code} ${size}`,
    note: `${materialName} · ${qtyPerPiece} ${unit}/piece`,
  });
  revalidatePath("/slm");
  revalidatePath("/sewing");
  revalidatePath("/alerts");
  revalidatePath("/audit");
}

export async function updateGarmentRecipe(formData: FormData) {
  const user = await requireUser(["STORE", "TAILOR"]);
  const recipeId = String(formData.get("recipeId") ?? "");
  const materialName = String(formData.get("materialName") ?? "").trim();
  const qtyPerPiece = Number.parseInt(String(formData.get("qtyPerPiece") ?? "0"), 10);
  const unit = String(formData.get("unit") ?? "cm").trim() || "cm";
  if (!materialName || qtyPerPiece <= 0) await fail("Material name and qty per piece are required.");

  const recipe = await prisma.garmentRecipe.findUnique({ where: { id: recipeId }, include: { sku: true } });
  if (!recipe) await fail("Recipe not found.");

  await prisma.garmentRecipe.update({
    where: { id: recipeId },
    data: { materialName, qtyPerPiece, unit },
  });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPDATE",
    entity: "GarmentRecipe",
    entityId: recipeId,
    ref: `${recipe.sku.code} ${recipe.size}`,
    note: `${materialName} · ${qtyPerPiece} ${unit}/piece`,
  });
  revalidatePath("/slm");
  revalidatePath("/sewing");
  revalidatePath("/alerts");
  revalidatePath("/audit");
}
