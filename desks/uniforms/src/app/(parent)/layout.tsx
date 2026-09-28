import { Suspense } from "react";
import { ParentNav } from "@/components/nav";
import { SearchFlash } from "@/components/search-flash";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["PARENT"]);
  return (
    <div>
      <ParentNav user={user} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Suspense>
          <SearchFlash />
        </Suspense>
        {children}
      </main>
    </div>
  );
}
