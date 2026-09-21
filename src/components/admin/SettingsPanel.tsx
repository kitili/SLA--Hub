"use client";

import { useState, useRef } from "react";

import styles from "./admin.module.css";

type SettingDef = {
  key: string;
  label: string;
  description: string;
  placeholder: string;
  type?: "email" | "text" | "tel" | "url" | "video-url" | "dept-video-list" | "dept-email-list";
};

type SettingSection = {
  title: string;
  defs: SettingDef[];
};

const SETTING_SECTIONS: SettingSection[] = [
  {
    title: "Pipeline email recipients",
    defs: [
      {
        key: "hr_email",
        label: "HR / General hiring email",
        description:
          "Receives IT onboarding submissions (work email + temp password) and any general hiring notifications. Defaults to the GOOGLE_HR_EMAIL environment variable.",
        placeholder: "jobs@silverleaf.co.tz",
        type: "email",
      },
      {
        key: "it_email",
        label: "IT department email",
        description:
          "When a candidate is hired, an account-creation request is sent to this address. IT fills in the new work email and submits it back to HR via a secure form link.",
        placeholder: "it@silverleaf.co.tz",
        type: "email",
      },
      {
        key: "culture_notify_email",
        label: "Culture video — reviewer email",
        description:
          "Notified when a candidate submits their culture video. Leave blank to skip the notification.",
        placeholder: "hr@silverleaf.co.tz",
        type: "email",
      },
      {
        key: "performance_dept_emails",
        label: "Performance task — department reviewer emails",
        description:
          "When a candidate submits their performance task, HR (the HR / General hiring email above) is always notified. Add department HOD email(s) here so HR can also CC the relevant department when sending a task.",
        placeholder: "",
        type: "dept-email-list",
      },
    ],
  },
  {
    title: "Meet the people — intro videos",
    defs: [
      {
        key: "team_video_ceo",
        label: "CEO / Founder intro video",
        description: "Paste a YouTube link for the CEO / Founder introduction card.",
        placeholder: "https://www.youtube.com/watch?v=...",
        type: "video-url",
      },
      {
        key: "team_video_hos",
        label: "Head of School intro video",
        description: "Paste a YouTube link for the Head of School introduction card.",
        placeholder: "https://www.youtube.com/watch?v=...",
        type: "video-url",
      },
      {
        key: "team_video_hr",
        label: "People / HR intro video",
        description: "Paste a YouTube link for the People / HR introduction card.",
        placeholder: "https://www.youtube.com/watch?v=...",
        type: "video-url",
      },
      {
        key: "team_video_dept",
        label: "Department Leads intro videos",
        description: "Add one YouTube link per department head. Each entry has a department label and a YouTube link.",
        placeholder: "",
        type: "dept-video-list",
      },
    ],
  },
  {
    title: "Contact details in emails",
    defs: [
      {
        key: "contact_phone_1",
        label: "Primary contact phone",
        description:
          "Shown in email footers so candidates can reach HR for help. Use international format (e.g. +255 712 345 678).",
        placeholder: "+255 712 345 678",
        type: "tel",
      },
      {
        key: "contact_phone_2",
        label: "Secondary contact phone",
        description:
          "Optional second number shown alongside the primary. Leave blank to omit.",
        placeholder: "+255 754 000 000",
        type: "tel",
      },
    ],
  },
];

