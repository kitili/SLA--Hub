import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { updateStudent } from "@/lib/db/queries";

/** PATCH /api/students/:id — admin only, edits details / deactivates */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Admin only: the students RLS policy only lets is_admin() write anyway.
  const auth = await requireUser(["admin"]);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as {
    firstName?: string;
    lastName?: string;
    className?: string;
    active?: boolean;
    parentName?: string;
    parentPhone?: string;
    parentEmail?: string;
  };

  if (!body.firstName?.trim() || !body.lastName?.trim() || typeof body.active !== "boolean") {
    return NextResponse.json(
      { error: "firstName, lastName and active are required" },
      { status: 400 },
    );
  }

  // Parent is all-or-nothing: parents.phone is NOT NULL, so a name without
  // a phone can't be saved.
  const hasParentName = Boolean(body.parentName?.trim());
  const hasParentPhone = Boolean(body.parentPhone?.trim());
  if (hasParentName !== hasParentPhone) {
    return NextResponse.json(
      { error: "Parent name and parent phone must both be filled in" },
      { status: 400 },
    );
  }

  const outcome = await updateStudent({
    studentId: id,
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    className: body.className,
    active: body.active,
    parentName: body.parentName,
    parentPhone: body.parentPhone,
    parentEmail: body.parentEmail,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
