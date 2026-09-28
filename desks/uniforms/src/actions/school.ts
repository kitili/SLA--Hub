"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isSchoolAdmin, writeSchoolCookie } from "@/lib/campus-scope";

function safePath(next: string) {
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) return "/desk";
  return next;
}

export async function setSchoolFilter(formData: FormData) {
  const user = await requireUser();
  if (!isSchoolAdmin(user)) redirect("/desk");
  await writeSchoolCookie(String(formData.get("campus") ?? ""));
  const next = safePath(String(formData.get("next") ?? "/desk"));
  // The scoped pages key off this cookie, which Next's client router cache
  // doesn't account for — without this, switching campuses can briefly
  // redirect into a stale, more-permissive cached render of `next` until a
  // hard reload (verified: shows the previous campus's data too, until refresh).
  revalidatePath(next);
  redirect(next);
}
