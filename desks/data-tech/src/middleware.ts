import NextAuth from "next-auth";
import { NextResponse } from "next/server";

// This config is intentionally duplicated from src/lib/auth.config.ts rather than imported.
// Vercel's Edge Function bundler for middleware.ts does not reliably inline sibling-file
// imports (it shipped an unresolved `import ... from "./auth.config"` with no such file in
// the deployed bundle, causing "referencing unsupported modules" at deploy time) — only npm
// package imports are guaranteed to be included. Keep this in sync with the JWT shape in
// src/lib/auth.config.ts/auth.ts if either changes.
//
// This file must live at src/middleware.ts, not the repo root — Next.js only auto-detects
// middleware inside src/ when the project uses a src directory (this app's App Router lives
// under src/app). A root-level middleware.ts is silently ignored with no error or warning.
const { auth } = NextAuth({
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/login" },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
    },
  },
  providers: [],
  callbacks: {
    // Default callbacks only ever copy name/email/image onto session.user — mustChangePassword
    // is already a raw JWT claim (set by the real auth.ts jwt callback at sign-in), just never
    // surfaced here. This adds it without any DB access, so it stays Edge-safe.
    session: ({ session, token }) => {
      session.user.mustChangePassword = token.mustChangePassword;
      return session;
    },
  },
});

const PROTECTED_API_PREFIXES = [
  "/api/tickets",
  "/api/tools",
  "/api/systems",
  "/api/users",
  "/api/departments",
  "/api/support-contacts",
  "/api/ticket-notify-recipients",
];

const CHANGE_PASSWORD_PATH = "/dashboard/settings/profile";

function isLocalDevBypass(req: { nextUrl: URL }) {
  if (process.env.NODE_ENV === "production" || process.env.AUTH_DEV_BYPASS !== "1") return false;
  const host = req.nextUrl.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isDashboard = pathname.startsWith("/dashboard");
  const isProtectedApi = PROTECTED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthenticated = Boolean(req.auth?.user) || isLocalDevBypass(req);

  if (!isAuthenticated && (isDashboard || isProtectedApi)) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    isAuthenticated &&
    isDashboard &&
    pathname !== CHANGE_PASSWORD_PATH &&
    req.auth?.user.mustChangePassword
  ) {
    const forcedUrl = new URL(CHANGE_PASSWORD_PATH, req.nextUrl.origin);
    forcedUrl.searchParams.set("forced", "1");
    return NextResponse.redirect(forcedUrl);
  }
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/tickets/:path*",
    "/api/tools/:path*",
    "/api/systems/:path*",
    "/api/users/:path*",
    "/api/departments/:path*",
    "/api/support-contacts/:path*",
    "/api/ticket-notify-recipients/:path*",
  ],
};
