import { Suspense } from "react";
import { StaffNav } from "@/components/nav";
import { SearchFlash } from "@/components/search-flash";
import { requireUser } from "@/lib/auth";
import { readHubHandoffs } from "@/lib/hub-bridge";
import { STAFF_ROLES } from "@/lib/constants";

export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(STAFF_ROLES);
  const fromOtherDesks = await readHubHandoffs("uniforms");
  return (
    <div>
      <StaffNav user={user} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Suspense>
          <SearchFlash />
        </Suspense>
        {fromOtherDesks.length > 0 ? (
          <section className="mb-6 rounded-xl border border-black/10 bg-white p-4 text-sm">
            <h2 className="font-semibold">From other desks</h2>
            {fromOtherDesks.map((row) => (
              <p key={row.id} className="mt-2">
                {row.from}: {row.title}. {row.facts.map((fact) => `${fact.label} ${fact.value}`).join(" · ")}
              </p>
            ))}
          </section>
        ) : null}
        {children}
      </main>
    </div>
  );
}
