import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";

import BoardOffline from "@/components/academics/BoardOffline";
import AssessmentBoard from "@/components/assessment/AssessmentBoard";
import { getCurrentUser } from "@/lib/auth";
import { loadAssessmentSnapshot } from "@/lib/assessment/load";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await connection();
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  const admin = Boolean(user?.isAdmin);

  try {
    const loaded = await loadAssessmentSnapshot();
    const points = (loaded?.data.points ?? []).map((point) => ({
      school: point.school,
      grade: point.grade,
      round: point.round,
      tool: point.tool,
      value: point.value,
      band: point.band,
      studentRef: admin ? point.studentRef : null,
    }));
    const source = !loaded || points.length === 0 ? "empty" : loaded.source;
    return (
      <>
        <BoardOffline />
        <AssessmentBoard points={points} admin={admin} source={source} />
      </>
    );
  } catch (error) {
    console.error("[assessment]", error instanceof Error ? error.name : "error");
    return <p>The assessment dashboard could not be loaded. The shared database did not respond.</p>;
  }
}
