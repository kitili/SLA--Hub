import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthError } from "next-auth";
import { isDevAuthBypassEnabled, signIn } from "@/lib/auth";
import { requestOtpCode } from "@/lib/otp";
import styles from "./login.module.css";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; mode?: string; stage?: string; email?: string }>;
}) {
  if (isDevAuthBypassEnabled()) {
    redirect("/dashboard");
  }

  const { callbackUrl, error, mode, stage, email } = await searchParams;
  const safeCallbackUrl = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/dashboard";
  const callbackParam = callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : "";
  const isPasswordMode = mode === "password";
  const isVerifyStage = !isPasswordMode && stage === "verify";

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: safeCallbackUrl,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect(
          `/login?mode=password&error=1${callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`,
        );
      }
      throw err;
    }
  }

  async function requestCode(formData: FormData) {
    "use server";
    const otpEmail = String(formData.get("email") ?? "")
      .toLowerCase()
      .trim();
    await requestOtpCode(otpEmail);
    redirect(
      `/login?mode=otp&stage=verify&email=${encodeURIComponent(otpEmail)}${callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`,
    );
  }

  async function verifyCode(formData: FormData) {
    "use server";
    try {
      await signIn("otp", {
        email: formData.get("email"),
        code: formData.get("code"),
        redirectTo: safeCallbackUrl,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect(
          `/login?mode=otp&stage=verify&error=1&email=${encodeURIComponent(String(formData.get("email") ?? ""))}${callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`,
        );
      }
      throw err;
    }
  }

  const passwordHref = `/login?mode=password${callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`;
  const emailHref = `/login${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`;

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <img src="/branding/logomark-electric-blue.svg" alt="Silverleaf" className={styles.logo} />
        {isVerifyStage ? (
          <>
            <h1>Enter your code</h1>
            <p className={styles.sub}>
              A 6-digit code was sent to <strong>{email}</strong>. It expires in 10 minutes.
            </p>
            <form action={verifyCode} className={styles.form}>
              <input type="hidden" name="email" value={email} />
              <label>
                Sign-in code
                <input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="123456"
                  className={styles.codeInput}
                />
              </label>
              {error && <p className={styles.error}>Incorrect code. Please check the email and try again.</p>}
              <button type="submit" className={styles.submit}>
                Sign in
              </button>
            </form>
            <div className={styles.actions}>
              <Link href={`/login?email=${encodeURIComponent(email ?? "")}${callbackParam}`} className={styles.link}>
                ← Change email
              </Link>
              <form action={requestCode}>
                <input type="hidden" name="email" value={email} />
                <button type="submit" className={styles.link}>
                  Resend code
                </button>
              </form>
            </div>
          </>
        ) : isPasswordMode ? (
          <>
            <h1>Sign in with password</h1>
            <p className={styles.sub}>Use your work email and password for the Data &amp; Tech desk.</p>
            {error && <p className={styles.error}>Invalid email or password.</p>}
            <form action={login} className={styles.form}>
              <label>
                Work email
                <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@silverleaf.co.tz" />
              </label>
              <label>
                Password
                <input id="password" name="password" type="password" required autoComplete="current-password" />
              </label>
              <button type="submit" className={styles.submit}>
                Sign in
              </button>
              <Link href={emailHref} className={styles.link}>
                Sign in with email instead
              </Link>
            </form>
          </>
        ) : (
          <>
            <h1>Sign in with email</h1>
            <p className={styles.sub}>Enter your Silverleaf work email and we&apos;ll send you a 6-digit sign-in code.</p>
            <form action={requestCode} className={styles.form}>
              <label>
                Work email
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  defaultValue={email}
                  autoFocus
                  placeholder="you@silverleaf.co.tz"
                />
              </label>
              <button type="submit" className={styles.submit}>
                Send code
              </button>
              <Link href={passwordHref} className={styles.link}>
                Sign in with password instead
              </Link>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
