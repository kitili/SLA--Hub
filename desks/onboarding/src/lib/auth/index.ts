/**
 * Auth barrel — re-exports the identity interface.
 *
 * Import identity helpers from "@/lib/auth" to avoid deep-path imports.
 *
 * Mutating sign-in/out for Client Components lives in the member server actions
 * (`@/lib/actions/member`), which enforce the ed-admin directory gate.
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