export function SettingsPanel({
  initialSettings,
}: {
  initialSettings: Record<string, string>;
}) {
  const [values, setValues] = useState<Record<string, string>>(initialSettings);
  const [saving, setSaving] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Record<string, { ok: boolean; text: string }>>({});

  async function save(key: string) {
    setSaving(key);
    setMsgs((prev) => ({ ...prev, [key]: { ok: true, text: "" } }));
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: values[key] ?? "" }),
    });
    const data = await res.json().catch(() => ({}));
    setMsgs((prev) => ({
      ...prev,
      [key]: res.ok
        ? { ok: true, text: "Saved." }
        : { ok: false, text: data.error || "Failed to save." },
    }));
    setSaving(null);
  }

  function renderDef(def: SettingDef) {
    return (
      <div key={def.key} className={styles.settingRow}>
        <div className={styles.settingInfo}>
          <p className={styles.settingLabel}>{def.label}</p>
          <p className={styles.settingDesc}>{def.description}</p>
        </div>
        {def.type === "dept-email-list" ? (
          <DeptEmailListField initialValue={values[def.key] ?? ""} settingKey={def.key} />
        ) : def.type === "dept-video-list" ? (
          <DeptVideoListField initialValue={values[def.key] ?? ""} />
        ) : def.type === "video-url" ? (
          <VideoUrlField settingKey={def.key} initialUrl={values[def.key] ?? ""} />
        ) : (
          <div className={styles.settingControl}>
            <input
              type={def.type || "text"}
              value={values[def.key] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [def.key]: e.target.value }))
              }
              placeholder={def.placeholder}
              className={styles.input}
            />
            <button
              type="button"
              onClick={() => save(def.key)}
              disabled={saving === def.key}
              className={`${styles.btn} ${styles.btnSmall}`}
              style={{ marginTop: "0.4rem" }}
            >
              {saving === def.key ? "Saving…" : "Save"}
            </button>
            {msgs[def.key]?.text ? (
              <p
                style={{
                  fontSize: "0.8rem",
                  marginTop: "0.25rem",
                  color: msgs[def.key]?.ok ? "#16a34a" : "#b91c1c",
                  fontWeight: 600,
                }}
              >
                {msgs[def.key]?.text}
              </p>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {SETTING_SECTIONS.map((section) => (
        <div key={section.title} className={styles.card} style={{ marginBottom: "1rem" }}>
          <div className={styles.cardHeader}>
            <h2>{section.title}</h2>
          </div>
          {section.defs.map(renderDef)}
        </div>
      ))}
      <TestWelcomeEmailCard />
    </div>
  );
}

// ── Test welcome email ────────────────────────────────────────────────────────

function TestWelcomeEmailCard() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [contract, setContract] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMsg(null);
    const form = new FormData();
    form.append("email", email.trim());
    form.append("name", name.trim());
    form.append("role", role.trim());
    if (contract) form.append("contract", contract);
    const res = await fetch("/api/admin/settings/test-welcome-email", {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({ ok: true, text: `Test email sent to ${email.trim()}.` });
      setEmail("");
      setName("");
      setRole("");
      setContract(null);
      if (fileRef.current) fileRef.current.value = "";
    } else {
      setMsg({ ok: false, text: data.error || "Failed to send." });
    }
    setSending(false);
  }

  return (
    <div className={styles.card} style={{ marginBottom: "1rem" }}>
      <div className={styles.cardHeader}>
        <h2>Test — welcome email with contract</h2>
      </div>
      <div className={styles.settingRow}>
        <div className={styles.settingInfo}>
          <p className={styles.settingLabel}>Send a test welcome email</p>
          <p className={styles.settingDesc}>
            Sends a copy of the candidate welcome email (subject prefixed with [TEST]) to any
            address so you can verify the layout and check that a contract attachment arrives
            correctly. Nothing is saved; no candidate record is changed.
          </p>
        </div>
        <div className={styles.settingControl}>
          <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Recipient email address *"
              required
              className={styles.input}
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Recipient name (optional, defaults to 'Test Recipient')"
              className={styles.input}
            />
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Role / position (optional, defaults to 'Staff Member')"
              className={styles.input}
            />
            <div>
              <label
                htmlFor="test-contract-file"
                style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.25rem" }}
              >
                Contract to attach (optional — PDF or Word, max 10 MB)
              </label>
              <input
                ref={fileRef}
                id="test-contract-file"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setContract(e.target.files?.[0] ?? null)}
                className={styles.fileInput}
              />
              {contract ? (
                <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                  {contract.name} ({(contract.size / 1024).toFixed(0)} KB) — will be attached
                </p>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={sending || !email.trim()}
              className={`${styles.btn} ${styles.btnSmall}`}
              style={{ alignSelf: "flex-start", marginTop: "0.25rem" }}
            >
              {sending ? "Sending…" : "Send test email"}
            </button>
          </form>
          {msg ? (
            <p style={{ fontSize: "0.82rem", marginTop: "0.5rem", fontWeight: 600, color: msg.ok ? "#16a34a" : "#b91c1c" }}>
              {msg.text}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Single YouTube URL field (CEO / HOS / HR) ─────────────────────────────────

function VideoUrlField({
  settingKey,
  initialUrl,
}: {
  settingKey: string;
  initialUrl: string;
}) {
  const [savedUrl, setSavedUrl] = useState(initialUrl);
  const [inputVal, setInputVal] = useState(initialUrl);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isDirty = inputVal.trim() !== savedUrl;

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: settingKey, value: inputVal.trim() }),
    });
    if (res.ok) {
      setSavedUrl(inputVal.trim());
      setMsg({ ok: true, text: "Saved." });
    } else {
      setMsg({ ok: false, text: "Failed to save." });
    }
    setSaving(false);
  }

  async function handleRemove() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: settingKey, value: "" }),
    });
    if (res.ok) {
      setSavedUrl("");
      setInputVal("");
      setMsg({ ok: true, text: "Removed." });
    } else {
      setMsg({ ok: false, text: "Failed to remove." });
    }
    setSaving(false);
  }

  return (
    <div className={styles.settingControl}>
      {savedUrl && (
        <p style={{ fontSize: "0.82rem", color: "#16a34a", fontWeight: 600, margin: "0 0 0.4rem" }}>
          ✓ YouTube link set
        </p>
      )}
      <input
        type="url"
        value={inputVal}
        onChange={(e) => { setInputVal(e.target.value); setMsg(null); }}
        placeholder="https://www.youtube.com/watch?v=..."
        className={styles.input}
        disabled={saving}
      />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty || !inputVal.trim()}
          className={`${styles.btn} ${styles.btnSmall}`}
        >
          {saving ? "Saving…" : savedUrl ? "Update" : "Save"}
        </button>
        {savedUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={saving}
            className={`${styles.btn} ${styles.btnSmall}`}
            style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}
          >
            Remove
          </button>
        )}
      </div>
      {msg?.text && (
        <p style={{ fontSize: "0.8rem", marginTop: "0.25rem", color: msg.ok ? "#16a34a" : "#b91c1c", fontWeight: 600 }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

// ── Department reviewer email list ────────────────────────────────────────────

type DeptEmailEntry = { label: string; email: string };

function parseDeptEmailList(value: string): DeptEmailEntry[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as DeptEmailEntry[];
  } catch {
    // ignore
  }
  return [];
}

async function saveDeptEmailList(entries: DeptEmailEntry[], settingKey: string) {
  await fetch("/api/admin/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: settingKey, value: JSON.stringify(entries) }),
  });
}

function DeptEmailListField({
  initialValue,
  settingKey,
}: {
  initialValue: string;
  settingKey: string;
}) {
  const [entries, setEntries] = useState<DeptEmailEntry[]>(parseDeptEmailList(initialValue));
  const [newLabel, setNewLabel] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!newLabel.trim()) { setError("Enter a department name."); return; }
    if (!newEmail.trim() || !newEmail.includes("@")) { setError("Enter a valid email address."); return; }
    setError("");
    setSaving(true);
    const next: DeptEmailEntry[] = [...entries, { label: newLabel.trim(), email: newEmail.trim().toLowerCase() }];
    setEntries(next);
    await saveDeptEmailList(next, settingKey);
    setNewLabel("");
    setNewEmail("");
    setSaving(false);
  }

  async function handleRemove(email: string) {
    const next = entries.filter((e) => e.email !== email);
    setEntries(next);
    await saveDeptEmailList(next, settingKey);
  }

  return (
    <div className={styles.settingControl}>
      {entries.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.75rem" }}>
          {entries.map((entry) => (
            <div
              key={entry.email}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                padding: "0.4rem 0.7rem",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: "0.88rem", flex: 1, minWidth: "7rem" }}>
                {entry.label}
              </span>
              <span style={{ fontSize: "0.84rem", color: "#475569" }}>
                {entry.email}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(entry.email)}
                className={`${styles.btn} ${styles.btnSmall}`}
                style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "#718096", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
          No department emails yet. HR is always notified; add HOD emails below so HR can CC them.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", margin: 0 }}>
          Add department
        </p>
        <input
          type="text"
          value={newLabel}
          onChange={(e) => { setNewLabel(e.target.value); setError(""); }}
          placeholder="e.g. Science Department"
          className={styles.input}
          style={{ fontSize: "0.9rem" }}
          disabled={saving}
        />
        <input
          type="email"
          value={newEmail}
          onChange={(e) => { setNewEmail(e.target.value); setError(""); }}
          placeholder="hod@silverleaf.co.tz"
          className={styles.input}
          style={{ fontSize: "0.9rem" }}
          disabled={saving}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving || !newLabel.trim() || !newEmail.trim()}
          className={`${styles.btn} ${styles.btnSmall}`}
          style={{ alignSelf: "flex-start" }}
        >
          {saving ? "Saving…" : "Add"}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: "0.8rem", marginTop: "0.25rem", color: "#b91c1c", fontWeight: 600 }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ── Department leads list ─────────────────────────────────────────────────────

