import "server-only";

/**
 * Admin queries — NEW read aggregates and write mutations for the admin area
 * (member monitoring + content/quiz CMS + materials). Lives apart from the
 * member-facing repositories in `src/lib/db/repositories/*` (which are
 * deliberately read-only and project away admin-only fields such as
 * `quiz_options.is_correct`). All functions here are server-only.
 *
 * Mirrors the existing repo patterns: Drizzle query builder against `db` +
 * `schema`, `.returning()` on writes, idempotent upserts where relevant.
 */
import { asc, count, countDistinct, desc, eq, inArray, isNull, max } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  campuses,
  checkpointCompletions,
  documentReads,
  materials,
  memberProfiles,
  quizAttempts,
  quizOptions,
  quizQuestions,
  quizzes,
  sectionItems,
  sections,
  staff,
  type Campus,
  type Material,
  type Quiz,
  type QuizOption,
  type QuizQuestion,
  type Section,
  type SectionItem,
} from "@/lib/db/schema";

// ===========================================================================
// MEMBER MONITORING
// ===========================================================================

/** One row in the admin member-monitoring table. */
export interface MemberMonitorRow {
  id: string;
  email: string;
  fullName: string;
  campus: string | null;
  jobTitle: string | null;
  isAdmin: boolean;
  /** Onboarding clock start; null until the member's first activity. */
  startedAt: Date | null;
  /** Last login / activity. */
  lastActiveAt: Date;
  createdAt: Date;
  /** Distinct checkpoints passed. */
  checkpointsPassed: number;
  /** Distinct documents read. */
  documentsRead: number;
  /** Completion 0–100, rounded. Denominator = active section count. */
  completionPct: number;
  /** True once all checkpoints are passed. */
  complete: boolean;
  /** True when the member has a saved bio profile (enables the PDF export). */
  hasBio: boolean;
}

export interface MemberMonitorOverview {
  /** Completion denominator: number of published sections (one quiz each). */
  totalCheckpoints: number;
  staffCount: number;
  completedCount: number;
  members: MemberMonitorRow[];
}

/**
 * The completion denominator for member monitoring: the count of published
 * sections (each section has exactly one checkpoint quiz). Computed here so
 * callers do not need to derive it.
 */
export async function countPublishedSections(): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(sections)
    .where(eq(sections.isPublished, true));
  return Number(rows[0]?.n ?? 0);
}

/** Total published learning items (denominator for item-level progress). */
export async function countPublishedItems(): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(sectionItems)
    .innerJoin(sections, eq(sectionItems.sectionId, sections.id))
    .where(eq(sections.isPublished, true));
  return Number(rows[0]?.n ?? 0);
}

/**
 * Build the member-monitoring overview: one row per staff member with distinct
 * checkpoint / document counts (LEFT JOINed so members with zero progress still
 * appear), ordered most-recently-active first. Unlike `adminRepo.getAdminOverview`
 * this also returns `startedAt` (needed for at-risk scoring).
 */
export async function getMemberMonitorOverview(): Promise<MemberMonitorOverview> {
  const [totalCheckpoints, totalItems] = await Promise.all([
    countPublishedSections(),
    countPublishedItems(),
  ]);
  const totalSteps = totalItems + totalCheckpoints;

  const [rows, bioRows] = await Promise.all([
    db
      .select({
        id: staff.id,
        email: staff.email,
        fullName: staff.fullName,
        campus: staff.campus,
        jobTitle: staff.jobTitle,
        isAdmin: staff.isAdmin,
        startedAt: staff.startedAt,
        lastActiveAt: staff.lastActiveAt,
        createdAt: staff.createdAt,
        checkpointsPassed: countDistinct(checkpointCompletions.checkpointId),
        documentsRead: countDistinct(documentReads.itemId),
      })
      .from(staff)
      .leftJoin(
        checkpointCompletions,
        eq(checkpointCompletions.staffId, staff.id),
      )
      .leftJoin(documentReads, eq(documentReads.staffId, staff.id))
      .groupBy(staff.id)
      .orderBy(desc(staff.lastActiveAt)),
    // Which members have a saved bio profile (drives the PDF-export action).
    db.select({ memberId: memberProfiles.memberId }).from(memberProfiles),
  ]);

  const bioMemberIds = new Set(bioRows.map((r) => r.memberId));

  const members: MemberMonitorRow[] = rows.map((row) => {
    const checkpointsPassed = Number(row.checkpointsPassed);
    const documentsRead = Number(row.documentsRead);
    const stepsDone = documentsRead + checkpointsPassed;
    return {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      campus: row.campus,
      jobTitle: row.jobTitle,
      isAdmin: row.isAdmin,
      startedAt: row.startedAt,
      lastActiveAt: row.lastActiveAt,
      createdAt: row.createdAt,
      checkpointsPassed,
      documentsRead,
      completionPct: totalSteps
        ? Math.round((stepsDone / totalSteps) * 100)
        : 0,
      complete: totalCheckpoints > 0 && checkpointsPassed >= totalCheckpoints,
      hasBio: bioMemberIds.has(row.id),
    };
  });

  return {
    totalCheckpoints,
    staffCount: members.length,
    completedCount: members.filter((m) => m.complete).length,
    members,
  };
}

