import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { getStudentById } from "@/lib/db/queries";
import { listMessageLogs, sendAndLogMessage } from "@/lib/messaging/send";

/**
 * GET /api/messages — today's (or recent) message_logs for admin/Irene panels.
 * POST /api/messages — manual parent notify { studentId, body? }
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "transport", "finance", "matron"]);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "50");
  const todayOnly = searchParams.get("today") !== "0";

  const since = todayOnly
    ? new Date(new Date().toISOString().slice(0, 10)).toISOString()
    : undefined;

  const messages = await listMessageLogs({
    since,
    limit: Number.isFinite(limit) ? Math.min(limit, 200) : 50,
  });

  return NextResponse.json({ messages, count: messages.length });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport", "matron", "finance"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    studentId?: string;
    body?: string;
    phone?: string;
  };

  if (!body.studentId?.trim() && !body.phone?.trim()) {
    return NextResponse.json(
      { error: "Provide `studentId` or `phone`" },
      { status: 400 },
    );
  }

  let phone = body.phone?.trim();
  let studentId = body.studentId?.trim() ?? null;
  let studentName = "your child";

  if (studentId) {
    const student = await getStudentById(studentId);
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    studentName = `${student.first_name} ${student.last_name}`.trim();
    phone = phone || student.parent_phone || undefined;
    if (!phone) {
      return NextResponse.json(
        { error: "No parent phone on file for this student" },
        { status: 400 },
      );
    }
  }

  if (!phone) {
    return NextResponse.json({ error: "Phone is required" }, { status: 400 });
  }

  const text =
    body.body?.trim() ||
    `Silverleaf Transport update about ${studentName}.`;

  try {
    const { log, stubbed } = await sendAndLogMessage({
      to: phone,
      body: text,
      studentId,
      templateKey: "manual",
      createdBy: auth.userId,
    });

    return NextResponse.json(
      {
        message: log,
        stubbed,
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to send message",
      },
      { status: 500 },
    );
  }
}
