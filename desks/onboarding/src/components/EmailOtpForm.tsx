"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { requestOtpAction, verifyOtpAction } from "@/lib/actions/otp";
import { setNameAction } from "@/lib/actions/profile";
import BrandLogo from "@/components/BrandLogo";
import styles from "./EmailOtpForm.module.css";

type Step = "email" | "code" | "name";

export default function EmailOtpForm({
  deliveryConfigured = true,
  staffIdHref = "/sign-in",
}: {
  deliveryConfigured?: boolean;
  staffIdHref?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");

  function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await requestOtpAction(email);
      if (result.ok) {
        setStep("code");
        return;
      }
      switch (result.error) {
        case "invalid-email":
          setError("Please use your @silverleaf.co.tz work email.");
          break;
        case "not-found":
          setError(
            "Email not found. Make sure you're using your work email, or contact HR.",
          );
          break;
        case "inactive":
          setError("Your ed admin account isn't active. Please contact HR.");
          break;
        case "directory-unavailable":
          setError(
            "We couldn't reach the staff directory right now. Please try again in a moment, or sign in with your Staff ID.",
          );
          break;
        case "rate-limited":
          setError("Too many requests. Please wait a few minutes and try again.");
          break;
        case "send-failed":
          setError(
            "Failed to send email. Email delivery may not be configured — contact HR or IT, then try again.",
          );
          break;
      }
    });
  }

  function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await verifyOtpAction(email, code);
      if (result.ok) {
        if (result.isNew) {
          setStep("name");
        } else {
          router.refresh();
        }
        return;
      }
      setError(
        result.error === "expired"
          ? "This code has expired. Request a new one."
          : "Incorrect code. Please check the email and try again.",
      );
    });
  }

  function handleSetName(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await setNameAction(fullName);
      if (result.ok) {
        router.refresh();
        return;
      }
      setError(result.error);
    });
  }

  function handleResend() {
    setCode("");
    setError("");
    startTransition(async () => {
      const result = await requestOtpAction(email);
      if (!result.ok) {
        setError(
          result.error === "rate-limited"
            ? "Too many requests. Please wait a few minutes."
            : "Failed to resend. Please try again.",
        );
      }
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <BrandLogo
          variant="logomark"
          width={48}
          height={48}
          className={styles.logo}
        />

        {!deliveryConfigured ? (
          <>
            <h1>Sign in with Staff ID</h1>
            <p className={styles.sub}>
              Email codes are not available on this site yet. Use your work
              email and ed admin Staff ID to sign in.
            </p>
            <a href={staffIdHref} className={styles.submit}>
              Continue to sign in
            </a>
          </>
        ) : step === "name" ? (
          <>
            <h1>One last thing</h1>
            <p className={styles.sub}>
              Welcome to Silverleaf Academy! What&apos;s your full name?
            </p>
            <form onSubmit={handleSetName} className={styles.form}>
              <label>
                Full name
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Amina Hassan"
                  required
                  autoFocus
                  disabled={pending}
                  autoComplete="name"
                />
              </label>
              {error && <p className={styles.error}>{error}</p>}
              <button
                type="submit"
                className={styles.submit}
                disabled={pending || fullName.trim().length < 2}
              >
                {pending ? "Saving…" : "Continue →"}
              </button>
            </form>
          </>
        ) : step === "email" ? (
          <>
            <h1>Sign in with email</h1>
            <p className={styles.sub}>
              Enter your Silverleaf work email and we&apos;ll send you a 6-digit
              sign-in code.
            </p>
            <form onSubmit={handleRequestCode} className={styles.form}>
              <label>
                Work email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@silverleaf.co.tz"
                  required
                  autoFocus
                  disabled={pending}
                />
              </label>
              {error && <p className={styles.error}>{error}</p>}
              <button type="submit" className={styles.submit} disabled={pending}>
                {pending ? "Sending…" : "Send code"}
              </button>
              <a href={staffIdHref} className={styles.link}>
                Sign in with Staff ID instead
              </a>
            </form>
          </>
        ) : (
          <>
            <h1>Enter your code</h1>
            <p className={styles.sub}>
              A 6-digit code was sent to <strong>{email}</strong>. It expires in
              10 minutes.
            </p>
            <form onSubmit={handleVerifyCode} className={styles.form}>
              <label>
                Sign-in code
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="123456"
                  maxLength={6}
                  required
                  autoFocus
                  disabled={pending}
                  className={styles.codeInput}
                />
              </label>
              {error && <p className={styles.error}>{error}</p>}
              <button
                type="submit"
                className={styles.submit}
                disabled={pending || code.length < 6}
              >
                {pending ? "Verifying…" : "Sign in"}
              </button>
            </form>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                }}
                disabled={pending}
              >
                ← Change email
              </button>
              <button
                type="button"
                className={styles.link}
                onClick={handleResend}
                disabled={pending}
              >
                Resend code
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
