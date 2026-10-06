import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWorkplaceCharts } from "@/lib/workplace-charts";
import { getWorkplaceKpis } from "@/lib/workplace-kpis";
import { getCurrentUser } from "@/lib/auth";
import ProgressDashboard from "@/components/ProgressDashboard";

export const metadata: Metadata = {
  title: "Progress",
};

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/hub");
  const params = await searchParams;
  const dept = typeof params.dept === "string" ? params.dept : null;
  const [kpis, charts] = await Promise.all([getWorkplaceKpis(), getWorkplaceCharts(dept)]);
  const departments = kpis.departments.map((row) => ({
    ...row,
    spark: charts.sparks[row.id] ?? [],
  }));

  return (
    <ProgressDashboard
      kpis={{ ...kpis, departments }}
      pulse={charts.pulse}
      hours={charts.hours}
      dept={dept}
    />
  );
}