// ===========================================================================
// SECTIONS (CMS) — includes UNPUBLISHED (admin sees everything)
// ===========================================================================

/** A section row plus a few authoring aggregates for the list view. */
export interface AdminSectionRow extends Section {
  itemCount: number;
  /** Whether a checkpoint quiz exists for this section. */
  hasQuiz: boolean;
}

/** List every section (published or not), ordered, with item/quiz counts. */
export async function listAllSections(): Promise<AdminSectionRow[]> {
  const [sectionRows, itemCounts, quizRows] = await Promise.all([
    db.select().from(sections).orderBy(asc(sections.order)),
    db
      .select({
        sectionId: sectionItems.sectionId,
        n: count(),
      })
      .from(sectionItems)
      .groupBy(sectionItems.sectionId),
    db.select({ sectionId: quizzes.sectionId }).from(quizzes),
  ]);

  const countBySection = new Map<string, number>();
  for (const r of itemCounts) countBySection.set(r.sectionId, Number(r.n));
  const quizSections = new Set(quizRows.map((q) => q.sectionId));

  return sectionRows.map((s) => ({
    ...s,
    itemCount: countBySection.get(s.id) ?? 0,
    hasQuiz: quizSections.has(s.id),
  }));
}

/** Fetch a single section by id (any publish state). */
export async function findSection(id: string): Promise<Section | undefined> {
  const rows = await db
    .select()
    .from(sections)
    .where(eq(sections.id, id))
    .limit(1);
  return rows[0];
}

/** The next free `order` value (max + 1), for appending a new section. */
async function nextSectionOrder(): Promise<number> {
  const rows = await db
    .select({ maxOrder: max(sections.order) })
    .from(sections);
  const maxOrder = rows[0]?.maxOrder ?? 0;
  return Number(maxOrder) + 1;
}

export interface CreateSectionInput {
  id: string;
  title_en: string;
  title_sw?: string | null;
  description_en?: string | null;
  description_sw?: string | null;
  icon?: string | null;
  isPublished?: boolean;
}

/** Create a section, auto-assigning `number`/`order` to the end. */
export async function createSection(input: CreateSectionInput): Promise<Section> {
  const order = await nextSectionOrder();
  const rows = await db
    .insert(sections)
    .values({
      id: input.id,
      number: order,
      order,
      icon: input.icon ?? null,
      title_en: input.title_en,
      title_sw: input.title_sw ?? null,
      description_en: input.description_en ?? null,
      description_sw: input.description_sw ?? null,
      isPublished: input.isPublished ?? true,
    })
    .returning();
  return rows[0]!;
}

export interface UpdateSectionInput {
  title_en: string;
  title_sw?: string | null;
  description_en?: string | null;
  description_sw?: string | null;
  icon?: string | null;
}

/** Update a section's bilingual copy / icon (not order or publish state). */
export async function updateSection(
  id: string,
  input: UpdateSectionInput,
): Promise<Section | undefined> {
  const rows = await db
    .update(sections)
    .set({
      title_en: input.title_en,
      title_sw: input.title_sw ?? null,
      description_en: input.description_en ?? null,
      description_sw: input.description_sw ?? null,
      icon: input.icon ?? null,
    })
    .where(eq(sections.id, id))
    .returning();
  return rows[0];
}

/** Toggle (or set) a section's published flag (soft-hide). */
export async function setSectionPublished(
  id: string,
  isPublished: boolean,
): Promise<Section | undefined> {
  const rows = await db
    .update(sections)
    .set({ isPublished })
    .where(eq(sections.id, id))
    .returning();
  return rows[0];
}

/**
 * Move a section one slot up or down by swapping its `order` with the adjacent
 * section. Runs in a transaction so the two rows never collide. No-op at the
 * ends. Returns the full re-ordered list.
 */
