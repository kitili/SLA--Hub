"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "./BrandLogo";

export function QrPoster({ checkInUrl }: { checkInUrl?: string }) {
  const [href, setHref] = useState(checkInUrl ?? "");
  const [publicUrl, setPublicUrl] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (checkInUrl) {
      setHref(checkInUrl);
      setPublicUrl(!checkInUrl.includes("localhost") && !checkInUrl.match(/192\.168\.|172\.(1[6-9]|2\d|3[01])\.|10\./));
      return;
    }
    void fetch("/api/check-in-url")
      .then((response) => response.json())
      .then((payload: { url: string; isPublic?: boolean }) => {
        setHref(payload.url);
        setPublicUrl(Boolean(payload.isPublic));
      })
      .catch(() => undefined);
  }, [checkInUrl]);

  async function copyLink() {
    if (!href) return;
    await navigator.clipboard.writeText(href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="qr-single-layout">
      <div className="card qr-single-card">
        <div className="qr-single-banner">
          <BrandLogo variant="white" height={36} />
          <h2>Visitor self check-in</h2>
          <p>Scan to open the sign-in form · all campuses</p>
        </div>
        {href ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/api/qr"
            alt="QR code for Silverleaf visitor self check-in"
            width={320}
            height={320}
          />
        ) : (
          <p>Generating QR…</p>
        )}
        <p className="sub">
          Scan with any phone camera. The visitor form opens in the browser — Wi‑Fi or mobile data
          both work{publicUrl ? " with this public link" : ""}.
        </p>
        {href ? (
          <div className="qr-link-box">
            <span className="qr-link-label">Link inside this QR code</span>
            <a href={href} className="qr-link-strong" target="_blank" rel="noopener noreferrer">
              {href}
            </a>
            <button type="button" className="ghost-btn qr-copy-btn" onClick={() => void copyLink()}>
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        ) : null}
        {!publicUrl ? (
          <div className="qr-network-hint">
            <strong>Start the public link:</strong> run <code>npm run dev:public</code> so the QR
            uses an internet address that works from any network.
          </div>
        ) : null}
      </div>
    </div>
  );
}
