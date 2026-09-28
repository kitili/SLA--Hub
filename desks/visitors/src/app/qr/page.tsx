import { headers } from "next/headers";
import { QrPoster } from "@/components/QrPoster";
import { getCheckInUrl } from "@/lib/app-url";

export default async function PublicQrPage() {
  const host = (await headers()).get("host") ?? undefined;
  const checkInUrl = getCheckInUrl(host);

  return (
    <div className="wrap">
      <QrPoster checkInUrl={checkInUrl} />
    </div>
  );
}