export async function moveSection(
  id: string,
  direction: "up" | "down",
): Promise<void> {
  await db.transaction(async (tx) => {
    const ordered = await tx
      .select({ id: sections.id, order: sections.order })
      .from(sections)
      .orderBy(asc(sections.order));

    const idx = ordered.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;

    const a = ordered[idx]!;
    const b = ordered[swapIdx]!;

    // Two-phase swap via a temporary sentinel to avoid a unique/order clash.
    await tx
      .update(sections)
      .set({ order: -1 })
      .where(eq(sections.id, a.id));
    await tx
      .update(sections)
      .set({ order: a.order })
      .where(eq(sections.id, b.id));
    await tx
      .update(sections)
      .set({ order: b.order })
      .where(eq(sections.id, a.id));
  });
}

// ===========================================================================
// QUIZZES (CMS) — admin view INCLUDES is_correct (server-side authoring)
// ===========================================================================

/** An option in the authoring view — DOES include `isCorrect`. */
export type AdminQuizOption = QuizOption;

/** A question in the authoring view, with its options (correctness visible). */
export interface AdminQuizQuestion extends QuizQuestion {
  options: AdminQuizOption[];
}

/** A full quiz in the authoring view. */
export interface AdminQuiz extends Quiz {
  questions: AdminQuizQuestion[];
}

/**
 * Fetch the checkpoint quiz for a section in the AUTHORING view (with the
 * `is_correct` flags). Returns `undefined` when the section has no quiz yet.
 * Safe ONLY behind the admin gate — never serialize this to non-admins.
 */
export async function getQuizForSectionAdmin(
  sectionId: string,
): Promise<AdminQuiz | undefined> {
  const quizRows = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.sectionId, sectionId))
    .limit(1);
  const quiz = quizRows[0];
  if (!quiz) return undefined;

  const questionRows = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quiz.id))
    .orderBy(asc(quizQuestions.order));

  const questionIds = questionRows.map((q) => q.id);
  const optionRows = questionIds.length
    ? await db
        .select()
        .from(quizOptions)
        .where(inArray(quizOptions.questionId, questionIds))
        .orderBy(asc(quizOptions.order))
    : [];

  const optionsByQuestion = new Map<string, AdminQuizOption[]>();
  for (const opt of optionRows) {
    const bucket = optionsByQuestion.get(opt.questionId);
    if (bucket) bucket.push(opt);
    else optionsByQuestion.set(opt.questionId, [opt]);
  }

  return {
    ...quiz,
    questions: questionRows.map((q) => ({
      ...q,
      options: optionsByQuestion.get(q.id) ?? [],
    })),
  };
}

/** Ensure a `section-<slug>` quiz row exists for a section; returns its id. */
export async function ensureQuizForSection(
  sectionId: string,
  passThreshold = 1,
): Promise<string> {
  const existing = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(eq(quizzes.sectionId, sectionId))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const quizId = `section-${sectionId}`;
  await db
    .insert(quizzes)
    .values({ id: quizId, sectionId, passThreshold })
    .onConflictDoNothing();
  return quizId;
}

/** Set a quiz's pass threshold (number of correct answers required). */
export async function setQuizPassThreshold(
  quizId: string,
  passThreshold: number,
): Promise<void> {
  await db
    .update(quizzes)
    .set({ passThreshold })
    .where(eq(quizzes.id, quizId));
}

export interface QuizOptionInput {
  text_en: string;
  text_sw?: string | null;
  isCorrect: boolean;
}

export interface QuizQuestionInput {
  text_en: string;
  text_sw?: string | null;
  options: QuizOptionInput[];
}

/**
 * Add a question (with options) to a quiz, appended after existing questions.
 * Runs in a transaction. Returns the new question id.
 */
export async function addQuizQuestion(
  quizId: string,
  input: QuizQuestionInput,
): Promise<string> {
  return db.transaction(async (tx) => {
    const orderRows = await tx
      .select({ maxOrder: max(quizQuestions.order) })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId));
    const nextOrder = Number(orderRows[0]?.maxOrder ?? 0) + 1;

    const inserted = await tx
      .insert(quizQuestions)
      .values({
        quizId,
        order: nextOrder,
        text_en: input.text_en,
        text_sw: input.text_sw ?? null,
      })
      .returning();
    const questionId = inserted[0]!.id;

    if (input.options.length) {
      await tx.insert(quizOptions).values(
        input.options.map((opt, i) => ({
          questionId,
          order: i + 1,
          text_en: opt.text_en,
          text_sw: opt.text_sw ?? null,
          isCorrect: opt.isCorrect,
        })),
      );
    }

    return questionId;
  });
}

