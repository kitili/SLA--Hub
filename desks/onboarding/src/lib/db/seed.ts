import "server-only";

/**
 * Wave 3 content seed — load the 12 onboarding sections + their items (from
 * legacy `hub-content.json`) and the 12 section quizzes (from legacy
 * `checkpoints.js`) into the new content/quiz tables, and ensure one initial
 * `content_versions` row.
 *
 * IDEMPOTENT: re-running upserts sections/items/quizzes by their stable text
 * PKs and rebuilds each quiz's question/option subtree from scratch, so it is
 * safe to run repeatedly (e.g. after every migrate).
 *
 * Bilingual columns are populated `*_en` from the existing English copy;
 * `*_sw` is left null (placeholder) per the EN-source-of-truth convention.
 *
 * File material: seed records legacy `documents/` path refs as materials
 * metadata. Admin Blob / local uploads are PRESERVED on re-seed — see
 * `planMaterialSeedSync` in `src/lib/storage/material-seed.ts`.
 *
 * Exposed as a function so the CLI (`db:seed`) and the throwaway smoke test can
 * both drive it against the active database.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { eq, inArray } from "drizzle-orm";

import { db } from "./client";
import {
  contentVersions,
  materials,
  quizOptions,
  quizQuestions,
  quizzes,
  sectionItems,
  sections,
  type NewMaterial,
  type NewQuizOption,
  type NewQuizQuestion,
  type NewSection,
  type NewSectionItem,
} from "./schema";
import { planMaterialSeedSync } from "@/lib/storage/material-seed";

/* ------------------------------------------------------------------ */
/* Legacy data shapes (as they appear in the source files)             */
/* ------------------------------------------------------------------ */

interface LegacyItem {
  id: string;
  title: string;
  files?: string[];
  type?: string;
  note?: string;
}

interface LegacySection {
  id: string;
  number: number;
  title: string;
  icon?: string;
  description?: string;
  items?: LegacyItem[];
}

interface LegacyHubContent {
  sections: LegacySection[];
}

interface LegacyQuestion {
  id: string;
  text: string;
  options: string[];
  correct: number;
}

interface LegacyCheckpoint {
  title: string;
  questions: LegacyQuestion[];
}

interface CheckpointsModule {
  PASS_THRESHOLD: number;
  sectionCheckpoints: Record<string, LegacyCheckpoint>;
}

/* ------------------------------------------------------------------ */
/* Paths (resolved from this file, so cwd does not matter)             */
/* ------------------------------------------------------------------ */

/** Repo root = four levels up from src/lib/db/seed.ts. */
function repoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../..");
}

const HUB_CONTENT_PATH = path.join(
  repoRoot(),
  "legacy/server/data/hub-content.json",
);
const CHECKPOINTS_PATH = path.join(
  repoRoot(),
  "legacy/client/src/data/checkpoints.js",
);

/* ------------------------------------------------------------------ */
/* Derivations                                                         */
/* ------------------------------------------------------------------ */

const ITEM_TYPES = ["pdf", "docx", "video", "image", "pptx", "link"] as const;
type ItemType = (typeof ITEM_TYPES)[number];

/** Map a file extension to a `section_item_type`. */
function extToType(ext: string): ItemType {
  switch (ext.toLowerCase()) {
    case "pdf":
      return "pdf";
    case "doc":
    case "docx":
      return "docx";
    case "ppt":
    case "pptx":
      return "pptx";
    case "mp4":
    case "mov":
    case "webm":
      return "video";
    case "svg":
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
      return "image";
    default:
      return "link";
  }
}

/** Resolve an item's type: explicit `type` wins, else derive from first file. */
function resolveItemType(item: LegacyItem): ItemType {
  if (item.type && (ITEM_TYPES as readonly string[]).includes(item.type)) {
    return item.type as ItemType;
  }
  const first = item.files?.[0];
  if (!first) return "link";
  const ext = path.extname(first).replace(/^\./, "");
  return ext ? extToType(ext) : "link";
}

/** A reasonable MIME type for a recorded file path (metadata only). */
function mimeForPath(filePath: string): string {
  const ext = path.extname(filePath).replace(/^\./, "").toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "doc":
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "ppt":
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "mp4":
    case "mov":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "html":
    case "htm":
      return "text/html; charset=utf-8";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

/** @deprecated Prefer mimeForPath — kept for item-type fallbacks. */
function mimeForType(type: ItemType): string {
  switch (type) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "video":
      return "video/mp4";
    case "image":
      return "image/*";
    default:
      return "application/octet-stream";
  }
}

/* ------------------------------------------------------------------ */
/* Loaders                                                             */
/* ------------------------------------------------------------------ */

function loadHubContent(): LegacyHubContent {
  const raw = readFileSync(HUB_CONTENT_PATH, "utf8");
  return JSON.parse(raw) as LegacyHubContent;
}

async function loadCheckpoints(): Promise<CheckpointsModule> {
  const mod = (await import(
    pathToFileURL(CHECKPOINTS_PATH).href
  )) as CheckpointsModule;
  return mod;
}

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

export interface SeedSummary {
  sections: number;
  items: number;
  quizzes: number;
  questions: number;
  options: number;
  materials: number;
  contentVersionEnsured: boolean;
}

