import { setRequestLocale } from "next-intl/server";

import { getCurrentUser } from "@/lib/auth";
import { isFeedbackHour } from "@/lib/time/eat";
import FeedbackHourHome from "@/components/lesson/FeedbackHourHome";
import NormalHome from "@/components/lesson/NormalHome";

/**
 * Lesson plans are public to read.
 *
 * - Anyone → the catalogue home (search and browse).
 * - A signed-in teacher during Feedback Hour (15:00–17:00 EAT) →
 *   <FeedbackHourHome />.
 * - A signed-in teacher otherwise → the same home, plus their next lessons.
 */
export const dynamic = "force-dynamic";

export default async function LessonPlansPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (user && isFeedbackHour()) {
    return <FeedbackHourHome />;
  }

  return <NormalHome />;
}
