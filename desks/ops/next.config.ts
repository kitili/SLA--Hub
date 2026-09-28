import type { NextConfig } from "next";
import path from "path";

const extraDevOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Capacitor / phone on LAN hits dev via 127.0.0.1 or 192.168.x.x — allow assets + HMR.
  allowedDevOrigins: ["127.0.0.1", "localhost", ...extraDevOrigins],
  // Keep Turbopack rooted on this app (avoids parent /home/kiki lockfile)
  turbopack: {
    root: path.join(__dirname),
  },
  async redirects() {
    return [
      {
        source: "/ticketing",
        destination: "/ticketing/index.html",
        permanent: false,
      },
      {
        source: "/driver/navigate",
        destination: "/matron/path",
        permanent: false,
      },
      {
        source: "/driver",
        destination: "/matron",
        permanent: false,
      },
      {
        source: "/driver/:path*",
        destination: "/matron/:path*",
        permanent: false,
      },
      {
        source: "/driver/manifest.webmanifest",
        destination: "/matron-manifest.webmanifest",
        permanent: false,
      },
      {
        source: "/driver-manifest.webmanifest",
        destination: "/matron-manifest.webmanifest",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/downloads/:path*.apk",
        headers: [
          {
            key: "Content-Type",
            value: "application/vnd.android.package-archive",
          },
          {
            key: "Content-Disposition",
            value: 'attachment; filename="Silverleaf-Matron.apk"',
          },
          { key: "Cache-Control", value: "public, max-age=300" },
        ],
      },
    ];
  },
};

export default nextConfig;
