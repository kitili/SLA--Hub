import type { Metadata } from "next";
import { getWorkplaceKpis } from "@/lib/workplace-kpis";
import { requireSuperAdmin } from "@/lib/auth";
import ProgressDashboard from "@/components/ProgressDashboard";

export const metadata: Metadata = {
  title: "Progress",
};

export const dynamic = "force-dynamic";

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const dept = typeof params.dept === "string" ? params.dept : null;
  const kpis = await getWorkplaceKpis();

  return <ProgressDashboard kpis={kpis} dept={dept} />;
}
