import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ActiveTripChip } from "@/components/matron/ActiveTripChip";
import { MatronBrandMark } from "@/components/matron/MatronBrandMark";
import { MatronNav } from "@/components/matron/MatronNav";
import { brand } from "@/lib/brand";

export function MatronShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[var(--app-bg)]">
      <div
        className="pointer-events-none fixed inset-0 z-0 print:hidden"
        aria-hidden
        style={{
          background:
            "radial-gradient(900px 420px at 10% -20%, var(--app-bg-glow), transparent 60%), linear-gradient(180deg, #f7fbff 0%, var(--app-bg) 50%, #eaf2f9 100%)",
        }}
      />

      <header className="print:hidden sticky top-0 z-20 border-b border-card-border/80 bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <Link
            href="/matron"
            className="group flex min-w-0 items-center gap-2.5 no-underline"
          >
            <MatronBrandMark variant="header" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-electric-blue">
                {brand.shortName}
              </p>
              <p className="text-[11px] font-medium text-ink-muted">
                Field ops
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <ActiveTripChip />
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-3xl pb-[calc(5rem+env(safe-area-inset-bottom))] print:max-w-none print:pb-0">
        {children}
      </div>

      <MatronNav />
    </div>
  );
}
