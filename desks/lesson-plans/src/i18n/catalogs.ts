/**
 * Message-catalog files merged into the per-request message tree.
 *
 * Each entry names a `messages/<locale>/<name>.json` file. A file's TOP-LEVEL
 * keys are the `t()` namespaces it owns, and **exactly one file owns each
 * namespace**: the merge in `request.ts` is a shallow `Object.assign`, so two
 * files sharing a top-level key would silently shadow one another.
 * `test/messages-parity.test.ts` pins this invariant (plus en/sw key parity),
 * so add new namespaces to exactly one file — in both locales.
 *
 * @see docs/i18n.md
 */
export const catalogFiles = [
  "common", // adminGate, common, nav
  "member", // member
  "admin", // admin
  "errors", // errors
  // Lesson-plan app catalogs, split per area so parallel work never collides
  // on a single file.
  "lpteacher", // lpHome, lpSearch, lpResults, lpPlan
  "lpfeedback", // lpFeedback
  "lpadmin", // lpAdmin
  "lpstudio", // lpStudio (the multi-panel studio + batch generation)
  "lpmanage", // lpManage (scheme/textbook/prompt admin pages)
] as const;
