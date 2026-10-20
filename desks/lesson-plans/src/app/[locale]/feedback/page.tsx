import "@/components/curriculum/feedback.css";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";

import BoardOffline from "@/components/academics/BoardOffline";
import Dashboard from "@/components/curriculum/Dashboard";
import { listCurriculumFeedback, listPdFeedback } from "@/lib/curriculum-feedback/queries";
import { publishPdInsights, readDeskBridge, readTrainingInsights } from "@/lib/hub-link";

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
    if (!offline) await publishPdInsights(pd.data);
    const [training, fromOtherDesks] = await Promise.all([readTrainingInsights(), readDeskBridge()]);
    return (
      <div className="cfa">
        <BoardOffline />
        {offline ? <p className="norm-hint">Showing the last copy saved on this server. It refreshes when the database is reachable.</p> : null}
        {fromOtherDesks.length > 0 ? (
          <section className="norm-hint">
            <p>From other desks</p>
            <ul>
              {fromOtherDesks.map((row) => (
                <li key={row.id}>
                  {row.from}: {row.title}. {row.facts.map((fact) => `${fact.label} ${fact.value}`).join(", ")}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {training.length > 0 ? (
          <section className="norm-hint">
            <p>From Talent Academy</p>
            <ul>
              {training.map((course) => (
                <li key={`${course.batchName}-${course.courseName}`}>
                  {course.courseName}
                  {course.batchName ? ` (${course.batchName})` : ""}: {course.completedCount} of {course.enrolled} completed
                  {course.completionPercentage != null ? ` (${course.completionPercentage}%)` : ""}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <Dashboard curriculum={curriculum.data} pd={pd.data} now={Date.now()} signedIn={false} />
      </div>
    );
  } catch (error) {
    console.error("[feedback]", error instanceof Error ? error.name : "error");
    return <p>Silverleaf Feedback could not be loaded. The shared database did not respond.</p>;
  }
}
