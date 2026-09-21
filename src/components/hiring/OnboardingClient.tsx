"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import styles from "./hiring.module.css";

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "form"; candidateName: string; role: string }
  | { phase: "success"; candidateName: string };

export default function OnboardingClient() {
  const params = useParams();
  const token = String(params?.token || "");

  const [state, setState] = useState<State>({ phase: "loading" });
  const [workEmail, setWorkEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/hiring/onboarding/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setState({ phase: "error", message: data.error });
        } else {
          setState({
            phase: "form",
            candidateName: data.candidateName,
            role: data.role,
          });
        }
      })
      .catch(() =>
        setState({ phase: "error", message: "Failed to load. Please try again." }),
      );
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/hiring/onboarding/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workEmail, tempPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Submission failed. Please try again.");
      } else {
        setState({ phase: "success", candidateName: data.candidateName });
      }
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.onboardingPage}>
      <div className={styles.onboardingCard}>
        <div className={styles.onboardingLogo}>Silverleaf Academy</div>

        {state.phase === "loading" && (
          <p className={styles.onboardingMuted}>Loading…</p>
        )}

        {state.phase === "error" && (
          <>
            <h1 className={styles.onboardingTitle}>Link unavailable</h1>
            <p className={styles.onboardingMuted}>{state.message}</p>
          </>
        )}

        {state.phase === "form" && (
          <>
            <h1 className={styles.onboardingTitle}>New employee account setup</h1>
            <p className={styles.onboardingMuted}>
              Please create a Silverleaf Academy email account for the new hire
              below, then fill in the details.
            </p>

            <div className={styles.onboardingInfoBox}>
              <div className={styles.onboardingInfoRow}>
                <span className={styles.onboardingInfoLabel}>Name</span>
                <span className={styles.onboardingInfoValue}>{state.candidateName}</span>
              </div>
              <div className={styles.onboardingInfoRow}>
                <span className={styles.onboardingInfoLabel}>Role</span>
                <span className={styles.onboardingInfoValue}>{state.role}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className={styles.onboardingForm}>
              <div className={styles.onboardingField}>
                <label htmlFor="ob-email" className={styles.onboardingLabel}>
                  New work email <span aria-hidden="true" style={{ color: "#b91c1c" }}>*</span>
                </label>
                <input
                  id="ob-email"
                  type="email"
                  required
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  placeholder="firstname.lastname@silverleaf.co.tz"
                  className={styles.onboardingInput}
                />
              </div>

              <div className={styles.onboardingField}>
                <label htmlFor="ob-password" className={styles.onboardingLabel}>
                  Temporary password <span aria-hidden="true" style={{ color: "#b91c1c" }}>*</span>
                </label>
                <input
                  id="ob-password"
                  type="password"
                  required
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  minLength={8}
                  maxLength={128}
                  className={styles.onboardingInput}
                  autoComplete="off"
                />
                <p className={styles.onboardingHint}>
                  This will be sent securely to HR. It is not stored in the system.
                </p>
              </div>

              {formError ? (
                <p className={styles.onboardingError}>{formError}</p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className={styles.onboardingSubmit}
              >
                {submitting ? "Submitting…" : "Submit account details"}
              </button>
            </form>
          </>
        )}

        {state.phase === "success" && (
          <>
            <div className={styles.onboardingSuccess}>
              <span className={styles.onboardingSuccessIcon}>✓</span>
            </div>
            <h1 className={styles.onboardingTitle}>Done!</h1>
            <p className={styles.onboardingMuted}>
              Account details for <strong>{state.candidateName}</strong> have
              been submitted. HR has been notified and will complete the
              onboarding process.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
