import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { generateQrToken } from "@/lib/db/queries";

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    studentId?: string;
    regenerate?: boolean;
  };

  if (!body.studentId?.trim()) {
    return NextResponse.json(
      { error: "Field `studentId` is required" },
      { status: 400 },
    );
  }

  const result = await generateQrToken({
    studentId: body.studentId.trim(),
    regenerate: body.regenerate ?? false,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(
    {
      token: result.token,
      code: result.code,
      created: result.created,
      student: result.student,
    },
    { status: result.created ? 201 : 200 },
  );
}
