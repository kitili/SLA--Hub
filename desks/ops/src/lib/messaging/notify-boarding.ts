import { sendAndLogMessage } from "@/lib/messaging/send";
import type {
  BoardingEventType,
  StudentWithDetails,
  TripDirection,
} from "@/types/database";
import type { ParentNotifyResult } from "@/types/messaging";

/**
 * Day 6: notify primary parent after a successful time-in.
 * 2026-09-07: also notify on time-out, but ONLY on the PM (drop-off) leg --
 * previously "out" was skipped unconditionally, which on PM trips meant
 * "parent gets a (mislabeled) text on every scan" became "parent gets
 * nothing" once the in/out labeling bug was fixed elsewhere. Parents rely
 * on this to know their child made it off the bus, so silence there isn't
 * acceptable.
 *
 * Deliberately kept symmetric and narrow: only the event type that's
 * *natural* for the direction triggers a text (AM -> "in", PM -> "out").
 * An AM "out" (arrival at school) stays silent -- AFRICASTALKING_API_KEY is
 * live-configured here, so notifying on it would be a real, unrequested SMS
 * volume/cost increase on a path nobody asked to change. A PM "in" (only
 * reachable via a stray double-scan on the return leg, since matrons scan
 * once per child there) also stays silent, rather than sending a confusing
 * "boarded the bus" text about a child who was just marked dropped off.
 * Uses Africa's Talking when configured; otherwise stubs and still writes message_logs.
 */
export async function notifyParentOnBoarding(input: {
  student: StudentWithDetails;
  eventType: BoardingEventType;
  direction: TripDirection;
  boardingEventId: string;
  stopName?: string | null;
  createdBy?: string | null;
}): Promise<ParentNotifyResult> {
  const naturalEventType: BoardingEventType =
    input.direction === "pm" ? "out" : "in";
  if (input.eventType !== naturalEventType) {
    return {
      notified: false,
      status: "skipped",
      channel: "stub",
      provider: "none",
      message_log_id: null,
      error:
        input.direction === "pm"
          ? "Parent notify only on time-out for PM trips"
          : "Parent notify only on time-in for AM trips",
    };
  }

  const phone = input.student.parent_phone?.trim();
  if (!phone) {
    return {
      notified: false,
      status: "skipped",
      channel: "stub",
      provider: "none",
      message_log_id: null,
      error: "No parent phone on file",
    };
  }

  const name = `${input.student.first_name} ${input.student.last_name}`.trim();
  const school = input.student.school_name ?? "school";

  let body: string;
  let templateKey: string;
  if (input.eventType === "in") {
    const feeLine =
      input.student.fee_balance > 0
        ? ` Transport balance: ${input.student.fee_currency} ${Number(
            input.student.fee_balance,
          ).toLocaleString()}.`
        : "";
    body = `Silverleaf Transport: ${name} boarded the bus (${school}).${feeLine}`;
    templateKey = "boarding_time_in";
  } else {
    body = `Silverleaf Transport: ${name} was dropped off${
      input.stopName ? ` at ${input.stopName}` : ""
    }.`;
    templateKey = "boarding_time_out";
  }

  try {
    const { log, stubbed } = await sendAndLogMessage({
      to: phone,
      body,
      studentId: input.student.id,
      boardingEventId: input.boardingEventId,
      templateKey,
      createdBy: input.createdBy ?? null,
    });

    return {
      notified: log.status === "sent",
      status: log.status,
      channel: log.channel,
      provider: log.provider,
      message_log_id: log.id,
      error: stubbed
        ? "Stubbed — set AFRICASTALKING_API_KEY + AFRICASTALKING_USERNAME for live SMS"
        : log.error_message ?? undefined,
    };
  } catch (err) {
    return {
      notified: false,
      status: "failed",
      channel: "sms",
      provider: "unknown",
      message_log_id: null,
      error: err instanceof Error ? err.message : "Notify failed",
    };
  }
}
