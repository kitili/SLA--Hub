import { redirect } from "next/navigation";
import { isOtpSignInAvailable } from "@/lib/auth/otp-mail";
import { getSessionUser } from "@/lib/auth/session";
import { SignIn } from "@/components/sign-in";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/today");
  return <SignIn deliveryConfigured={isOtpSignInAvailable()} />;
}
