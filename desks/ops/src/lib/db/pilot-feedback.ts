import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

export type FeedbackStatus = "open" | "in_progress" | "done";

export type PilotFeedback = {
  id: string;
  submitted_by: string | null;
  submitted_by_label: string;
  department: string;
  page_path: string;
  message: string;
  status: FeedbackStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT =
  "id, submitted_by, submitted_by_label, department, page_path, message, status, resolved_by, resolved_at, created_at, updated_at";

export async function createPilotFeedback(input: {
  submittedBy: string;
  submittedByLabel: string;
  department: string;
  pagePath: string;
  message: string;
}): Promise<{ feedback: PilotFeedback } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pilot_feedback")
    .insert({
      submitted_by: input.submittedBy,
      submitted_by_label: input.submittedByLabel,
      department: input.department,
      page_path: input.pagePath,
      message: input.message.trim(),
    })
    .select(SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to submit feedback" };
  return { feedback: data as PilotFeedback };
}

export async function listAllPilotFeedback(input?: {
  department?: string;
  status?: FeedbackStatus;
}): Promise<PilotFeedback[]> {
  const supabase = await createClient();
  let q = supabase.from("pilot_feedback").select(SELECT).order("created_at", { ascending: false });
  if (input?.department) q = q.eq("department", input.department);
  if (input?.status) q = q.eq("status", input.status);
  const { data, error } = await q;
  if (error || !data) return [];
  return data as PilotFeedback[];
}

export async function listMyPilotFeedback(userId: string): Promise<PilotFeedback[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pilot_feedback")
    .select(SELECT)
    .eq("submitted_by", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as PilotFeedback[];
}

export async function updatePilotFeedbackStatus(
  id: string,
  status: FeedbackStatus,
  resolvedBy: string | null,
): Promise<{ feedback: PilotFeedback } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "done") {
    update.resolved_by = resolvedBy;
    update.resolved_at = new Date().toISOString();
  } else {
    update.resolved_by = null;
    update.resolved_at = null;
  }
  const { data, error } = await supabase
    .from("pilot_feedback")
    .update(update)
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update feedback" };
  return { feedback: data as PilotFeedback };
}

/** After a ship: close every item that is still open or in progress. */
export async function markOpenPilotFeedbackDone(
  resolvedBy: string | null,
): Promise<{ feedback: PilotFeedback[] } | { error: string }> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("pilot_feedback")
    .update({
      status: "done",
      resolved_by: resolvedBy,
      resolved_at: now,
      updated_at: now,
    })
    .in("status", ["open", "in_progress"])
    .select(SELECT);
  if (error) return { error: error.message };
  return { feedback: (data ?? []) as PilotFeedback[] };
}
