import "@/components/curriculum/feedback.css";
import { setRequestLocale } from "next-intl/server";

import Dashboard from "@/components/curriculum/Dashboard";
import { listCurriculumFeedback, listPdFeedback } from "@/lib/curriculum-feedback/queries";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    const [curriculum, pd] = await Promise.all([listCurriculumFeedback(), listPdFeedback()]);
    if (!curriculum || !pd) {
      return (
        <p>
          No Silverleaf Feedback is saved on this computer yet. Connect once and this page keeps
          a local copy for offline use.
        </p>
      );
    }
    const offline = curriculum.source === "offline" || pd.source === "offline";
    return (
      <div className="cfa">
        {offline ? <p className="norm-hint">Showing the copy saved on this computer.</p> : null}
        <Dashboard curriculum={curriculum.data} pd={pd.data} now={Date.now()} signedIn={false} />
      </div>
    );
  } catch (error) {
    console.error("[feedback]", error instanceof Error ? error.name : "error");
    return <p>Silverleaf Feedback could not be loaded. The shared database did not respond.</p>;
  }
}
