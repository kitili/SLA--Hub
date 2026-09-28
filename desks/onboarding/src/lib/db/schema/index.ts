/**
 * Schema barrel — the single source of truth for the database shape.
 *
 * Import tables from here (`@/lib/db/schema`), and pass this whole module as
 * the Drizzle `schema` so the query builder and relational API see every table.
 *
 * Conventions and the reserved future-table list live in
 * docs/schema-conventions.md.
 */
export * from "./staff";
export * from "./progress";
export * from "./materials";
export * from "./content";
export * from "./quizzes";
export * from "./attempts";
export * from "./signoff";
export * from "./feedback";
export * from "./section-declarations";
export * from "./policy-signatures";
export * from "./roles";
export * from "./bio";
export * from "./campuses";
export * from "./hiring";
export * from "./otp";
export * from "./policy-briefings";
export * from "./sla-bot";
export * from "./app-settings";
