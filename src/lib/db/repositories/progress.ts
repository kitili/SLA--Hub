import "server-only";

/**
 * Progress repository — document reads and checkpoint completions.
 *
 * Mirrors legacy `legacy/server/routes/progress.js`:
 *   - marking a read/checkpoint upserts (re-marking refreshes the timestamp)
 *     and touches the owner's `last_active_at`
 *   - resetting a checkpoint deletes it and (optionally) an associated read
 *   - progress is read back as two string arrays (item ids / checkpoint ids)
 */
import { and, eq } from "drizzle-orm";

import { db } from "../client";
import {
  checkpointCompletions,
  documentReads,
  staff,
  type CheckpointCompletion,
  type DocumentRead,
} from "../schema";

/** The shape the legacy API returned under `progress`. */
export interface StaffProgress {
  readItems: string[];
  passedCheckpoints: string[];
}

/** Touch `last_active_at` for a staff id (private helper, mirrors legacy). */
async function touch(staffId: string): Promise<void> {
  await db
    .update(staff)
    .set({ lastActiveAt: new Date() })
    .where(eq(staff.id, staffId));
}

/** List raw document-read rows for a staff member. */
export async function listReads(staffId: string): Promise<DocumentRead[]> {
  return db
    .select()
    .from(documentReads)
    .where(eq(documentReads.staffId, staffId));
}

/** List raw checkpoint-completion rows for a staff member. */
export async function listCheckpoints(
  staffId: string,
): Promise<CheckpointCompletion[]> {
  return db
    .select()
    .from(checkpointCompletions)
    .where(eq(checkpointCompletions.staffId, staffId));
}

/** Aggregate progress (read item ids + passed checkpoint ids) for a staff id. */
export async function getProgressForStaff(
  staffId: string,
): Promise<StaffProgress> {
  const [reads, checkpoints] = await Promise.all([
    db
      .select({ itemId: documentReads.itemId })
      .from(documentReads)
      .where(eq(documentReads.staffId, staffId)),
    db
      .select({ checkpointId: checkpointCompletions.checkpointId })
      .from(checkpointCompletions)
      .where(eq(checkpointCompletions.staffId, staffId)),
  ]);

  return {
    readItems: reads.map((r) => r.itemId),
    passedCheckpoints: checkpoints.map((c) => c.checkpointId),
  };
}

/**
 * Mark a content item as read (upsert; refreshes `read_at` on conflict) and
 * touch the staff member's activity. Returns the updated progress.
 */
export async function markDocumentRead(
  staffId: string,
  itemId: string,
): Promise<StaffProgress> {
  await db
    .insert(documentReads)
    .values({ staffId, itemId })
    .onConflictDoUpdate({
      target: [documentReads.staffId, documentReads.itemId],
      set: { readAt: new Date() },
    });
  await touch(staffId);
  return getProgressForStaff(staffId);
}

/**
 * Mark a checkpoint as passed (upsert; refreshes `passed_at` on conflict) and
 * touch the staff member's activity. Returns the updated progress.
 */
export async function markCheckpointPassed(
  staffId: string,
  checkpointId: string,
): Promise<StaffProgress> {
  await db
    .insert(checkpointCompletions)
    .values({ staffId, checkpointId })
    .onConflictDoUpdate({
      target: [
        checkpointCompletions.staffId,
        checkpointCompletions.checkpointId,
      ],
      set: { passedAt: new Date() },
    });
  await touch(staffId);
  return getProgressForStaff(staffId);
}

/**
 * Reset a checkpoint: delete the completion and, if `itemId` is given, the
 * associated document read too (so the section can be retaken). Returns the
 * updated progress. Mirrors legacy `/reset-checkpoint`.
 */
export async function resetCheckpoint(
  staffId: string,
  checkpointId: string,
  itemId?: string,
): Promise<StaffProgress> {
  await db
    .delete(checkpointCompletions)
    .where(
      and(
        eq(checkpointCompletions.staffId, staffId),
        eq(checkpointCompletions.checkpointId, checkpointId),
      ),
    );

  if (itemId) {
    await db
      .delete(documentReads)
      .where(
        and(
          eq(documentReads.staffId, staffId),
          eq(documentReads.itemId, itemId),
        ),
      );
  }

  return getProgressForStaff(staffId);
}
