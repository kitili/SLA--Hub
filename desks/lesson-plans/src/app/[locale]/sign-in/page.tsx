import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth";
import { signInMemberAction } from "@/lib/actions/member";
import { getHrAdminEmails } from "@/lib/env";
import StaffRegistration from "@/components/StaffRegistration";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in — Silverleaf Lesson Plans",
};

/**
 * Sign-in page — renders the StaffRegistration overlay as a full page.
 *
 * `requireUser()` in other routes redirects here (via `/sign-in` → locale
 * middleware rewrites to `/<locale>/sign-in`).  If the user is already
 * authenticated we redirect them to the dashboard immediately.
 */
export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Already signed in — send to dashboard.
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  return (
    <main>
      <StaffRegistration
        onSubmit={signInMemberAction}
        adminEmails={getHrAdminEmails()}
      />
    </main>
  );
}
