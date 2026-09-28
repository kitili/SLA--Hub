import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { QrPoster } from "@/components/QrPoster";
import { SiteHeader } from "@/components/SiteHeader";
import { getCheckInUrl } from "@/lib/app-url";
import { campusFromSlug } from "@/lib/campus-routes";

export default async function CampusQrPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const campus = campusFromSlug(slug);
  if (!campus) notFound();

  const host = (await headers()).get("host") ?? undefined;
  const checkInUrl = getCheckInUrl(host);

  return (
    <div className="wrap campus-themed" data-campus={campus.name}>
      <SiteHeader
        campus={campus.name}
        title="QR check-in poster"
        subtitle="Print this QR — it opens the visitor form for all Silverleaf campuses."
        active="qr"
      />
      <QrPoster checkInUrl={checkInUrl} />
    </div>
  );
}
