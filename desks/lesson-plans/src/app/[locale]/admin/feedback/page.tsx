import { requireAdmin } from "@/lib/auth";
import {
  getLowestRatedPlans,
  getOverviewStats,
  getRecentComments,
} from "@/lib/admin/insights";
import FeedbackTable from "@/components/admin/FeedbackTable";

/** Live, authenticated data — render on demand (never prerender/cache). */
export const dynamic = "force-dynamic";

/**
 * Admin feedback review.
 *
 * Re-asserts admin, then fetches the overall average rating (from the overview
 * stats), the lowest-rated plans, and the most recent comments — concurrently —
 * and hands them to the presentational {@link FeedbackTable}.
 */
export default async function AdminFeedbackPage() {
  await requireAdmin();

  const [stats, lowestRated, recentComments] = await Promise.all([
    getOverviewStats(),
    getLowestRatedPlans(8),
    getRecentComments(15),
  ]);

  return (
    <div>
      <h1 style={{ marginBottom: "1.25rem" }}>Feedback</h1>
      <FeedbackTable
        overallAvg={stats.avgRating}
        lowestRated={lowestRated}
        recentComments={recentComments}
      />
    </div>
  );
}
