"use client";

import { useState } from "react";

import adminStyles from "@/components/admin/admin.module.css";
import type { Candidate } from "@/lib/hiring/types";

export function HiringOnboardingPanel({ candidate: initial }: { candidate: Candidate }) {
  const [candidate, setCandidate] = useState(initial);
  const [startInfo, setStartInfo] = useState("");
  const [contract, setContract] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleResendIt() {
    setResending(true);
    setMsg(null);
    const res = await fetch(`/api/hiring/candidates/${candidate.id}/resend-it-email`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: "IT notification resent." } : { ok: false, text: data.error || "Failed to resend." });
    setResending(false);
  }

  async function handleSendWelcome(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMsg(null);
    const form = new FormData();
    form.append("startInfo", startInfo);
    if (contract) form.append("contract", contract);
    const res = await fetch(`/api/hiring/candidates/${candidate.id}/send-welcome`, {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setCandidate((current) => ({
        ...current,
        welcome_email_sent_at: new Date().toISOString(),
      }));
      setMsg({ ok: true, text: "Welcome email sent to the candidate." });
    } else {
      setMsg({ ok: false, text: data.error || "Failed to send." });
    }
    setSending(false);
  }

  const itDone = Boolean(candidate.it_submitted_at);
  const welcomed = Boolean(candidate.welcome_email_sent_at);

  return (
    <div>
      <h2 style={{ marginBottom: "1rem" }}>Onboarding</h2>

      {/* Step 1 — IT account setup */}
      <div className={adminStyles.onboardingStep}>
        <div className={adminStyles.onboardingStepMarker} data-done={itDone}>
          {itDone ? "✓" : "1"}
        </div>
        <div className={adminStyles.onboardingStepBody}>
          <p className={adminStyles.onboardingStepTitle}>IT — create work email</p>
          {itDone ? (
            <div>
              <p className={adminStyles.onboardingStepMuted}>
                IT has set up the account.
              </p>
              {candidate.work_email ? (
                <p style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--electric-blue)" }}>
                  {candidate.work_email}
                </p>
              ) : null}
            </div>
          ) : (
            <div>
              <p className={adminStyles.onboardingStepMuted}>
                An email was sent to IT when this candidate was marked as hired.
                If IT has not received it, resend below.
              </p>
              <button
                type="button"
                onClick={handleResendIt}
                disabled={resending}
                className={`${adminStyles.btn} ${adminStyles.btnSecondary} ${adminStyles.btnSmall}`}
              >
                {resending ? "Resending…" : "Resend IT email"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Step 2 — HR creates ed admin profile */}
      <div className={adminStyles.onboardingStep}>
        <div
          className={adminStyles.onboardingStepMarker}
          data-done={itDone && welcomed}
          data-pending={!itDone}
        >
          {welcomed ? "✓" : "2"}
        </div>
        <div className={adminStyles.onboardingStepBody}>
          <p className={adminStyles.onboardingStepTitle}>HR — create ed admin profile</p>
          {welcomed ? (
            <p className={adminStyles.onboardingStepMuted}>
              Welcome email sent on{" "}
              {new Date(candidate.welcome_email_sent_at!).toLocaleString("en-GB", {
                timeZone: "Africa/Dar_es_Salaam",
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : itDone ? (
            <div>
              <p className={adminStyles.onboardingStepMuted}>
                Create the ed admin profile using the credentials emailed to you.
                When ready, send the welcome email to the candidate below.
              </p>
              <form onSubmit={handleSendWelcome} style={{ marginTop: "0.75rem" }}>
                <div style={{ marginBottom: "0.5rem" }}>
                  <label
                    htmlFor="start-info"
                    style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.25rem" }}
                  >
                    Reporting details for the candidate (optional)
                  </label>
                  <textarea
                    id="start-info"
                    value={startInfo}
                    onChange={(e) => setStartInfo(e.target.value)}
                    rows={3}
                    placeholder="e.g. Please report to the main campus on Monday 5th at 8:00 AM. Ask for Amina at reception."
                    className={adminStyles.textarea}
                  />
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <label
                    htmlFor="contract-file"
                    style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.25rem" }}
                  >
                    Employment contract (optional — PDF or Word, max 10 MB)
                  </label>
                  <input
                    id="contract-file"
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => setContract(e.target.files?.[0] ?? null)}
                    className={adminStyles.fileInput}
                  />
                  {contract ? (
                    <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                      {contract.name} ({(contract.size / 1024).toFixed(0)} KB) — will be attached to the email
                    </p>
                  ) : null}
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className={adminStyles.btn}
                >
                  {sending ? "Sending…" : "Send welcome email to candidate"}
                </button>
              </form>
            </div>
          ) : (
            <p className={adminStyles.onboardingStepMuted}>
              Waiting for IT to complete account setup.
            </p>
          )}
        </div>
      </div>

      {msg ? (
        <p
          style={{
            marginTop: "1rem",
            fontSize: "0.875rem",
            color: msg.ok ? "#16a34a" : "#b91c1c",
            fontWeight: 600,
          }}
        >
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
