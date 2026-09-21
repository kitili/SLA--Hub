"use client";

import { useRouter } from "@/i18n/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import styles from "./hiring.module.css";

type Mode = "public" | "hr";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export function ApplicationForm({ mode, roles }: { mode: Mode; roles: string[] }) {
  const router = useRouter();
  const [formStartedAt] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [employed, setEmployed] = useState<"Yes" | "No" | "">("");
  const [done, setDone] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (mode !== "public" || !TURNSTILE_SITE_KEY || !turnstileRef.current) {
      return;
    }
    const widget = turnstileRef.current;
    const scriptId = "cf-turnstile-script";
    const render = () => {
      const turnstile = (
        window as unknown as {
          turnstile?: {
            render: (
              el: HTMLElement,
              opts: { sitekey: string; callback: (token: string) => void },
            ) => void;
          };
        }
      ).turnstile;
      if (!turnstile || widget.dataset.rendered === "1") return;
      widget.dataset.rendered = "1";
      turnstile.render(widget, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => setTurnstileToken(token),
      });
    };

    const existing = document.getElementById(scriptId);
    if (existing) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [mode]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);

    const payload = {
      fullName: String(form.get("fullName") || ""),
      email: String(form.get("email") || ""),
      preferredEmail: String(form.get("preferredEmail") || "") || undefined,
      whatsapp: String(form.get("whatsapp") || "") || undefined,
      otherPhone: String(form.get("otherPhone") || "") || undefined,
      location: String(form.get("location") || "") || undefined,
      hearAboutUs: String(form.get("hearAboutUs") || "") || undefined,
      employed: String(form.get("employed") || "") || undefined,
      currentRole: String(form.get("currentRole") || "") || undefined,
      employer: String(form.get("employer") || "") || undefined,
      roleApplied: String(form.get("roleApplied") || ""),
      roleOther: String(form.get("roleOther") || "") || undefined,
      yearsExperience: String(form.get("yearsExperience") || "") || undefined,
      relevantExperience: String(form.get("relevantExperience") || "") || undefined,
      whySilverleaf: String(form.get("whySilverleaf") || "") || undefined,
      linkedin: String(form.get("linkedin") || "") || undefined,
      cvLink: String(form.get("cvLink") || "") || undefined,
      noticePeriod: String(form.get("noticePeriod") || "") || undefined,
      expectedSalary: String(form.get("expectedSalary") || "") || undefined,
      website: String(form.get("website") || ""),
      companyUrl: String(form.get("companyUrl") || ""),
      formStartedAt,
      turnstileToken: mode === "public" ? turnstileToken : undefined,
    };

    try {
      const endpoint =
        mode === "hr" ? "/api/hiring/candidates" : "/api/hiring/apply";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      setLoading(false);

      if (!res.ok) {
        setError(json.error || "Could not submit application");
        return;
      }

      if (mode === "hr") {
        router.push(`/admin/hiring/candidates/${json.candidate.id}`);
        router.refresh();
        return;
      }

      setDone(true);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Submit failed");
    }
  }

  if (done) {
    return (
      <div className={styles.successBox}>
        <p className={styles.successTitle}>Application received. Thank you.</p>
        <p className={styles.muted}>
          We will review your application and be in touch if we would like to
          move forward.
        </p>
      </div>
    );
  }

  const pub = mode === "public";

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <div className={styles.hp} aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
        <label>
          Company URL
          <input name="companyUrl" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Field name="fullName" label="Full name" required />
      <Field name="email" label="Email address" type="email" required />
      <Field
        name="preferredEmail"
        label="Preferred email address"
        type="email"
        required={pub}
      />
      <Field name="whatsapp" label="WhatsApp number" required={pub} />
      <Field
        name="otherPhone"
        label="Other preferred number (if different from above)"
      />
      <Field
        name="location"
        label="Where do you reside currently? (city & country)"
        required={pub}
      />
      <Field
        name="hearAboutUs"
        label="How did you hear about us?"
        required={pub}
      />

      <div className={styles.field}>
        <span className={styles.label}>
          Are you currently employed?{pub ? " *" : ""}
        </span>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="employed"
              value="Yes"
              required={pub}
              onChange={() => setEmployed("Yes")}
            />
            Yes
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="employed"
              value="No"
              onChange={() => setEmployed("No")}
            />
            No
          </label>
        </div>
      </div>

      {employed === "Yes" && (
        <>
          <Field name="currentRole" label="Current role (title)" />
          <Field name="employer" label="Name of current employer" />
        </>
      )}

      <div className={styles.field}>
        <span className={styles.label}>
          Which position would you like to be considered for?{pub ? " *" : ""}
        </span>
        <select
          name="roleApplied"
          required
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={styles.input}
        >
          <option value="">Select a role…</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
          <option value="Other">Other</option>
        </select>
      </div>

      {role === "Other" && (
        <Field name="roleOther" label="Please describe the role" required />
      )}

      <Field
        name="yearsExperience"
        label="How many years have you been in a similar role? (number only)"
        type="number"
        required={pub}
      />

      <TextArea
        name="relevantExperience"
        label="What is your most relevant experience to this role?"
        required={pub}
      />

      <TextArea
        name="whySilverleaf"
        label="Why are you applying to this role at Silverleaf Academy? After reviewing the JD, what makes you a strong fit?"
        required={pub}
      />

      <Field
        name="linkedin"
        label="LinkedIn profile link"
        required={pub}
      />
      <Field
        name="cvLink"
        label="Paste a link to your most recent CV (ensure view access is granted)"
        required={pub}
      />
      <Field name="noticePeriod" label="Notice period (in days)" type="number" />
      <Field
        name="expectedSalary"
        label="Expected monthly gross salary in TZS (before tax)"
        required={pub}
      />

      {error ? <p className={styles.error}>{error}</p> : null}

      {pub && TURNSTILE_SITE_KEY ? (
        <div ref={turnstileRef} className={styles.turnstile} />
      ) : null}

      <button type="submit" disabled={loading} className={styles.submit}>
        {loading
          ? "Submitting…"
          : mode === "hr"
            ? "Create candidate"
            : "Submit application"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className={styles.input}
      />
    </label>
  );
}

function TextArea({
  name,
  label,
  required,
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <textarea name={name} required={required} rows={4} className={styles.input} />
    </label>
  );
}
