/**
 * Repository barrel — typed data-access modules.
 *
 * The prevailing convention in this app is that server actions/queries import
 * `db` and the Drizzle builders directly; a repository is only extracted when
 * the same data operations are shared across several call sites (staff is the
 * one such area today). See docs/data-layer.md for the "add a repository"
 * recipe.
 */
export * as staffRepo from "./staff";
