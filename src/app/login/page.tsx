import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isOtpSignInAvailable } from "@/lib/auth/otp-mail";
import { getHrAdminEmails } from "@/lib/env";
import EmailOtpForm from "@/components/EmailOtpForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/hub");
  return (
    <EmailOtpForm
      deliveryConfigured={isOtpSignInAvailable()}
      adminEmails={getHrAdminEmails()}
    />
  );
}
