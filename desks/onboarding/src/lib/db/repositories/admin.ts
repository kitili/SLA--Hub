import "server-only";

/**
 * Admin repository — the HR overview aggregate.
 *
 * Mirrors legacy `legacy/server/routes/admin.js` `/overview`: one row per staff
 * member with their distinct checkpoint/document counts, joined left so staff
 * with zero progress still appear, ordered by most-recently-active.
 *
 * `totalCheckpoints` (the denominator for completion %) comes from the content
 * tree — number of active sections — which is owned outside the data layer. The
 * caller passes it in; we reproduce the legacy math exactly:
 *   completionPct = round(checkpointsPassed / total * 100)   (0 when total = 0)
 *   complete      = checkpointsPassed >= total
 */
import { countDistinct, desc, eq } from "drizzle-orm";

import { db } from "../client";
import { checkpointCompletions, documentReads, staff } from "../schema";

export interface AdminOverviewStaffRow {
  id: string;
  email: string;
  fullName: string;
  campus: string | null;
  jobTitle: string | null;
  isAdmin: boolean;
  createdAt: Date;
  lastActiveAt: Date;
  checkpointsPassed: number;
  documentsRead: number;
  completionPct: number;
  complete: boolean;
}

export interface AdminOverview {
  totalCheckpoints: number;
  staffCount: number;
  completedCount: number;
  staff: AdminOverviewStaffRow[];
}

/**
 * Build the admin overview.
 *
 * @param totalCheckpoints number of active sections (completion denominator).
 */
export async function getAdminOverview(
  totalCheckpoints: number,
): Promise<AdminOverview> {
  const rows = await db
    .select({
      id: staff.id,
      email: staff.email,
      fullName: staff.fullName,
      campus: staff.campus,
      jobTitle: staff.jobTitle,
      isAdmin: staff.isAdmin,
      createdAt: staff.createdAt,
      lastActiveAt: staff.lastActiveAt,
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
    .orderBy(desc(staff.lastActiveAt));

  const staffRows: AdminOverviewStaffRow[] = rows.map((row) => {
    const checkpointsPassed = Number(row.checkpointsPassed);
    const documentsRead = Number(row.documentsRead);
    return {
      ...row,
      checkpointsPassed,
      documentsRead,
      completionPct: totalCheckpoints
        ? Math.round((checkpointsPassed / totalCheckpoints) * 100)
        : 0,
      complete: checkpointsPassed >= totalCheckpoints,
    };
  });

  return {
    totalCheckpoints,
    staffCount: staffRows.length,
    completedCount: staffRows.filter((s) => s.complete).length,
    staff: staffRows,
  };
}
