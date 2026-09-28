"use client";

import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";

import styles from "./view.module.css";

export default function DocxPreview({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const container = ref.current;
    if (!container) return;

    container.innerHTML = "";
    setStatus("loading");

    fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load document");
        return response.blob();
      })
      .then((blob) => {
        if (cancelled || !ref.current) return;
        return renderAsync(blob, ref.current, undefined, {
          className: styles.docxContent,
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
        });
      })
      .then(() => {
        if (!cancelled) setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div className={styles.docxWrap} aria-label={title}>
      {status === "loading" && (
        <p className={styles.docxStatus}>Loading Word document...</p>
      )}
      {status === "error" && (
        <div className={styles.placeholder}>
          <span aria-hidden>File</span>
          <h1>Preview unavailable</h1>
          <p>This Word document could not be previewed, but it is still served locally from the hub.</p>
          <a className={styles.openLink} href={src}>
            Open local file
          </a>
        </div>
      )}
      <div ref={ref} className={styles.docxPreview} />
    </div>
  );
}
