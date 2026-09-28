"use client";

import { useState } from "react";
import styles from "./sign-in.module.css";

type Step = "staff" | "email" | "code" | "name";

const staffErrors: Record<string, string> = {
  "not-registered":
    "We couldn't find an active ed admin account for this email and Staff ID. You need an ed admin account first — please contact HR.",
  inactive: "Your ed admin account isn't active. Please contact HR.",
  "invalid-input": "Please enter both your work email and Staff ID.",
  "directory-unavailable":
    "We couldn't reach the staff directory right now. Please try again in a moment, or contact HR if this continues.",
  failed: "Could not sign you in. Please try again.",
};

export function SignIn({ deliveryConfigured = true }: { deliveryConfigured?: boolean }) {
  const [step, setStep] = useState<Step>("staff");
  const [email, setEmail] = useState("");
  const [staffId, setStaffId] = useState("");
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  function enter() {
    window.location.assign("/today");
  }

  async function submitStaff(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, staffId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        enter();
        return;
      }
      setError(staffErrors[data.error ?? ""] ?? staffErrors.failed);
    } catch {
      setError(staffErrors.failed);
    } finally {
      setPending(false);
    }
  }

  async function requestCode() {
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; devCode?: string };
      if (data.ok) {
        if (data.devCode) {
          setCode(data.devCode);
          setNotice("Email isn't set up on this computer, so your code is shown here.");
        } else {
          setNotice("");
        }
        setStep("code");
        return;
      }
      if (data.error === "invalid-email") setError("Please use your @silverleaf.co.tz work email.");
      else if (data.error === "rate-limited") setError("Too many requests. Please wait a few minutes and try again.");
      else setError("Failed to send email. Contact HR or IT, then try again.");
    } catch {
      setError("Failed to send email. Contact HR or IT, then try again.");
    } finally {
      setPending(false);
    }
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    await requestCode();
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = (await res.json()) as { ok?: boolean; isNew?: boolean; error?: string };
      if (data.ok) {
        if (data.isNew) setStep("name");
        else enter();
        return;
      }
      setError(
        data.error === "expired"
          ? "This code has expired. Request a new one."
          : "Incorrect code. Please check the email and try again.",
      );
    } catch {
      setError("Incorrect code. Please check the email and try again.");
    } finally {
      setPending(false);
    }
  }

  async function submitName(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/auth/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        enter();
        return;
      }
      setError(data.error ?? "Please enter your full name (at least 2 characters).");
    } catch {
      setError("Could not save your name. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <img className={styles.logo} src="/assets/branding/logomark-electric-blue.svg" alt="" width={48} height={48} />

        {!deliveryConfigured && step !== "staff" ? (
          <>
            <h1>Email sign-in unavailable</h1>
            <p className={styles.sub}>Email codes are not set up on this site yet. Please contact IT.</p>
            <button type="button" className={styles.otpLink} onClick={() => setStep("staff")}>
              ← Use Staff ID
            </button>
          </>
        ) : step === "name" ? (
          <>
            <h1>One last thing</h1>
            <p className={styles.sub}>Welcome to Silverleaf Academy! What&apos;s your full name?</p>
            <form onSubmit={submitName} className={styles.form}>
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
              {error ? <p className={styles.error}>{error}</p> : null}
              <button type="submit" className={styles.submit} disabled={pending || fullName.trim().length < 2}>
                {pending ? "One moment…" : "Continue"}
              </button>
            </form>
          </>
        ) : step === "email" ? (
          <>
            <h1>Welcome</h1>
            <p className={styles.sub}>
              Enter your Silverleaf work email and we&apos;ll send you a 6-digit sign-in code.
            </p>
            <form onSubmit={submitEmail} className={styles.form}>
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
              {error ? <p className={styles.error}>{error}</p> : null}
              <button type="submit" className={styles.submit} disabled={pending}>
                {pending ? "One moment…" : "Continue"}
              </button>
            </form>
            <button
              type="button"
              className={styles.otpLink}
              onClick={() => {
                setStep("staff");
                setError("");
              }}
            >
              ← Use Staff ID
            </button>
          </>
        ) : step === "code" ? (
          <>
            <h1>Enter your code</h1>
            <p className={styles.sub}>
              {notice || `A 6-digit code was sent to ${email}. It expires in 10 minutes.`}
            </p>
            <form onSubmit={submitCode} className={styles.form}>
              <label>
                Sign-in code
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  required
                  autoFocus
                  disabled={pending}
                  className={styles.codeInput}
                />
              </label>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button type="submit" className={styles.submit} disabled={pending || code.length < 6}>
                {pending ? "One moment…" : "Sign in"}
              </button>
            </form>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.link}
                disabled={pending}
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                }}
              >
                ← Change email
              </button>
              <button type="button" className={styles.link} disabled={pending} onClick={() => void requestCode()}>
                Resend code
              </button>
            </div>
          </>
        ) : (
          <>
            <h1>Welcome</h1>
            <p className={styles.sub}>Sign in with your work email and ed admin Staff ID.</p>
            <form onSubmit={submitStaff} className={styles.form}>
              <label>
                Work email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@silverleaf.co.tz"
                  autoFocus
                  disabled={pending}
                />
              </label>
              <label>
                Staff ID <span className={styles.optional}>(your ed admin ID)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  placeholder="401402"
                  required
                  disabled={pending}
                />
              </label>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button type="submit" className={styles.submit} disabled={pending}>
                {pending ? "One moment…" : "Continue"}
              </button>
            </form>
            <button
              type="button"
              className={styles.otpLink}
              onClick={() => {
                setStep("email");
                setError("");
              }}
            >
              Email me a sign-in code
            </button>
          </>
        )}
      </div>
    </div>
  );
}
