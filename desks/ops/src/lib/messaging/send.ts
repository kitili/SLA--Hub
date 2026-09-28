import { createClient } from "@/lib/supabase/server";
import { getMessagingProvider } from "@/lib/messaging/provider";
import type { MessageLog, MessageStatus } from "@/types/messaging";

export type SendAndLogInput = {
  to: string;
  body: string;
  studentId?: string | null;
  boardingEventId?: string | null;
  templateKey?: string;
  createdBy?: string | null;
};

export type SendAndLogResult = {
  log: MessageLog;
  stubbed: boolean;
};

export async function sendAndLogMessage(
  input: SendAndLogInput,
): Promise<SendAndLogResult> {
  const supabase = await createClient();
  const provider = getMessagingProvider();
  const phone = input.to.trim();

  if (!phone) {
    const skipped = await insertLog(supabase, {
      student_id: input.studentId ?? null,
      parent_phone: "(none)",
      channel: "stub",
      provider: provider.name,
      template_key: input.templateKey ?? null,
      body: input.body,
      status: "skipped",
      provider_message_id: null,
      error_message: "No parent phone on file",
      boarding_event_id: input.boardingEventId ?? null,
      created_by: input.createdBy ?? null,
      sent_at: null,
    });
    return { log: skipped, stubbed: true };
  }

  const { data: queued, error: queueError } = await supabase
    .from("message_logs")
    .insert({
      student_id: input.studentId ?? null,
      parent_phone: phone,
      channel: provider.name === "stub" ? "stub" : "sms",
      provider: provider.name,
      template_key: input.templateKey ?? null,
      body: input.body,
      status: "queued",
      boarding_event_id: input.boardingEventId ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();

  if (queueError || !queued) {
    throw new Error(queueError?.message ?? "Failed to queue message_log");
  }

  const sendResult = await provider.send({ to: phone, body: input.body });
  const status: MessageStatus = sendResult.ok
    ? "sent"
    : sendResult.stubbed
      ? "sent"
      : "failed";

  const { data: finished, error: finishError } = await supabase
    .from("message_logs")
    .update({
      status,
      channel: sendResult.channel,
      provider: sendResult.provider,
      provider_message_id: sendResult.providerMessageId ?? null,
      error_message: sendResult.ok
        ? sendResult.stubbed
          ? "Delivered via stub (no AFRICASTALKING_* keys)"
          : null
        : (sendResult.error ?? "Send failed"),
      sent_at: sendResult.ok ? new Date().toISOString() : null,
    })
    .eq("id", queued.id)
    .select("*")
    .single();

  if (finishError || !finished) {
    throw new Error(finishError?.message ?? "Failed to update message_log");
  }

  return {
    log: mapLog(finished),
    stubbed: Boolean(sendResult.stubbed) || provider.name === "stub",
  };
}

export async function listMessageLogs(options?: {
  since?: string;
  limit?: number;
}): Promise<MessageLog[]> {
  const supabase = await createClient();
  const limit = options?.limit ?? 50;
  let query = supabase
    .from("message_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options?.since) {
    query = query.gte("created_at", options.since);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapLog);
}

async function insertLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: Omit<MessageLog, "id" | "created_at"> & {
    id?: string;
    created_at?: string;
  },
): Promise<MessageLog> {
  const { data, error } = await supabase
    .from("message_logs")
    .insert(row)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to insert message_log");
  }
  return mapLog(data);
}

function mapLog(row: Record<string, unknown>): MessageLog {
  return {
    id: String(row.id),
    student_id: (row.student_id as string | null) ?? null,
    parent_phone: String(row.parent_phone),
    channel: row.channel as MessageLog["channel"],
    provider: String(row.provider),
    template_key: (row.template_key as string | null) ?? null,
    body: String(row.body),
    status: row.status as MessageStatus,
    provider_message_id: (row.provider_message_id as string | null) ?? null,
    error_message: (row.error_message as string | null) ?? null,
    boarding_event_id: (row.boarding_event_id as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at),
    sent_at: (row.sent_at as string | null) ?? null,
  };
}
