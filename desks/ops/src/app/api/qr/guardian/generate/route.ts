import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { generateGuardianQrToken, getStudentsForSession } from "@/lib/db/queries";

/**
 * POST /api/qr/guardian/generate
 * Unlike /api/qr/generate (admin-only student QR), this is staff-wide —
 * matrons generate it directly on the student detail page, the same
 * place they already edit parent contact info, and admin can't reach
 * that page at all since /matron/* is blocked for the admin role.
 */
export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport", "matron", "driver"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    studentId?: string;
    regenerate?: boolean;
  };

  const studentId = body.studentId?.trim();
  if (!studentId) {
    return NextResponse.json(
      { error: "Field `studentId` is required" },
      { status: 400 },
    );
  }

  if (!auth.role) {
    return NextResponse.json({ error: "No role on session" }, { status: 403 });
  }

  // Re-check against her own bus scope — a matron's UI only ever shows
  // students on her bus, but this endpoint could be called directly.
  const { students } = await getStudentsForSession({
    userId: auth.userId,
    role: auth.role,
  });
  if (!students.some((s) => s.id === studentId)) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const result = await generateGuardianQrToken({
    studentId,
    regenerate: body.regenerate ?? false,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(
    {
      token: result.token,
      code: result.code,
      parent: result.parent,
      created: result.created,
    },
    { status: result.created ? 201 : 200 },
  );
}
