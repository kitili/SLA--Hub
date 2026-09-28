/**
 * Registers the TypeScript resolver hook (./ts-resolve-hooks.mjs) for the db
 * CLI scripts. Used via `node --import` in the `db:run` npm script (which
 * db:migrate / db:seed / db:import / db:import-textbooks delegate to) so those
 * scripts can run under plain Node + --experimental-strip-types even though
 * the source uses Next.js bundler-style imports ("@/" alias, extensionless).
 *
 * Dependency-free: only `node:module`.
 */
import { register } from "node:module";

register("./ts-resolve-hooks.mjs", import.meta.url);
