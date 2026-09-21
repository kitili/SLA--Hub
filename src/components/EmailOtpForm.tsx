"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestOtpAction, verifyOtpAction } from "@/lib/actions/otp";
import { setNameAction } from "@/lib/actions/auth";
import BrandLogo from "@/components/BrandLogo";
import styles from "./EmailOtpForm.module.css";

type Step = "email" | "code" | "name";

export default function EmailOtpForm({ deliveryConfigured = true }: { deliveryConfigured?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [previewCode, setPreviewCode] = useState("");
  const verifying = useRef(false);

  function requestCode() {
    setError("");
    startTransition(async () => {
      const result = await requestOtpAction(email);
      if (result.ok) {
        setPreviewCode(result.previewCode ?? "");
        setStep("code");
        return;
      }
      if (result.error === "invalid-email") {
        setError("Use a Silverleaf work email (@silverleaf.co.tz or @silverleaf.ac.tz).");
      } else if (result.error === "rate-limited") {
        setError("Too many codes. Wait a few minutes and try again.");
      } else {
        setError("Could not send the code. Contact IT if this keeps happening.");
      }
    });
  }

  function handleRequestCode(event: React.FormEvent) {
    event.preventDefault();
    requestCode();
  }

  function verifyCode(value = code) {
    if (verifying.current || value.length < 6) return;
    verifying.current = true;
    setError("");
    startTransition(async () => {
      const result = await verifyOtpAction(email, value);
      verifying.current = false;
      if (result.ok) {
        if (result.isNew) {
          setStep("name");
        } else {
          router.push("/hub");
          router.refresh();
        }
        return;
      }
      setError(result.error === "expired" ? "That code has expired. Request a new one." : "That code is not correct.");
    });
  }

  function handleVerifyCode(event: React.FormEvent) {
    event.preventDefault();
    verifyCode();
  }

  function handleSetName(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await setNameAction(fullName);
      if (result.ok) {
        router.push("/hub");
        router.refresh();
        return;
      }
      setError(result.error);
    });
  }

  const stepIndex = step === "email" ? 0 : step === "code" ? 1 : 2;

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <BrandLogo variant="tagline" width={220} height={56} priority />
        <h2>One workplace for every Silverleaf desk</h2>
        <p>
          Sign in with your work email. From here you can open Onboarding, Talent Academy, Ops, Uniforms, Marketing, Data & Tech, and Visitors without a pile of bookmarks.
        </p>
        <div className={styles.points}>
          <span>
            <i className={styles.dot} /> One-time code — no password
          </span>
          <span>
            <i className={styles.dot} /> Your session stays on this device
          </span>
          <span>
            <i className={styles.dot} /> Click a desk to open that system
          </span>
        </div>
      </div>
      <div className={styles.card}>
        <BrandLogo variant="logomark" width={48} height={48} className={styles.logo} priority />
        {deliveryConfigured ? (
          <div className={styles.steps} aria-hidden="true">
            <span className={styles.step} data-on={stepIndex >= 0} />
            <span className={styles.step} data-on={stepIndex >= 1} />
            <span className={styles.step} data-on={stepIndex >= 2} />
          </div>
        ) : null}

        {!deliveryConfigured ? (
          <>
            <h1>Sign-in is not available</h1>
            <p className={styles.sub}>Email delivery is not configured yet. Ask IT to set SMTP.</p>
          </>
        ) : step === "name" ? (
          <>
            <h1>What should we call you?</h1>
            <p className={styles.sub}>This is your first time in the hub. Add the name colleagues will see.</p>
            <form onSubmit={handleSetName} className={styles.form}>
              <label>
                Full name
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="e.g. Amina Hassan"
                  required
                  autoFocus
                  disabled={pending}
                  autoComplete="name"
                />
              </label>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button type="submit" className={styles.submit} disabled={pending || fullName.trim().length < 2}>
                {pending ? "Saving…" : "Enter the hub"}
              </button>
            </form>
          </>
        ) : step === "email" ? (
          <>
            <h1>Sign in to Silverleaf Hub</h1>
            <p className={styles.sub}>Use your Silverleaf work email. We send a 6-digit code. Your session is a cookie on this device only — other people can be signed in on theirs at the same time.</p>
            <form onSubmit={handleRequestCode} className={styles.form}>
              <label>
                Work email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@silverleaf.co.tz"
                  required
                  autoFocus
                  disabled={pending}
                  autoComplete="email"
                  enterKeyHint="send"
                />
              </label>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button type="submit" className={styles.submit} disabled={pending}>
                {pending ? "Sending…" : "Send code"}
              </button>
            </form>
            <p className={styles.note}>Each desk may still ask you to sign in once. One shared Silverleaf sign-in comes next.</p>
          </>
        ) : (
          <>
            <h1>Enter your code</h1>
            <p className={styles.sub}>We sent a 6-digit code to {email}.</p>
            {previewCode ? (
              <p className={styles.preview}>
                Local preview code: <strong>{previewCode}</strong>
              </p>
            ) : null}
            <form onSubmit={handleVerifyCode} className={styles.form}>
              <label>
                Sign-in code
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => {
                    const next = event.target.value.replace(/\D/g, "").slice(0, 6);
                    setCode(next);
                    if (next.length === 6) verifyCode(next);
                  }}
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
                {pending ? "Checking…" : "Sign in"}
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
                  setPreviewCode("");
                  verifying.current = false;
                }}
                disabled={pending}
              >
                Use a different email
              </button>
              <button type="button" className={styles.link} onClick={requestCode} disabled={pending}>
                Resend code
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