/**
 * Replace a question's text and its full option set (delete-and-rebuild, the
 * same strategy the seed uses). Runs in a transaction.
 */
export async function updateQuizQuestion(
  questionId: string,
  input: QuizQuestionInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(quizQuestions)
      .set({ text_en: input.text_en, text_sw: input.text_sw ?? null })
      .where(eq(quizQuestions.id, questionId));

    await tx.delete(quizOptions).where(eq(quizOptions.questionId, questionId));

    if (input.options.length) {
      await tx.insert(quizOptions).values(
        input.options.map((opt, i) => ({
          questionId,
          order: i + 1,
          text_en: opt.text_en,
          text_sw: opt.text_sw ?? null,
          isCorrect: opt.isCorrect,
        })),
      );
    }
  });
}

/** Delete a question (its options cascade). */
export async function deleteQuizQuestion(questionId: string): Promise<void> {
  await db.delete(quizQuestions).where(eq(quizQuestions.id, questionId));
}

// ===========================================================================
// SECTION ITEMS + MATERIALS (CMS)
// ===========================================================================

/** A section item with its attached materials (admin view). */
export interface AdminSectionItem extends SectionItem {
  materials: Material[];
}

/** List a section's items with their materials attached, ordered. */
export async function listSectionItemsWithMaterials(
  sectionId: string,
): Promise<AdminSectionItem[]> {
  const itemRows = await db
    .select()
    .from(sectionItems)
    .where(eq(sectionItems.sectionId, sectionId))
    .orderBy(asc(sectionItems.order));

  if (itemRows.length === 0) return [];

  const materialRows = await db
    .select()
    .from(materials)
    .where(
      inArray(
        materials.sectionItemId,
        itemRows.map((i) => i.id),
      ),
    )
    .orderBy(desc(materials.createdAt));

  const byItem = new Map<string, Material[]>();
  for (const m of materialRows) {
    if (!m.sectionItemId) continue;
    const bucket = byItem.get(m.sectionItemId);
    if (bucket) bucket.push(m);
    else byItem.set(m.sectionItemId, [m]);
  }

  return itemRows.map((item) => ({
    ...item,
    materials: byItem.get(item.id) ?? [],
  }));
}

export interface CreateSectionItemInput {
  sectionId: string;
  /** Optional custom id; auto-generated when omitted. */
  id?: string;
  title_en: string;
  title_sw?: string | null;
  note_en?: string | null;
  note_sw?: string | null;
  type?: SectionItem["type"];
}

/**
 * Create a learning item in a section. Auto-assigns `order` to the end and
 * generates an id like `{sectionNumber}-{n}` when none is provided.
 */
export async function createSectionItem(
  input: CreateSectionItemInput,
): Promise<SectionItem> {
  const section = await findSection(input.sectionId);
  if (!section) {
    throw new Error(`Section not found: ${input.sectionId}`);
  }

  const existing = await db
    .select({
      id: sectionItems.id,
      order: sectionItems.order,
    })
    .from(sectionItems)
    .where(eq(sectionItems.sectionId, input.sectionId));

  const nextOrder =
    existing.reduce((maxOrder, row) => Math.max(maxOrder, row.order), 0) + 1;

  let itemId = input.id?.trim();
  if (!itemId) {
    const prefix = `${section.number}-`;
    let maxSuffix = 0;
    for (const row of existing) {
      if (!row.id.startsWith(prefix)) continue;
      const suffix = Number.parseInt(row.id.slice(prefix.length), 10);
      if (!Number.isNaN(suffix)) maxSuffix = Math.max(maxSuffix, suffix);
    }
    // Also avoid colliding with items in other sections that might share ids.
    let candidate = `${section.number}-${maxSuffix + 1 || nextOrder}`;
    let guard = 0;
    while (await findSectionItem(candidate)) {
      maxSuffix += 1;
      candidate = `${section.number}-${maxSuffix}`;
      guard += 1;
      if (guard > 1000) throw new Error("Could not allocate a unique item id.");
    }
    itemId = candidate;
  } else {
    const collision = await findSectionItem(itemId);
    if (collision) {
      throw new Error(`ITEM_ID_TAKEN:${itemId}`);
    }
  }

  const rows = await db
    .insert(sectionItems)
    .values({
      id: itemId,
      sectionId: input.sectionId,
      order: nextOrder,
      type: input.type ?? "pdf",
      title_en: input.title_en,
      title_sw: input.title_sw ?? null,
      note_en: input.note_en ?? null,
      note_sw: input.note_sw ?? null,
    })
    .returning();
  return rows[0]!;
}

