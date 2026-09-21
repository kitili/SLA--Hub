"use server";

import { eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { staff } from "@/lib/db/schema";

export type SetNameResult =
  | { ok: true }
  | { ok: false; error: string };

export async function setNameAction(fullName: string): Promise<SetNameResult> {
  const user = await requireUser();
  const trimmed = fullName.trim();

  if (trimmed.length < 2) {
    return { ok: false, error: "Please enter your full name (at least 2 characters)." };
  }
  if (trimmed.length > 120) {
    return { ok: false, error: "Name is too long." };
  }

  await db
    .update(staff)
    .set({ fullName: trimmed, lastActiveAt: new Date() })
    .where(eq(staff.id, user.id));

  return { ok: true };
}
