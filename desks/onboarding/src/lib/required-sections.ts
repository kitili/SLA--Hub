/**
 * The sections a member must complete before the final sign-off unlocks.
 *
 * Gating is by stable section **id** (not display position), so reordering the
 * hub in the admin CMS never changes which sections are required. This is the
 * single source of truth shared by the dashboard (`signoffReady`) and the
 * sign-off eligibility query.
 *
 * Plain module (no `server-only`) so it can be imported from server queries,
 * server components, and unit tests alike.
 */

/** Required section ids. Checkpoints are recorded as `section-<id>`. */
export const REQUIRED_SECTION_IDS = [
  "welcome",
  "policies",
  "digital-tools",
] as const;

/**
 * True once every required section's checkpoint (`section-<id>`) is passed.
 * Accepts either a `Set` or any iterable of passed checkpoint ids.
 */
export function requiredSectionsComplete(passed: Iterable<string>): boolean {
  const set = passed instanceof Set ? passed : new Set(passed);
  return REQUIRED_SECTION_IDS.every((id) => set.has(`section-${id}`));
}
