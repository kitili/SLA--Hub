import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { recordBoarding, resolveStudentByQr } from "@/lib/db/queries";
import { buildFeeCheck } from "@/lib/fees/fee-check";
import { notifyParentOnBoarding } from "@/lib/messaging/notify-boarding";
import type { BoardingEventType } from "@/types/database";

/**
 * POST /api/boarding
 * Day 4: write time-in / time-out; reject duplicates.
 * Day 5: include fee balance on the success response.
 * Day 6: notify parent on time-in (Africa's Talking or stub) + message_logs.
 * Day 13: fee sync freshness check for matron.
 *
 * Body: { tripId, studentId? | code?, eventType?: "in"|"out", lat?, lng? }
 */
export async function POST(request: Request) {
  // Unified matron field app — QR boarding (legacy driver logins included).
  const auth = await requireUser(["admin", "matron", "driver"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    tripId?: string;
    studentId?: string;
    code?: string;
    eventType?: BoardingEventType;
    lat?: number | null;
    lng?: number | null;
    scannedAt?: string | null;
  };

  if (!body.tripId?.trim()) {
    return NextResponse.json({ error: "Field `tripId` is required" }, { status: 400 });
  }

  if (body.eventType && body.eventType !== "in" && body.eventType !== "out") {
    return NextResponse.json(
      { error: "Field `eventType` must be `in` or `out`" },
      { status: 400 },
    );
  }

  let studentId = body.studentId?.trim();

  if (!studentId && body.code?.trim()) {
    const resolved = await resolveStudentByQr(body.code.trim());
    if (!resolved) {
      return NextResponse.json(
        { error: "QR code not recognized" },
        { status: 404 },
      );
    }
    studentId = resolved.student.id;
  }

  if (!studentId) {
    return NextResponse.json(
      { error: "Provide `studentId` or `code`" },
      { status: 400 },
    );
  }

  const lat =
    typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
  const lng =
    typeof body.lng === "number" && Number.isFinite(body.lng) ? body.lng : null;

  const outcome = await recordBoarding({
    tripId: body.tripId.trim(),
    studentId,
    eventType: body.eventType,
    lat,
    lng,
    scannedBy: auth.userId,
    scannedAt: body.scannedAt ?? null,
  });

  if ("error" in outcome) {
    const status =
      outcome.code === "not_found"
        ? 404
        : outcome.code === "duplicate"
          ? 409
          : outcome.code === "forbidden"
            ? 403
            : outcome.code === "invalid"
              ? 400
              : 400;
    return NextResponse.json(
      { error: outcome.error, code: outcome.code },
      { status },
    );
  }

  const { result } = outcome;
  const fee_check = buildFeeCheck(result.fee);

  const parent_notify = await notifyParentOnBoarding({
    student: result.student,
    eventType: result.event.event_type,
    direction: result.direction,
    boardingEventId: result.event.id,
    stopName: result.stop?.name ?? null,
    createdBy: auth.userId,
  });

  return NextResponse.json(
    {
      event: result.event,
      student: {
        id: result.student.id,
        first_name: result.student.first_name,
        last_name: result.student.last_name,
        class_name: result.student.class_name,
        school_name: result.student.school_name,
      },
      stop: result.stop,
      fee: result.fee,
      fee_check,
      fee_balance: result.fee.balance,
      fee_currency: result.fee.currency,
      aboard_count: result.aboard_count,
      parent_notify,
    },
    { status: 201 },
  );
}
