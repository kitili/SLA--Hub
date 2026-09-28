"use client";

import { usePathname } from "next/navigation";
import { OpsHeader } from "@/components/ops/OpsHeader";
import type { Role } from "@/lib/roles";

export function OpsShell({
  children,
  role = null,
}: {
  children: React.ReactNode;
  role?: Role | null;
}) {
  const pathname = usePathname();
  const dense =
    pathname.startsWith("/ops/ticketing") ||
    pathname.startsWith("/ops/transport");
  // Facilities matrices/tables (Issues, Generator, Checklist) run wide —
  // give them more room than the standard max-w-6xl so fewer columns get
  // pushed into the horizontal-scroll area.
  const wide = pathname.startsWith("/ops/facilities");

  return (
    <div className="flex min-h-screen flex-col">
      <OpsHeader role={role} />
      <div
        className={
          dense
            ? "flex min-h-0 flex-1 flex-col"
            : wide
              ? "mx-auto w-full flex-1 px-4 py-8 sm:px-6 lg:max-w-[80vw]"
              : "mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6"
        }
      >
        {children}
      </div>
    </div>
  );
}