/**
 * Seed the active database with content + quizzes. Idempotent. Does NOT run
 * migrations — callers (the CLI and smoke test) run those first.
 */
export async function seedContent(): Promise<SeedSummary> {
  const hub = loadHubContent();
  const checkpoints = await loadCheckpoints();

  const summary: SeedSummary = {
    sections: 0,
    items: 0,
    quizzes: 0,
    questions: 0,
    options: 0,
    materials: 0,
    contentVersionEnsured: false,
  };

  // --- Sections + items -------------------------------------------------
  for (const [index, section] of hub.sections.entries()) {
    const sectionRow: NewSection = {
      id: section.id,
      number: section.number,
      order: index,
      icon: section.icon ?? null,
      title_en: section.title,
      title_sw: null,
      description_en: section.description ?? null,
      description_sw: null,
      isPublished: true,
    };

    await db
      .insert(sections)
      .values(sectionRow)
      .onConflictDoUpdate({
        target: sections.id,
        set: {
          number: sectionRow.number,
          order: sectionRow.order,
          icon: sectionRow.icon,
          title_en: sectionRow.title_en,
          description_en: sectionRow.description_en,
          isPublished: sectionRow.isPublished,
        },
      });
    summary.sections += 1;

    const items = section.items ?? [];
    for (const [itemIndex, item] of items.entries()) {
      const type = resolveItemType(item);
      const itemRow: NewSectionItem = {
        id: item.id,
        sectionId: section.id,
        order: itemIndex,
        type,
        title_en: item.title,
        title_sw: null,
        note_en: item.note ?? null,
        note_sw: null,
      };

      await db
        .insert(sectionItems)
        .values(itemRow)
        .onConflictDoUpdate({
          target: sectionItems.id,
          set: {
            sectionId: itemRow.sectionId,
            order: itemRow.order,
            type: itemRow.type,
            title_en: itemRow.title_en,
            note_en: itemRow.note_en,
          },
        });
      summary.items += 1;

      // Sync seed path placeholders without wiping admin Blob/local uploads.
      const existingMats = await db
        .select()
        .from(materials)
        .where(eq(materials.sectionItemId, item.id));
      const plan = planMaterialSeedSync(
        existingMats.map((m) => ({
          id: m.id,
          storageKey: m.storageKey,
          contentType: m.contentType,
          size: m.size,
        })),
        item.files ?? [],
      );

      if (plan.deleteIds.length > 0) {
        await db
          .delete(materials)
          .where(inArray(materials.id, plan.deleteIds));
      }

      for (const filePath of plan.insertSeedKeys) {
        const filename = path.basename(filePath);
        const materialRow: NewMaterial = {
          ownerItemId: item.id,
          sectionItemId: item.id,
          language: "en",
          filename,
          contentType: mimeForPath(filePath) || mimeForType(type),
          size: 0, // bytes unknown until uploaded to Blob
          storageKey: filePath,
          url: filePath,
        };
        await db.insert(materials).values(materialRow);
        summary.materials += 1;
      }
      summary.materials += plan.keepSeedKeys.length;
    }
  }

  // --- Quizzes (questions + options) ------------------------------------
  // Checkpoint keys are "section-<slug>"; the slug is the section id.
  for (const [checkpointId, checkpoint] of Object.entries(
    checkpoints.sectionCheckpoints,
  )) {
    const sectionId = checkpointId.replace(/^section-/, "");
    const questionCount = checkpoint.questions.length;
    // pass_threshold = number of questions (100%), matching the legacy intent.
    const passThreshold = questionCount;

    await db
      .insert(quizzes)
      .values({ id: checkpointId, sectionId, passThreshold })
      .onConflictDoUpdate({
        target: quizzes.id,
        set: { sectionId, passThreshold },
      });
    summary.quizzes += 1;

    // Rebuild the question/option subtree idempotently: delete existing
    // questions for this quiz (cascades to options), then re-insert.
    await db.delete(quizQuestions).where(eq(quizQuestions.quizId, checkpointId));

    for (const [qIndex, question] of checkpoint.questions.entries()) {
      const questionRow: NewQuizQuestion = {
        quizId: checkpointId,
        order: qIndex,
        text_en: question.text,
        text_sw: null,
      };
      const insertedQuestion = await db
        .insert(quizQuestions)
        .values(questionRow)
        .returning();
      const questionId = insertedQuestion[0]!.id;
      summary.questions += 1;

      const optionRows: NewQuizOption[] = question.options.map(
        (optionText, oIndex) => ({
          questionId,
          order: oIndex,
          text_en: optionText,
          text_sw: null,
          isCorrect: oIndex === question.correct,
        }),
      );
      await db.insert(quizOptions).values(optionRows);
      summary.options += optionRows.length;
    }
  }

  // --- Initial content version ------------------------------------------
  const existingVersions = await db
    .select({ id: contentVersions.id })
    .from(contentVersions)
    .limit(1);
  if (existingVersions.length === 0) {
    await db
      .insert(contentVersions)
      .values({ label: "Initial content seed (Wave 3)" });
    summary.contentVersionEnsured = true;
  }

  return summary;
}
