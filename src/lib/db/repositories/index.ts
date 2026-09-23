/**
 * Repository barrel — the typed Data Access Layer.
 *
 * Server code should import data operations from `@/lib/db/repositories` rather
 * than touching `db` or writing raw SQL. See docs/data-layer.md for the
 * "add a repository" recipe.
 */
export * as staffRepo from "./staff";
export * as progressRepo from "./progress";
export * as adminRepo from "./admin";
export * as materialsRepo from "./materials";
export * as contentRepo from "./content";
export * as quizzesRepo from "./quizzes";
export * as signoffRepo from "./signoff";
export * as feedbackRepo from "./feedback";
export * as sectionDeclarationsRepo from "./section-declarations";
export * as policySignaturesRepo from "./policy-signatures";
export * as policyBriefingsRepo from "./policy-briefings";
export * as slaBotRepo from "./sla-bot";
export * as accessRepo from "./access";
