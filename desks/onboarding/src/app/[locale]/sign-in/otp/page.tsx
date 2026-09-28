import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth";
import { isOtpSignInAvailable } from "@/lib/auth/otp-mail";
import EmailOtpForm from "@/components/EmailOtpForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign In — Silverleaf Onboarding Hub",
};

export default async function EmailOtpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main>
      <EmailOtpForm
        deliveryConfigured={isOtpSignInAvailable()}
        staffIdHref={`/${locale}/sign-in`}
      />
    </main>
  );
}
