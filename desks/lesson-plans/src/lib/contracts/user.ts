/**
 * CurrentUser — the identity shape produced by the auth layer and consumed
 * everywhere that needs to know who is acting.  Intentionally provider-agnostic
 * (no Supabase/Clerk/NextAuth-specific fields).
 */
export interface CurrentUser {
  /** Stable UUID — primary key in the `staff` table */
  id: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
  /** Fine-grained permission tags, e.g. ["content-editor", "campus-lead"] */
  roles: string[];
  /** e.g. "Nairobi", "Mombasa" — null if not yet assigned */
  campus: string | null;
  jobTitle: string | null;
}
