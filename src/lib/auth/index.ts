/**
 * Auth barrel — re-exports the identity interface.
 *
 * Import identity helpers from "@/lib/auth" to avoid deep-path imports.
 *
 * Mutating sign-in/out for Client Components lives in the OTP actions
 * (`@/lib/actions/otp`) — a work-email code, not the ed-admin directory.
 */

export {
  getCurrentUser,
  requireUser,
  requireAdmin,
  requireRole,
  signIn,
  signOut,
} from "./identity";

export type { AuthProvider } from "./provider";
