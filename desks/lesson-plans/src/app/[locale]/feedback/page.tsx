import "@/components/curriculum/feedback.css";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";

import BoardOffline from "@/components/academics/BoardOffline";
import Dashboard from "@/components/curriculum/Dashboard";
import { listCurriculumFeedback, listPdFeedback } from "@/lib/curriculum-feedback/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await connection();
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    const [curriculum, pd] = await Promise.all([listCurriculumFeedback(), listPdFeedback()]);
    if (!curriculum || !pd) {
      return (
        <>
          <BoardOffline />
          <p>
            No Silverleaf Feedback is in the shared database yet. Open this page while you are
            online and this device keeps a copy for when you are offline.
          </p>
        </>
      );
    }
    const offline = curriculum.source === "offline" || pd.source === "offline";
    return (
      <div className="cfa">
        <BoardOffline />
        {offline ? <p className="norm-hint">Showing the last copy saved on this server. It refreshes when the database is reachable.</p> : null}
        <Dashboard curriculum={curriculum.data} pd={pd.data} now={Date.now()} signedIn={false} />
      </div>
    );
  } catch (error) {
    console.error("[feedback]", error instanceof Error ? error.name : "error");
    return <p>Silverleaf Feedback could not be loaded. The shared database did not respond.</p>;
  }
}
