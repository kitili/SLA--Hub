"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  clearSessionCookie,
  sessionFromUser,
  setSessionCookie,
  toSessionUser,
  verifyPassword,
} from "@/lib/auth";
import { addSiblingByReg, loginOrCreateByReg, removeChildFromFamily } from "@/lib/family";
import { requireUser } from "@/lib/auth";
import { homeFor } from "@/lib/roles";
import { fail } from "@/lib/form";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SCHOOL_COOKIE } from "@/lib/constants";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email }, include: { campus: true } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect("/login?error=Invalid%20email%20or%20password");
  }
  const session = sessionFromUser(user);
  if (!session) redirect("/login?error=Account%20inactive");
  await setSessionCookie(session);
  redirect(homeFor(session.role));
}

export async function logoutAction() {
  await clearSessionCookie();
  const jar = await cookies();
  jar.set(SCHOOL_COOKIE, "", { path: "/", maxAge: 0 });
  redirect("/login");
}

export async function parentLoginAction(formData: FormData) {
  const result = await loginOrCreateByReg(String(formData.get("regNo") ?? ""));
  if ("error" in result) {
    redirect(`/login?error=${encodeURIComponent(result.error ?? "Could not open parent account")}`);
  }
  const session = await toSessionUser(result.userId);
  if (!session) redirect("/login?error=Account%20inactive");
  await setSessionCookie(session);
  redirect("/parent");
}

export async function addSiblingAction(formData: FormData) {
  const user = await requireUser(["PARENT"]);
  const result = await addSiblingByReg(user.id, String(formData.get("regNo") ?? ""));
  if ("error" in result) await fail(result.error ?? "Could not add sibling");
  const session = await toSessionUser(user.id);
  if (session) await setSessionCookie(session);
  revalidatePath("/parent");
}

export async function removeSiblingAction(formData: FormData) {
  const user = await requireUser(["PARENT"]);
  const studentId = String(formData.get("studentId") ?? "");
  const result = await removeChildFromFamily(user.id, studentId);
  if ("error" in result) await fail(result.error ?? "Could not remove child");
  const session = await toSessionUser(user.id);
  if (session) await setSessionCookie(session);
  revalidatePath("/parent");
}
