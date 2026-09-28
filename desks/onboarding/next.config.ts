import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  serverExternalPackages: ["@electric-sql/pglite", "unpdf", "pdfjs-dist", "mammoth"],

  experimental: {
    serverActions: {
      // Allow video uploads up to 500 MB via server actions.
      bodySizeLimit: "500mb",
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
            // Deny powerful browser features the app never uses, shrinking the
            // blast radius if a script ever runs unexpectedly.
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // next/font inlines @font-face; progress bars use inline style attrs
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Google Fonts CDN (legacy / fallback)
              "font-src 'self' https://fonts.gstatic.com data:",
              // PDF.js and image thumbnails may use blob/data URIs
              "img-src 'self' data: blob:",
              // Next.js dev overlay uses eval in development; restrict in prod
              // 'unsafe-inline' is required for Next.js App Router inline
              // hydration/streaming scripts. Hardening TODO: switch to a
              // per-request nonce in middleware.ts and drop 'unsafe-inline'.
              `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
              // PDF viewer is same-origin; YouTube embeds need youtube.com
              "frame-src 'self' https://www.youtube.com https://challenges.cloudflare.com",
              // Server actions, API routes, Vercel Blob direct-upload.
              // Private blobs upload to {storeId}.private.blob.vercel-storage.com
              // which is two levels deep — the wildcard covers that one level.
              "connect-src 'self' https://*.private.blob.vercel-storage.com https://*.public.blob.vercel-storage.com https://challenges.cloudflare.com",
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

export default withNextIntl(nextConfig);
