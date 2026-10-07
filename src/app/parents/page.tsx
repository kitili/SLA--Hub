import type { Metadata } from "next";
import { cookies } from "next/headers";
import ParentPortal from "@/components/ParentPortal";
import { loadHousehold, testHousehold } from "@/lib/parent-portal/household";
import { decodeParentSession, parentCookieName } from "@/lib/parent-portal/session";

export const metadata: Metadata = {
  title: "Parents",
};

export const dynamic = "force-dynamic";

export default async function ParentsPage() {
  const jar = await cookies();
  const session = await decodeParentSession(jar.get(parentCookieName())?.value);
  const loaded =
    session && !session.demo ? await loadHousehold(session.parentIds).catch(() => null) : null;
  const household = session?.demo
    ? testHousehold()
    : loaded
      ? { ...loaded, preview: session?.preview === true }
      : null;
  return <ParentPortal household={session && household ? household : null} />;
}
