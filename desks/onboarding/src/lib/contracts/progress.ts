/**
 * Progress DTOs — shapes used by the progress-tracking layer.
 *
 * Mirrors the `document_reads` and `checkpoint_completions` tables from
 * legacy/server/db/schema.sql.
 */

/** A single content-item read event */
export interface ItemRead {
  /** Matches `document_reads.item_id` */
  itemId: string;
  /** ISO-8601 timestamp */
  readAt: string;
}

/** A single checkpoint completion event */
export interface CheckpointCompletion {
  /** Matches `checkpoint_completions.checkpoint_id` */
  checkpointId: string;
  /** ISO-8601 timestamp */
  passedAt: string;
}

/** Aggregated progress for a single staff member */
export interface StaffProgress {
  staffId: string;
  readItems: ItemRead[];
  passedCheckpoints: CheckpointCompletion[];
  /** 0–100, calculated server-side */
  completionPercent: number;
}

/** Admin overview entry — one row per staff member in the dashboard */
export interface AdminOverview {
  staff: {
    id: string;
    email: string;
    full_name: string;
    campus: string | null;
    job_title: string | null;
  };
  progress: StaffProgress;
}
