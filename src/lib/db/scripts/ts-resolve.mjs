/**
 * Registers the extensionless-TypeScript resolver hook (./ts-resolve-hooks.mjs)
 * for the db CLI scripts. Used via `node --import` in the db:migrate / db:seed
 * npm scripts (run through `tsx`) so those scripts can resolve extensionless
 * imports even though the source uses Next.js bundler-style paths.
 *
 * Dependency-free: only `node:module`.
 */
import { register } from "node:module";

register("./ts-resolve-hooks.mjs", import.meta.url);