/** Fetch a single section item by id. */
export async function findSectionItem(
  id: string,
): Promise<SectionItem | undefined> {
  const rows = await db
    .select()
    .from(sectionItems)
    .where(eq(sectionItems.id, id))
    .limit(1);
  return rows[0];
}

/** List all materials, newest first (for the materials landing view). */
export async function listAllMaterials(): Promise<Material[]> {
  return db.select().from(materials).orderBy(desc(materials.createdAt));
}

/** A material plus the item / section it is attached to (for the list view). */
export interface MaterialWithContext {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  language: string | null;
  url: string;
  createdAt: Date;
  sectionItemId: string | null;
  itemTitleEn: string | null;
  sectionId: string | null;
  sectionTitleEn: string | null;
}

/**
 * All materials with their attached item + section titles (LEFT JOIN so an
 * unattached material still lists). Newest first.
 */
export async function listMaterialsWithContext(): Promise<MaterialWithContext[]> {
  const rows = await db
    .select({
      id: materials.id,
      filename: materials.filename,
      contentType: materials.contentType,
      size: materials.size,
      language: materials.language,
      url: materials.url,
      createdAt: materials.createdAt,
      sectionItemId: materials.sectionItemId,
      itemTitleEn: sectionItems.title_en,
      sectionId: sectionItems.sectionId,
      sectionTitleEn: sections.title_en,
    })
    .from(materials)
    .leftJoin(sectionItems, eq(materials.sectionItemId, sectionItems.id))
    .leftJoin(sections, eq(sectionItems.sectionId, sections.id))
    .orderBy(desc(materials.createdAt));
  return rows;
}

/** Fetch a material by id. */
export async function findMaterial(id: string): Promise<Material | undefined> {
  const rows = await db
    .select()
    .from(materials)
    .where(eq(materials.id, id))
    .limit(1);
  return rows[0];
}

/** Delete a material metadata row by id; returns the deleted row (for cleanup). */
export async function deleteMaterialRow(id: string): Promise<Material | undefined> {
  const rows = await db
    .delete(materials)
    .where(eq(materials.id, id))
    .returning();
  return rows[0];
}

/**
 * Lightweight option list of section items for the materials upload form
 * (id, section, title). Ordered by section order then item order.
 */
export interface SectionItemOption {
  id: string;
  sectionId: string;
  sectionTitleEn: string;
  titleEn: string;
}

export async function listSectionItemOptions(): Promise<SectionItemOption[]> {
  const rows = await db
    .select({
      id: sectionItems.id,
      sectionId: sectionItems.sectionId,
      sectionTitleEn: sections.title_en,
      titleEn: sectionItems.title_en,
      sectionOrder: sections.order,
      itemOrder: sectionItems.order,
    })
    .from(sectionItems)
    .innerJoin(sections, eq(sectionItems.sectionId, sections.id))
    .orderBy(asc(sections.order), asc(sectionItems.order));

  return rows.map((r) => ({
    id: r.id,
    sectionId: r.sectionId,
    sectionTitleEn: r.sectionTitleEn,
    titleEn: r.titleEn,
  }));
}

export interface CreateMaterialRowInput {
  sectionItemId: string;
  language: string | null;
  filename: string;
  contentType: string;
  size: number;
  storageKey: string;
  url: string;
  uploadedBy: string | null;
}

export interface ReplaceMaterialBytesInput {
  filename: string;
  contentType: string;
  size: number;
  storageKey: string;
  url: string;
}

/**
 * Repoint an existing material row at newly-stored bytes, in place. Preserves
 * the row id, its `section_item_id` attachment, and language tag — so links
 * survive a file replacement.
 */
export async function updateMaterialBytes(
  id: string,
  input: ReplaceMaterialBytesInput,
): Promise<Material | undefined> {
  const rows = await db
    .update(materials)
    .set({
      filename: input.filename,
      contentType: input.contentType,
      size: input.size,
      storageKey: input.storageKey,
      url: input.url,
    })
    .where(eq(materials.id, id))
    .returning();
  return rows[0];
}

