import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listAllPilotFeedback } from "@/lib/db/pilot-feedback";
import { listProfileLabels } from "@/lib/db/profile-labels";
import { FeedbackAdminClient } from "@/components/pilot/FeedbackAdminClient";

export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/admin/feedback");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/admin/dashboard");

  const feedback = await listAllPilotFeedback();
  const resolverLabels = await listProfileLabels(feedback.map((f) => f.resolved_by));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
          Admin · Pilot
        </p>
        <h1 className="mt-1 text-2xl font-bold text-electric-blue">Pilot feedback</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Everything sent in via the &quot;+&quot; button, across every department.
          After a fix is on production, mark it done so testers see Done in their Mine tab.
        </p>
      </div>
      <FeedbackAdminClient initialFeedback={feedback} resolverLabels={resolverLabels} />
    </main>
  );
}
