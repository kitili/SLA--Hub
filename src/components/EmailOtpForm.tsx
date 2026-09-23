"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestOtpAction, verifyOtpAction } from "@/lib/actions/otp";
import { signInMemberAction } from "@/lib/actions/member";
import { claimUniqueUsernameAction, setNameAction } from "@/lib/actions/auth";
import BrandLogo from "@/components/BrandLogo";
import styles from "./EmailOtpForm.module.css";

type Step = "email" | "code" | "name" | "username";

export default function EmailOtpForm({
  deliveryConfigured = true,
  adminEmails = [],
}: {
  deliveryConfigured?: boolean;
  adminEmails?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
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
        setError("Use your own Silverleaf work email ending in @silverleaf.co.tz.");
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

  const isAdminEmail = adminEmails.includes(email.trim().toLowerCase());

  function handleDirectorySignIn(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await signInMemberAction({
        email,
        staffId,
        adminPassword: password,
      });
      if (result.ok) {
        router.push("/hub");
        router.refresh();
        return;
      }
      if (result.error === "admin-password-required") {
        setError("HR sign-in needs your password. Enter it below, or email yourself a code.");
        return;
      }
      if (result.error === "admin-password-invalid") {
        setError("That password is not correct.");
        return;
      }
      if (result.error === "not-registered") {
        setError("That work email and Staff ID do not match an active ed-admin account.");
        return;
      }
      if (result.error === "inactive") {
        setError("That ed-admin account is not active. Contact HR.");
        return;
      }
      if (result.error === "directory-unavailable") {
        setError("Could not reach the staff directory. Try a sign-in code, or try again shortly.");
        return;
      }
      if (result.error === "invalid-input") {
        setError(
          isAdminEmail
            ? "Enter your work email and password, or your Staff ID."
            : "Enter your work email and ed-admin Staff ID.",
        );
        return;
      }
      setError("Could not sign you in. Try again or use a sign-in code.");
    });
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
      if (!result.ok && "suggestion" in result && result.suggestion) {
        setUsername(result.suggestion);
        setStep("username");
        setError("");
        return;
      }
      setError(result.ok ? "" : result.error);
    });
  }

  function handleClaimUsername(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await claimUniqueUsernameAction(username);
      if (result.ok) {
        router.push("/hub");
        router.refresh();
        return;
      }
      setError(result.error);
    });
  }

  const stepIndex = step === "email" ? 0 : step === "code" ? 1 : step === "name" ? 2 : 3;

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <BrandLogo variant="tagline" width={300} height={76} priority />
        <p className={styles.tagline}>The Future Starts Here</p>
        <h2>One workplace for every Silverleaf desk</h2>
        <p>
          Sign in the same way as Onboarding: your work email, your ed-admin Staff ID, and — if you have one — your password. You can email yourself a code instead.
        </p>
        <div className={styles.points}>
          <span>
            <i className={styles.dot} /> Work email + Staff ID, like the other desks
          </span>
          <span>
            <i className={styles.dot} /> Password for HR, or a one-time code for anyone
          </span>
          <span>
            <i className={styles.dot} /> One person, one work email, one account
          </span>
        </div>
      </div>
      <div className={styles.card}>
        <BrandLogo variant="logomark" width={72} height={72} className={styles.logo} priority />
        {step === "code" || step === "name" || step === "username" ? (
          <div className={styles.steps} aria-hidden="true">
            <span className={styles.step} data-on={stepIndex >= 0} />
            <span className={styles.step} data-on={stepIndex >= 1} />
            <span className={styles.step} data-on={stepIndex >= 2} />
            <span className={styles.step} data-on={stepIndex >= 3} />
          </div>
        ) : null}

        {step === "username" ? (
          <>
            <h1>Pick your own work email</h1>
            <p className={styles.sub}>
              Someone with a similar name already has an account. Do not share theirs. Choose a unique email that ends with @silverleaf.co.tz.
            </p>
            <form onSubmit={handleClaimUsername} className={styles.form}>
              <label>
                Your unique work email
                <input
                  type="email"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="firstname.lastname@silverleaf.co.tz"
                  required
                  autoFocus
                  disabled={pending}
                  autoComplete="email"
                />
              </label>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button type="submit" className={styles.submit} disabled={pending}>
                {pending ? "Saving…" : "Use this email"}
              </button>
            </form>
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
            <p className={styles.sub}>
              Use your work email and ed-admin Staff ID. HR can add their password. Or email yourself a code instead.
            </p>
            <form onSubmit={handleDirectorySignIn} className={styles.form}>
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
                />
              </label>
              <label>
                Staff ID (your ed-admin ID)
                <input
                  type="text"
                  inputMode="numeric"
                  value={staffId}
                  onChange={(event) => setStaffId(event.target.value)}
                  placeholder="401402"
                  disabled={pending}
                  autoComplete="username"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isAdminEmail ? "HR password" : "Optional — or use a code"}
                  disabled={pending}
                  autoComplete="current-password"
                />
              </label>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button type="submit" className={styles.submit} disabled={pending}>
                {pending ? "Signing in…" : "Continue"}
              </button>
            </form>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.link}
                onClick={requestCode}
                disabled={pending || !deliveryConfigured}
              >
                {deliveryConfigured ? "Email me a sign-in code instead" : "Email codes are not configured yet"}
              </button>
            </div>
            <p className={styles.note}>Each desk may still ask you to sign in once. Use your own account, not a colleague&apos;s.</p>
          </>
        ) : (
          <>
            <h1>Enter your code</h1>
            <p className={styles.sub}>We sent a 6-digit code to {email}.</p>
            {previewCode ? (
              <p className={styles.preview}>
                Your sign-in code: <strong>{previewCode}</strong>
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
