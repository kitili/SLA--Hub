/**
 * Auth barrel — re-exports the identity interface.
 *
 * Import identity helpers from "@/lib/auth" to avoid deep-path imports.
 */

export {
  getCurrentUser,
  requireUser,
  requireAdmin,
  signIn,
  signOut,
  verifyAdminPin,
} from "./identity";

export type { AuthProvider } from "./provider";
