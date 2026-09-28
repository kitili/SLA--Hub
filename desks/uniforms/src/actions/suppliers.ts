"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/form";
import { writeAudit } from "@/lib/audit";

export async function createSupplier(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const city = String(formData.get("city") ?? "Arusha").trim() || "Arusha";
  if (!name) await fail("Supplier name is required.");

  const supplier = await prisma.supplier.create({ data: { name, phone, contact, city } });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "CREATE",
    entity: "Supplier",
    entityId: supplier.id,
    ref: supplier.name,
  });
  revalidatePath("/purchase-orders");
  revalidatePath("/alerts");
  revalidatePath("/distribution");
  revalidatePath("/audit");
}

export async function updateSupplier(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const supplierId = String(formData.get("supplierId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const city = String(formData.get("city") ?? "Arusha").trim() || "Arusha";
  if (!name) await fail("Supplier name is required.");

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) await fail("Supplier not found.");

  await prisma.supplier.update({ where: { id: supplierId }, data: { name, phone, contact, city } });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPDATE",
    entity: "Supplier",
    entityId: supplierId,
    ref: supplier.name,
    note: name !== supplier.name ? `Renamed to ${name}` : "Details updated",
  });
  revalidatePath("/purchase-orders");
  revalidatePath("/alerts");
  revalidatePath("/distribution");
  revalidatePath("/audit");
}
