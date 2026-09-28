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
export * from "./roles";
export * from "./lessonPlans";
export * from "./planUsageEvents";
export * from "./planFeedback";
export * from "./teacherPoints";
export * from "./aiGenerations";
export * from "./searchMisses";
// AI Studio v2
export * from "./schemesOfWork";
export * from "./sowLessons";
export * from "./textbooks";
export * from "./textbookPages";
export * from "./promptParts";
export * from "./appSettings";
