import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Mark } from "@/components/brand/mark";

export default async function Home() {
  const session = await auth();
  if (session?.user && session.error !== "SessionRevoked") {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex min-h-svh flex-1 flex-col overflow-hidden bg-[#001433] text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(900px 420px at 15% -10%, rgba(128,191,236,0.32), transparent 60%), radial-gradient(640px 320px at 100% 110%, rgba(255,201,82,0.18), transparent 55%), linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
          backgroundSize: "auto, auto, 36px 36px, 36px 36px",
        }}
      />
      <header className="relative flex items-center justify-between px-6 py-6 sm:px-10">
        <div className="flex items-center gap-3">
          <Mark tone="dark" />
          <div>
            <div className="text-sm font-medium">Silverleaf</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">Data & Tech</div>
          </div>
        </div>
        <Link href="/login" className="text-sm text-white/70 transition hover:text-white">
          Staff login
        </Link>
      </header>
      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 pb-20 pt-8 sm:px-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold-accent">Systems desk</p>
        <h1 className="mt-4 max-w-xl text-4xl font-medium leading-[1.05] sm:text-6xl">
          Tickets, tools, and the work in flight.
        </h1>
        <p className="mt-5 max-w-lg text-base text-white/65">
          File a support request, or open the desk to run projects, sprints, and the daily 1–5.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/tickets"
            className="inline-flex items-center justify-center rounded-xl bg-gold-accent px-4 py-2.5 text-sm font-medium text-navy transition hover:bg-[#ffd56e]"
          >
            Submit a support ticket
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/15"
          >
            Open the desk
          </Link>
        </div>
      </main>
    </div>
  );
}
