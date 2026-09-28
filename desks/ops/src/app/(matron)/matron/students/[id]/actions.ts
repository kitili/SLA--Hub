"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { getStudentsForSession, upsertParentContact } from "@/lib/db/queries";

export async function saveParentContact(formData: FormData) {
  const session = await getSessionProfile();
  if (!session) redirect("/");

  const studentId = String(formData.get("student_id") ?? "").trim();
  const fullName = String(formData.get("parent_name") ?? "").trim();
  const phone = String(formData.get("parent_phone") ?? "").trim();
  const email = String(formData.get("parent_email") ?? "").trim();

  if (!studentId || !fullName) return;

  // Re-check against her own scope server-side — the page already 404s for
  // students outside it, but a form POST could be crafted to skip the page.
  const { students } = await getStudentsForSession(session);
  const allowed = students.some((s) => s.id === studentId);
  if (!allowed) return;

  await upsertParentContact({
    studentId,
    fullName,
    phone: phone || null,
    email: email || null,
  });

  revalidatePath(`/matron/students/${studentId}`);
}
