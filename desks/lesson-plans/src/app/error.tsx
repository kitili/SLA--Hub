"use client";

/**
 * Global error boundary — catches unhandled errors in the React tree above
 * the root layout. Must be a Client Component per Next.js requirements.
 *
 * Rendered outside the locale layout, so we use plain English (the locale
 * context is unavailable at this level). On-brand styling via inline styles
 * referencing CSS custom properties defined in globals.css.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/error
 */
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#ECECEC",
          color: "#000",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
          gap: "1.25rem",
        }}
      >
        <span
          style={{ fontSize: "3rem", lineHeight: 1 }}
          role="img"
          aria-label="Warning"
        >
          ⚠️
        </span>

        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            color: "#002368",
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            maxWidth: "40ch",
            color: "#444",
            lineHeight: 1.6,
          }}
        >
          An unexpected error occurred. Please try again, or return to the
          dashboard.
        </p>

        {error.digest && (
          <p
            style={{
              fontSize: "0.75rem",
              color: "#818283",
              fontFamily: "monospace",
            }}
          >
            Error ID: {error.digest}
          </p>
        )}

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={reset}
            style={{
              padding: "0.75rem 1.75rem",
              background: "#002368",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link
            href="/"
            style={{
              padding: "0.75rem 1.75rem",
              background: "transparent",
              color: "#002368",
              border: "2px solid #002368",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.95rem",
              textDecoration: "none",
            }}
          >
            Go to dashboard
          </Link>
        </div>
      </body>
    </html>
  );
}
