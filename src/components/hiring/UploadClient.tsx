"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import styles from "./hiring.module.css";

type Meta = {
  fullName: string;
  role: string;
  stage: "culture" | "performance";
  maxMB: number;
};

export default function UploadClient() {
  const params = useParams<{ token: string }>();
  const search = useSearchParams();
  const token = params.token;
  const stage = (search.get("stage") || "culture") as "culture" | "performance";

  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/hiring/upload?token=${encodeURIComponent(token)}&stage=${stage}`,
      );
      const json = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setError(json.error || "Invalid upload link");
        return;
      }
      setMeta(json);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, stage]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formEl = e.currentTarget;
    const fileInput = formEl.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      setLoading(false);
      return;
    }

    const body = new FormData();
    body.set("token", token);
    body.set("stage", stage);
    body.set("file", file);

    const res = await fetch("/api/hiring/upload", { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(json.error || "Upload failed");
      return;
    }

    setDone(true);
  }

  return (
    <main className={styles.uploadMain}>
      <p className={styles.kicker}>Silverleaf Academy</p>
      <h1 className={styles.uploadTitle}>
        {stage === "culture" ? "Culture Video Upload" : "Performance Task Upload"}
      </h1>

      {meta ? (
        <>
          <p className={styles.muted}>
            {meta.fullName} · {meta.role}
            <br />
            Max {meta.maxMB} MB
            {stage === "culture" ? " · video (MP4 preferred)" : ""}
          </p>
          {stage === "culture" ? (
            <p className={styles.uploadTip}>
              If your video is too large, compress it first at{" "}
              <a
                href="https://www.redpandacompress.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                redpandacompress.com
              </a>{" "}
              — it&apos;s free and works in your browser.
            </p>
          ) : null}
        </>
      ) : null}

      {done ? (
        <div className={styles.successBox}>
          <p className={styles.successTitle}>
            Thank you — your file was received.
          </p>
          <p className={styles.muted}>
            Our HR team will review and follow up by email.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className={styles.uploadForm}>
          <label className={styles.field}>
            <span className={styles.label}>Choose file</span>
            <input
              name="file"
              type="file"
              required
              accept={stage === "culture" ? "video/*" : undefined}
            />
          </label>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button
            type="submit"
            disabled={loading || !meta}
            className={styles.submit}
          >
            {loading ? "Uploading…" : "Upload"}
          </button>
        </form>
      )}
    </main>
  );
}
