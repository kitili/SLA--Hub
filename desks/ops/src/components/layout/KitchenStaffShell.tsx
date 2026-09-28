import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { brand } from "@/lib/brand";

export function KitchenStaffShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#eef5fb]">
      <header className="sticky top-0 z-20 border-b border-card-border/70 bg-white/90 px-4 py-2.5 shadow-[var(--shadow)] backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
          <Link href="/kitchen" className="min-w-0 no-underline">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-light-blue/90">
              Kitchen duty
            </p>
            <p className="truncate text-sm font-extrabold tracking-tight text-electric-blue">
              {brand.shortName}
            </p>
          </Link>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-4 py-5 sm:px-6">{children}</div>
    </div>
  );
}
