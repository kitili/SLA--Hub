import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createStudent, getStudents } from "@/lib/db/queries";

export async function GET() {
  const auth = await requireUser(["admin", "transport", "matron", "driver", "finance"]);
  if ("response" in auth) return auth.response;

  const students = await getStudents();
  return NextResponse.json({ students });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    firstName?: string;
    lastName?: string;
    className?: string;
    parentName?: string;
    parentPhone?: string;
    feeBalance?: number;
    feeCurrency?: string;
  };

  if (
    !body.schoolId?.trim() ||
    !body.firstName?.trim() ||
    !body.lastName?.trim() ||
    !body.parentName?.trim() ||
    !body.parentPhone?.trim() ||
    typeof body.feeBalance !== "number" ||
    !Number.isFinite(body.feeBalance)
  ) {
    return NextResponse.json(
      {
        error:
          "schoolId, firstName, lastName, parentName, parentPhone and feeBalance are all required",
      },
      { status: 400 },
    );
  }

  const outcome = await createStudent({
    schoolId: body.schoolId.trim(),
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    className: body.className,
    parentName: body.parentName,
    parentPhone: body.parentPhone,
    feeBalance:
      typeof body.feeBalance === "number" && Number.isFinite(body.feeBalance)
        ? body.feeBalance
        : undefined,
    feeCurrency: body.feeCurrency,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ student: outcome.student }, { status: 201 });
}