/** Insert a material metadata row (after the bytes are stored). */
export async function createMaterialRow(
  input: CreateMaterialRowInput,
): Promise<Material> {
  const rows = await db
    .insert(materials)
    .values({
      sectionItemId: input.sectionItemId,
      ownerItemId: input.sectionItemId, // keep the soft ref in sync
      language: input.language,
      filename: input.filename,
      contentType: input.contentType,
      size: input.size,
      storageKey: input.storageKey,
      url: input.url,
      uploadedBy: input.uploadedBy,
    })
    .returning();
  return rows[0]!;
}

// ===========================================================================
// ===========================================================================
// MEMBER ADMIN MANAGEMENT
// ===========================================================================

/** Fetch a single staff member's basic info including admin status and campus. */
export async function getMemberById(
  memberId: string,
): Promise<{ id: string; email: string; fullName: string; isAdmin: boolean; campus: string | null } | null> {
  const rows = await db
    .select({
      id: staff.id,
      email: staff.email,
      fullName: staff.fullName,
      isAdmin: staff.isAdmin,
      campus: staff.campus,
    })
    .from(staff)
    .where(eq(staff.id, memberId))
    .limit(1);
  return rows[0] ?? null;
}

/** Set (or clear) the admin flag for a staff member. Returns true if found. */
export async function setMemberAdmin(
  memberId: string,
  isAdmin: boolean,
): Promise<boolean> {
  const rows = await db
    .update(staff)
    .set({ isAdmin })
    .where(eq(staff.id, memberId))
    .returning();
  return rows.length > 0;
}

// ===========================================================================
// Light counters for the dashboard header
// ===========================================================================

export interface AdminCounts {
  sections: number;
  publishedSections: number;
  quizzes: number;
  materials: number;
  attempts: number;
}

export interface ContentQualitySnapshot {
  totalLearningItems: number;
  listedMaterials: number;
  itemsWithoutMaterials: number;
  youtubeEmbeds: number;
}

export async function getAdminCounts(): Promise<AdminCounts> {
  const [s, ps, q, m, a] = await Promise.all([
    db.select({ n: count() }).from(sections),
    db
      .select({ n: count() })
      .from(sections)
      .where(eq(sections.isPublished, true)),
    db.select({ n: count() }).from(quizzes),
    db.select({ n: count() }).from(materials),
    db.select({ n: count() }).from(quizAttempts),
  ]);
  return {
    sections: Number(s[0]?.n ?? 0),
    publishedSections: Number(ps[0]?.n ?? 0),
    quizzes: Number(q[0]?.n ?? 0),
    materials: Number(m[0]?.n ?? 0),
    attempts: Number(a[0]?.n ?? 0),
  };
}

export async function getContentQualitySnapshot(): Promise<ContentQualitySnapshot> {
  const [items, listed, missing, youtube] = await Promise.all([
    db.select({ n: count() }).from(sectionItems),
    db.select({ n: count() }).from(materials),
    db
      .select({ n: count() })
      .from(sectionItems)
      .leftJoin(materials, eq(materials.sectionItemId, sectionItems.id))
      .where(isNull(materials.id)),
    db
      .select({ n: count() })
      .from(materials)
      .where(eq(materials.contentType, "video/youtube")),
  ]);

  return {
    totalLearningItems: Number(items[0]?.n ?? 0),
    listedMaterials: Number(listed[0]?.n ?? 0),
    itemsWithoutMaterials: Number(missing[0]?.n ?? 0),
    youtubeEmbeds: Number(youtube[0]?.n ?? 0),
  };
}

// ===========================================================================
// CAMPUSES
// ===========================================================================

/** List all campuses ordered by name. */
export async function listCampuses(): Promise<Campus[]> {
  return db.select().from(campuses).orderBy(asc(campuses.name));
}

/** Create a campus; returns the inserted row. */
export async function createCampus(name: string): Promise<Campus> {
  const rows = await db.insert(campuses).values({ name }).returning();
  return rows[0]!;
}

/** Delete a campus by id; returns true if a row was deleted. */
export async function deleteCampus(id: string): Promise<boolean> {
  const rows = await db.delete(campuses).where(eq(campuses.id, id)).returning();
  return rows.length > 0;
}

/** Set (or clear) the campus field on a staff member. */
export async function setMemberCampus(
  memberId: string,
  campus: string | null,
): Promise<boolean> {
  const rows = await db
    .update(staff)
    .set({ campus })
    .where(eq(staff.id, memberId))
    .returning();
  return rows.length > 0;
}
