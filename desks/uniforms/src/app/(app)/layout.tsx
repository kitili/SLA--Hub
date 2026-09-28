import { Suspense } from "react";
import { StaffNav } from "@/components/nav";
import { SearchFlash } from "@/components/search-flash";
import { requireUser } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/constants";

export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(STAFF_ROLES);
  return (
    <div>
      <StaffNav user={user} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Suspense>
          <SearchFlash />
        </Suspense>
        {children}
      </main>
    </div>
  );
}
