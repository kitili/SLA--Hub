"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/form";
import { writeAudit } from "@/lib/audit";

// A real identity for casual/subcontracted tailors, so labour payments have
// somewhere structured to point instead of free text — see the Payee model
// comment in schema.prisma for why this exists (the old spreadsheet's tailor
// identity was 23 spellings of ~3 people, with pay sometimes routed through
// someone else's mobile money entirely).
export async function createPayee(formData: FormData) {
  const user = await requireUser(["TAILOR", "STORE", "FINANCE"]);
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const payNote = String(formData.get("payNote") ?? "").trim();
  if (!name) return fail("Name is required.");

  const payee = await prisma.payee.create({ data: { name, phone, payNote } });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "CREATE",
    entity: "Payee",
    entityId: payee.id,
    note: name,
  });
  revalidatePath("/slm");
}

// Phone/pay-note are just contact metadata, not part of the historical
// record the way a name is (Expense only stores payeeId, so a name change
// would silently reword every past expense's payee — see deactivatePayee's
// reasoning below for why name itself stays fixed once created).
export async function updatePayee(formData: FormData) {
  const user = await requireUser(["TAILOR", "STORE", "FINANCE"]);
  const id = String(formData.get("payeeId") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();
  const payNote = String(formData.get("payNote") ?? "").trim();
  const payee = await prisma.payee.findUnique({ where: { id } });
  if (!payee) return fail("Payee not found.");

  await prisma.payee.update({ where: { id }, data: { phone, payNote } });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPDATE",
    entity: "Payee",
    entityId: id,
    note: `Contact details updated for ${payee.name}`,
  });
  revalidatePath("/slm");
}

// Soft-deactivate, not delete — mirrors retireSku's reasoning: a payee may
// already be referenced by real Expense history, and hiding it from the
// picker going forward shouldn't erase that history. If the name was wrong,
// deactivate this one and create a correct one rather than editing it, so
// past expenses still show exactly what was recorded at the time.
export async function deactivatePayee(formData: FormData) {
  const user = await requireUser(["TAILOR", "STORE", "FINANCE"]);
  const id = String(formData.get("payeeId") ?? "");
  const payee = await prisma.payee.findUnique({ where: { id } });
  if (!payee) return fail("Payee not found.");

  await prisma.payee.update({ where: { id }, data: { active: false } });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPDATE",
    entity: "Payee",
    entityId: id,
    note: `Deactivated ${payee.name}`,
  });
  revalidatePath("/slm");
}

export async function reactivatePayee(formData: FormData) {
  const user = await requireUser(["TAILOR", "STORE", "FINANCE"]);
  const id = String(formData.get("payeeId") ?? "");
  const payee = await prisma.payee.findUnique({ where: { id } });
  if (!payee) return fail("Payee not found.");

  await prisma.payee.update({ where: { id }, data: { active: true } });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPDATE",
    entity: "Payee",
    entityId: id,
    note: `Reactivated ${payee.name}`,
  });
  revalidatePath("/slm");
}
