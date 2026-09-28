/**
 * Root not-found page — rendered when `notFound()` is called outside the
 * locale layout, or when no matching route exists at the root level.
 *
 * For locale-prefixed 404s (e.g. /en/missing-page) Next.js will use the
 * locale layout's notFound() — this covers the root edge case.
 *
 * Uses plain inline styles (CSS vars are not available at this level).
 */
import Link from "next/link";

export default function NotFound() {
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
          aria-label="Map"
        >
          🗺️
        </span>

        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            color: "#002368",
          }}
        >
          Page not found
        </h1>

        <p
          style={{
            maxWidth: "40ch",
            color: "#444",
            lineHeight: 1.6,
          }}
        >
          We could not find the page you were looking for. It may have been
          moved or the link may be incorrect.
        </p>

        <Link
          href="/"
          style={{
            marginTop: "0.5rem",
            display: "inline-block",
            padding: "0.75rem 1.75rem",
            background: "#002368",
            color: "#fff",
            borderRadius: "8px",
            fontWeight: 700,
            fontSize: "0.95rem",
            textDecoration: "none",
          }}
        >
          Go to dashboard
        </Link>
      </body>
    </html>
  );
}
