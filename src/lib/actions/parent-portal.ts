"use server";

import { cookies, headers } from "next/headers";
import { takeToken } from "@/lib/security/rate-limit";
import {
  encodeDemoParentSession,
  encodeParentSession,
  parentCookieName,
  parentCookieOptions,
} from "@/lib/parent-portal/session";
import { familyRegisterError } from "@/lib/parent-portal/db";
import { findParentIds, phoneKey } from "@/lib/parent-portal/household";

export type ParentSignInResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "not-found" | "rate-limited" | "unavailable" };

export async function signInParentAction(phone: string): Promise<ParentSignInResult> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!takeToken(`parent-signin:${ip}`, 40, 15 * 60_000)) {
    return { ok: false, error: "rate-limited" };
  }

  const key = phoneKey(phone);
  if (!key) return { ok: false, error: "invalid" };
  if (!takeToken(`parent-phone:${key}`, 15, 15 * 60_000)) {
    return { ok: false, error: "rate-limited" };
  }

  let parentIds: string[] | null;
  try {
    parentIds = await findParentIds(key);
  } catch (error) {
    console.error("[parents] register lookup failed:", familyRegisterError(error));
    return { ok: false, error: "unavailable" };
  }
  if (parentIds === null) return { ok: false, error: "unavailable" };
  if (parentIds.length === 0) return { ok: false, error: "not-found" };

  const jar = await cookies();
  jar.set(parentCookieName(), await encodeParentSession(parentIds), parentCookieOptions());
  return { ok: true };
}

export async function signInTestParentAction(): Promise<ParentSignInResult> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!takeToken(`parent-test:${ip}`, 30, 15 * 60_000)) {
    return { ok: false, error: "rate-limited" };
  }
  const jar = await cookies();
  jar.set(parentCookieName(), await encodeDemoParentSession(), parentCookieOptions());
  return { ok: true };
}

export async function signOutParentAction() {
  const jar = await cookies();
  jar.set(parentCookieName(), "", { ...parentCookieOptions(), maxAge: 0 });
}
