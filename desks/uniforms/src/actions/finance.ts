"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTzs } from "@/lib/money";
import { fail } from "@/lib/form";
import { writeAudit } from "@/lib/audit";

export async function setBudget(formData: FormData) {
  const user = await requireUser(["STORE", "FINANCE"]);
  const year = Number.parseInt(String(formData.get("year") ?? "0"), 10);
  const allocatedTzs = parseTzs(formData.get("allocatedTzs"));
  const name = String(formData.get("name") ?? "").trim() || `Uniform buying ${year}`;
  const currentYear = new Date().getFullYear();
  if (!year || year < 2000 || year > currentYear + 5) await fail("Enter a real year (up to 5 years ahead).");
  if (allocatedTzs <= 0) await fail("Enter a real budget amount.");
  // A sanity backstop, not a policy limit — catches a fat-fingered extra
  // zero, not a genuinely large real budget.
  if (allocatedTzs > 10_000_000_000) {
    await fail(`${allocatedTzs.toLocaleString()} TZS looks like a typo (over 10 billion) — double-check the amount.`);
  }

  const budget = await prisma.budget.upsert({
    where: { year },
    update: { name, allocatedTzs },
    create: { year, name, allocatedTzs },
  });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPSERT",
    entity: "Budget",
    entityId: budget.id,
    ref: String(year),
    note: `Set to ${allocatedTzs.toLocaleString()} TZS`,
  });
  revalidatePath("/finance");
  revalidatePath("/desk");
  revalidatePath("/sizes");
  revalidatePath("/audit");
}

export async function updateExpense(formData: FormData) {
  const user = await requireUser(["FINANCE", "STORE"]);
  const expenseId = String(formData.get("expenseId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const amountTzs = parseTzs(formData.get("amountTzs"));
  const note = String(formData.get("note") ?? "").trim();
  if (!expenseId || amountTzs <= 0) await fail("Expense and amount are required.");

  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return fail("Expense not found.");

  await prisma.expense.update({
    where: { id: expenseId },
    data: { kind, amountTzs, note },
  });

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "UPDATE",
    entity: "Expense",
    entityId: expenseId,
    ref: expense.note,
    note: "Finance-side correction only",
  });
  revalidatePath("/finance");
  revalidatePath("/audit");
}

export async function deleteExpense(formData: FormData) {
  const user = await requireUser(["FINANCE", "STORE"]);
  const expenseId = String(formData.get("expenseId") ?? "");
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return fail("Expense not found.");

  await prisma.expense.delete({ where: { id: expenseId } });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "DELETE",
    entity: "Expense",
    entityId: expenseId,
    ref: expense.note,
    note: "Finance-side removal only",
  });
  revalidatePath("/finance");
  revalidatePath("/audit");
}
