"use server";

import { eq } from "drizzle-orm";
import { getCurrentUser, signOut } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { staff } from "@/lib/db/schema";

export async function setNameAction(
  fullName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  const name = fullName.trim();
  if (name.length < 2) return { ok: false, error: "Enter your name." };
  await db
    .update(staff)
    .set({ fullName: name, lastActiveAt: new Date() })
    .where(eq(staff.id, user.id));
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  await signOut();
}
