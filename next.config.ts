import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(fileURLToPath(new URL(".", import.meta.url))),
  serverExternalPackages: [
    "better-sqlite3",
    "@electric-sql/pglite",
    "unpdf",
    "pdfjs-dist",
    "mammoth",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
