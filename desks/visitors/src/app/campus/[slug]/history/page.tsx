import { notFound } from "next/navigation";
import { DashboardView } from "@/components/DashboardView";
import { SiteHeader } from "@/components/SiteHeader";
import { campusFromSlug } from "@/lib/campus-routes";

export default async function CampusHistoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const campus = campusFromSlug(slug);
  if (!campus) notFound();

  return (
    <div className="wrap campus-themed" data-campus={campus.name}>
      <SiteHeader
        campus={campus.name}
        title="Visit history"
        subtitle={`Full visitor history for ${campus.name}. Filter by date and check-in type.`}
        active="history"
      />
      <DashboardView campus={campus.name} />
    </div>
  );
}
