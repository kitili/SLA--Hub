"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInMemberAction } from "@/lib/actions/member";
import BrandLogo from "@/components/BrandLogo";
import styles from "./EmailOtpForm.module.css";

export default function EdAdminSignIn() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [staffId, setStaffId] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await signInMemberAction({ email, staffId });
      if (result.ok) {
        router.push("/hub");
        router.refresh();
        return;
      }
      if (result.error === "not-registered") {
        setError("That work email and Staff ID do not match an Ed Admin account.");
      } else if (result.error === "inactive") {
        setError("That Ed Admin account is not current. Ask HR to reactivate it.");
      } else if (result.error === "invalid-input") {
        setError("Enter your Silverleaf work email and your Ed Admin Staff ID.");
      } else if (result.error === "directory-unavailable") {
        setError("Ed Admin is not answering right now. Try again in a minute.");
      } else {
        setError("Could not sign in. Check the email and Staff ID, then try again.");
      }
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <BrandLogo variant="tagline" width={300} height={76} priority />
        <p className={styles.tagline}>The Future Starts Here</p>
        <h2>One workplace for every Silverleaf desk</h2>
        <p>
          Sign in with your Ed Admin work email and Staff ID — the same account
          you already use at school.
        </p>
        <div className={styles.points}>
          <span>
            <i className={styles.dot} /> Ed Admin is the only sign-in gate
          </span>
          <span>
            <i className={styles.dot} /> Staff ID, not an email code
          </span>
          <span>
            <i className={styles.dot} /> One click opens each live desk
          </span>
        </div>
      </div>
      <div className={styles.card}>
        <BrandLogo variant="logomark" width={72} height={72} className={styles.logo} priority />
        <h1>Sign in to Silverleaf Hub</h1>
        <p className={styles.sub}>Work email and Ed Admin Staff ID. No one-time code.</p>
        <form onSubmit={handleSubmit} className={styles.form}>
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
            Ed Admin Staff ID
            <input
              type="text"
              inputMode="numeric"
              value={staffId}
              onChange={(event) => setStaffId(event.target.value.replace(/\s/g, ""))}
              placeholder="e.g. 401402"
              required
              disabled={pending}
              autoComplete="off"
            />
          </label>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button type="submit" className={styles.submit} disabled={pending || !email.trim() || !staffId.trim()}>
            {pending ? "Checking Ed Admin…" : "Sign in"}
          </button>
        </form>
        <p className={styles.note}>
          Super admins (Krupa Patel and Nelly Zablon) see Progress for every
          desk after they sign in here.
        </p>
      </div>
    </div>
  );
}
