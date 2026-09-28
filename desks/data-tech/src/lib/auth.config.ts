import type { NextAuthConfig } from "next-auth";
import type { UserModules } from "@/lib/modules";

declare module "next-auth" {
  interface Session {
    // Set when the DB's tokenVersion/isActive no longer matches this JWT (password
    // changed or account deactivated elsewhere) — callers must treat this as signed out.
    error?: "SessionRevoked";
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: "admin" | "hod" | "tech";
      departmentId: string | null;
      mustChangePassword: boolean;
      // Fetched fresh on every session read (see auth.ts), not embedded in the JWT itself,
      // so module changes take effect on the user's next request instead of waiting for
      // re-login. role === "admin" bypasses this entirely — always full access.
      modules: UserModules;
    };
  }
  interface User {
    role: "admin" | "hod" | "tech";
    departmentId: string | null;
    tokenVersion: number;
    mustChangePassword: boolean;
  }
}

// next-auth/jwt.d.ts only re-exports "@auth/core/jwt" (`export * from ...`), and TypeScript
// can't merge a `declare module` augmentation onto a re-exporting file — it has to target
// the module that actually declares the interface.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: "admin" | "hod" | "tech";
    departmentId: string | null;
    tokenVersion: number;
    mustChangePassword: boolean;
  }
}

// Edge-safe base config, shared by the full (Node.js) auth.ts and by middleware.ts.
// No providers and no DB access here — Credentials + bcrypt + Postgres don't run on the
// Edge runtime, so middleware only gets a lightweight "is there a valid session cookie"
// check via this config. The DB-backed role/session-revocation check happens in
// requireSession()/requireModule(), which run in Node.js on every dashboard page and API route.
export const authConfig = {
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
    jwt: async ({ token, user }) => {
      if (user) {
        // authorize() in auth.ts always returns an id; the base next-auth User type just
        // declares it optional to accommodate OAuth providers that don't use one.
        token.id = user.id!;
        token.role = user.role;
        token.departmentId = user.departmentId;
        token.tokenVersion = user.tokenVersion;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
  },
} satisfies NextAuthConfig;
