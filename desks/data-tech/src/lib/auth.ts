import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, userModules, loginOtpCodes, departments } from "@/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { authConfig } from "@/lib/auth.config";
import { withDataTechModules, type UserModules } from "@/lib/modules";
import { isDevAuthBypassEnabled, loadDevBypassSession } from "@/lib/dev-bypass";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 30;
// Never used to authenticate — only so a bcrypt.compare() runs on every attempt,
// keeping the timing (and the generic failure) identical whether the email exists or not.
const DUMMY_HASH = "$2b$12$CwG9k0pQe1xO8m2r9J1fbeC0V1qk8m2r9J1fbeC0V1qk8m2r9J1fb";

const nextAuth = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "")
          .toLowerCase()
          .trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const rateLimit = await checkRateLimit(`login:${email}`, 10, 15 * 60);
        if (!rateLimit.allowed) return null;

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

        const isLocked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());
        const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

        if (!user || !user.isActive || isLocked || !valid) {
          if (user && !isLocked && !valid) {
            await recordFailedLogin(user.id, user.failedLoginAttempts);
          }
          return null;
        }

        if (user.failedLoginAttempts > 0) {
          await db
            .update(users)
            .set({ failedLoginAttempts: 0, lockedUntil: null })
            .where(eq(users.id, user.id));
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
          tokenVersion: user.tokenVersion,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
    Credentials({
      id: "otp",
      name: "Email code",
      credentials: { email: {}, code: {} },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "")
          .toLowerCase()
          .trim();
        const code = String(credentials?.code ?? "").trim();
        if (!email || !code) return null;

        const rateLimit = await checkRateLimit(`otp-verify:${email}`, 8, 15 * 60);
        if (!rateLimit.allowed) return null;

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user || !user.isActive) {
          await bcrypt.compare(code, DUMMY_HASH);
          return null;
        }

        const [otpRow] = await db
          .select()
          .from(loginOtpCodes)
          .where(and(eq(loginOtpCodes.userId, user.id), isNull(loginOtpCodes.usedAt)))
          .orderBy(desc(loginOtpCodes.createdAt))
          .limit(1);

        const valid = await bcrypt.compare(code, otpRow?.codeHash ?? DUMMY_HASH);
        const isExpired = !otpRow || otpRow.expiresAt < new Date();
        if (!otpRow || isExpired || !valid) return null;

        await db.update(loginOtpCodes).set({ usedAt: new Date() }).where(eq(loginOtpCodes.id, otpRow.id));

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
          tokenVersion: user.tokenVersion,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    session: async ({ session, token }) => {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.departmentId = token.departmentId;
      session.user.mustChangePassword = token.mustChangePassword;

      // Re-checked on every session read so a password change or deactivation takes
      // effect immediately instead of waiting for the JWT to expire on its own.
      const [dbUser] = await db
        .select({
          tokenVersion: users.tokenVersion,
          isActive: users.isActive,
          departmentName: departments.name,
        })
        .from(users)
        .leftJoin(departments, eq(users.departmentId, departments.id))
        .where(eq(users.id, token.id))
        .limit(1);

      if (!dbUser || !dbUser.isActive || dbUser.tokenVersion !== token.tokenVersion) {
        session.error = "SessionRevoked";
      }

      // Admins bypass the module system entirely, so there's no need to query it for them.
      const modules: UserModules = {};
      if (token.role !== "admin") {
        const rows = await db
          .select({ module: userModules.module, level: userModules.level })
          .from(userModules)
          .where(eq(userModules.userId, token.id));
        for (const row of rows) modules[row.module] = row.level;
        session.user.modules = withDataTechModules(modules, dbUser?.departmentName);
      } else {
        session.user.modules = modules;
      }

      return session;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;

export async function auth() {
  const session = await nextAuth.auth();
  if (session?.user && session.error !== "SessionRevoked") return session;
  return loadDevBypassSession();
}

export { isDevAuthBypassEnabled };

async function recordFailedLogin(userId: string, currentAttempts: number) {
  const attempts = currentAttempts + 1;
  const lockedUntil =
    attempts >= LOCKOUT_THRESHOLD ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;

  await db.update(users).set({ failedLoginAttempts: attempts, lockedUntil }).where(eq(users.id, userId));
}