type DeptVideoEntry = { label: string; url: string; active?: boolean };

function parseDeptList(value: string): DeptVideoEntry[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as DeptVideoEntry[];
  } catch {
    // ignore
  }
  return [];
}

async function saveDeptList(entries: DeptVideoEntry[]) {
  await fetch("/api/admin/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "team_video_dept", value: JSON.stringify(entries) }),
  });
}

function DeptVideoListField({ initialValue }: { initialValue: string }) {
  const [entries, setEntries] = useState<DeptVideoEntry[]>(parseDeptList(initialValue));
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!newLabel.trim()) { setError("Enter a department name."); return; }
    if (!newUrl.trim()) { setError("Enter a YouTube link."); return; }
    setError("");
    setSaving(true);
    const next: DeptVideoEntry[] = [...entries, { label: newLabel.trim(), url: newUrl.trim(), active: true }];
    setEntries(next);
    await saveDeptList(next);
    setNewLabel("");
    setNewUrl("");
    setSaving(false);
  }

  async function handleToggle(url: string) {
    const next = entries.map((e) => e.url === url ? { ...e, active: !(e.active ?? true) } : e);
    setEntries(next);
    await saveDeptList(next);
  }

  async function handleRemove(url: string) {
    const next = entries.filter((e) => e.url !== url);
    setEntries(next);
    await saveDeptList(next);
  }

  const isActive = (e: DeptVideoEntry) => e.active !== false;

  return (
    <div className={styles.settingControl}>
      {entries.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
          {entries.map((entry) => (
            <div
              key={entry.url}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                background: isActive(entry) ? "#f8fafc" : "#fafafa",
                border: `1px solid ${isActive(entry) ? "#e2e8f0" : "#e2e8f0"}`,
                borderRadius: "6px",
                padding: "0.4rem 0.7rem",
                flexWrap: "wrap",
                opacity: isActive(entry) ? 1 : 0.55,
              }}
            >
              <span style={{ color: isActive(entry) ? "#16a34a" : "#94a3b8", fontWeight: 700, fontSize: "0.82rem" }}>
                {isActive(entry) ? "▶" : "⏸"}
              </span>
              <span style={{ fontWeight: 600, fontSize: "0.88rem", flex: 1, minWidth: "8rem" }}>
                {entry.label}
              </span>
              <button
                type="button"
                onClick={() => handleToggle(entry.url)}
                className={`${styles.btn} ${styles.btnSmall}`}
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
              >
                {isActive(entry) ? "Deactivate" : "Activate"}
              </button>
              <button
                type="button"
                onClick={() => handleRemove(entry.url)}
                className={`${styles.btn} ${styles.btnSmall}`}
                style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "#718096", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
          No department videos yet.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", margin: 0 }}>
          Add department lead
        </p>
        <input
          type="text"
          value={newLabel}
          onChange={(e) => { setNewLabel(e.target.value); setError(""); }}
          placeholder="e.g. Science Department"
          className={styles.input}
          style={{ fontSize: "0.9rem" }}
          disabled={saving}
        />
        <input
          type="url"
          value={newUrl}
          onChange={(e) => { setNewUrl(e.target.value); setError(""); }}
          placeholder="https://www.youtube.com/watch?v=..."
          className={styles.input}
          style={{ fontSize: "0.9rem" }}
          disabled={saving}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving || !newLabel.trim() || !newUrl.trim()}
          className={`${styles.btn} ${styles.btnSmall}`}
          style={{ alignSelf: "flex-start" }}
        >
          {saving ? "Saving…" : "Add"}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: "0.8rem", marginTop: "0.25rem", color: "#b91c1c", fontWeight: 600 }}>
          {error}
        </p>
      )}
    </div>
  );
}
