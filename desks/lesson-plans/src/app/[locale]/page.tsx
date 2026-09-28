import { setRequestLocale } from "next-intl/server";

import { getCurrentUser } from "@/lib/auth";
import { signInMemberAction } from "@/lib/actions/member";
import { getHrAdminEmails } from "@/lib/env";
import { isFeedbackHour } from "@/lib/time/eat";
import StaffRegistration from "@/components/StaffRegistration";
import FeedbackHourHome from "@/components/lesson/FeedbackHourHome";
import NormalHome from "@/components/lesson/NormalHome";

/**
 * Teacher home.
 *
 * - Unauthenticated → the StaffRegistration sign-in overlay.
 * - Authenticated during the daily Feedback Hour (15:00–17:00 EAT) →
 *   <FeedbackHourHome /> (Feedback vertical).
 * - Authenticated otherwise → <NormalHome /> (search + your next lessons).
 *
 * Dynamic: reads the session cookie and the server clock, so it must render
 * per-request (never prerendered or cached).
 */
export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    return (
      <StaffRegistration
        onSubmit={signInMemberAction}
        adminEmails={getHrAdminEmails()}
      />
    );
  }

  return isFeedbackHour() ? <FeedbackHourHome /> : <NormalHome />;
}
