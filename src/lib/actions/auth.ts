"use server";

import { eq } from "drizzle-orm";
import { getCurrentUser, signOut } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { staff } from "@/lib/db/schema";
import { findStaffWithSimilarName, listStaffEmails, updateStaffEmail } from "@/lib/db/repositories/staff";
import {
  parseUniqueWorkEmail,
  suggestWorkEmailFromName,
} from "@/lib/email";

export type SetNameResult =
  | { ok: true }
  | { ok: false; error: string }
  | {
      ok: false;
      error: "similar-name";
      suggestion: string;
    };

function emailLooksShared(email: string): boolean {
  const local = email.split("@")[0] ?? "";
  return !local.includes(".") && !local.includes("_") && !local.includes("-");
}

export async function setNameAction(
  fullName: string,
): Promise<SetNameResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  const name = fullName.trim();
  if (name.length < 2) return { ok: false, error: "Enter your name." };
  if (name.length > 120) return { ok: false, error: "Name is too long." };

  const similar = await findStaffWithSimilarName(name, user.id);
  const taken = new Set(await listStaffEmails());
  const suggestion = suggestWorkEmailFromName(name, taken);

  if (similar.length > 0 && emailLooksShared(user.email)) {
    await db
      .update(staff)
      .set({ fullName: name, lastActiveAt: new Date() })
      .where(eq(staff.id, user.id));
    return { ok: false, error: "similar-name", suggestion };
  }

  await db
    .update(staff)
    .set({ fullName: name, lastActiveAt: new Date() })
    .where(eq(staff.id, user.id));
  return { ok: true };
}

export async function claimUniqueUsernameAction(
  username: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };

  const email = parseUniqueWorkEmail(username);
  if (!email) {
    return {
      ok: false,
      error: "Pick a unique work email that ends with @silverleaf.co.tz, e.g. paul.kimaro@silverleaf.co.tz.",
    };
  }

  if (email === user.email) {
    return { ok: true };
  }

  const updated = await updateStaffEmail(user.id, email);
  if (!updated) {
    return {
      ok: false,
      error: "That work email is already used by someone else. Try firstname.lastname@silverleaf.co.tz.",
    };
  }
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  await signOut();
}
