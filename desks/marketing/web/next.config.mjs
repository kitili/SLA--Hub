import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep Turbopack rooted on this package (repo has a parent lockfile noise otherwise).
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/calendar/embed',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://silverleaf.co.tz https://www.silverleaf.co.tz https://*.wix.com https://*.wixsite.com https://*.editorx.io",
          },
        ],
      },
    ];
  },
  async rewrites() {
    const apiOrigin = process.env.API_PROXY_ORIGIN
      || (process.env.VERCEL ? 'https://sla-marketing-api.vercel.app' : 'http://127.0.0.1:5001');
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
