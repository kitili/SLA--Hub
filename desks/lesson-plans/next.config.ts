import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // PGlite ships a WASM payload it loads via its own module resolution. Letting
  // webpack bundle it rewrites those paths and breaks under Node >= 23 (fs.readFile
  // receives a URL instead of a path). Externalizing keeps PGlite a normal runtime
  // require so the embedded driver works inside the Next.js server runtime — not
  // just in CLI scripts. (On Vercel, DATABASE_URL is set and postgres-js is used.)
  //
  // `pdf-to-img` wraps pdfjs-dist, whose ESM build crashes at *module load* when
  // webpack transforms it ("Object.defineProperty called on non-object"), taking
  // down the whole /api/ai/textbooks route on import. Externalizing keeps it a
  // plain runtime require so the route loads and the rasterise step (Node-only,
  // runs inside a workflow step) resolves it normally.
  serverExternalPackages: ["@electric-sql/pglite", "pdf-to-img"],

  experimental: {
    // SOW uploads send the docx base64-encoded through a Server Action, which
    // inflates the payload ~33%. A ~1MB scheme docx therefore exceeds the 1MB
    // default Server Actions body limit ("Body exceeded 1 MB limit") and the
    // action is rejected before parsing. Raise it so real scheme files
    // (admin-only uploads) go through. base64 of an 8MB file is ~6MB raw —
    // ample headroom for richer schemes.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },

  /**
   * Security headers applied to all routes.
   *
   * CSP is intentionally permissive on style-src (`unsafe-inline`) because:
   *  - next/font inlines font-face declarations
   *  - progress bars in dashboard.module.css use inline `style` attributes
   *  - the StaffRegistration overlay uses inline styles
   *
   * img-src includes `blob:` for PDF.js canvas exports and `data:` for base64
   * thumbnails. frame-src `'self'` covers the PDF viewer route.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // next/font inlines @font-face; progress bars use inline style attrs
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Google Fonts CDN for Montserrat
              "font-src 'self' https://fonts.gstatic.com data:",
              // PDF.js and image thumbnails may use blob/data URIs
              "img-src 'self' data: blob:",
              // Next.js dev overlay uses eval in development; restrict in prod
              // 'unsafe-inline' is required for Next.js App Router inline
              // hydration/streaming scripts. Hardening TODO: switch to a
              // per-request nonce in middleware.ts and drop 'unsafe-inline'.
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
              // PDF viewer iframe is same-origin
              "frame-src 'self'",
              // Server actions, API routes, Supabase/Vercel Postgres endpoints
              "connect-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

/**
 * next-intl plugin — points at the per-request i18n config so message catalogs
 * and the active locale are available to Server Components.
 *
 * @see docs/i18n.md
 */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Compose the two config plugins. `withNextIntl(nextConfig)` returns a
 * `NextConfig` object (the next-intl plugin only returns a function when its
 * input is a function — here we pass the plain object), which we then wrap with
 * `withWorkflow` so the Workflow DevKit's webpack/turbopack loaders can
 * transform the `"use workflow"` / `"use step"` directives.
 *
 * `withWorkflow` also reconciles `serverExternalPackages`: if a package there
 * contains workflow code it would be removed for the build, but our only entry
 * (`@electric-sql/pglite`) has none, so the externalization is preserved.
 *
 * @see node_modules/workflow/docs/api-reference/workflow-next/with-workflow.mdx
 */
export default withWorkflow(withNextIntl(nextConfig));
