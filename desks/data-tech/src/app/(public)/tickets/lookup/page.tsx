import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TicketLookupForm } from "@/components/tickets/ticket-lookup-form";
import { Mark } from "@/components/brand/mark";

export default function TicketLookupPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <Link href="/" className="flex w-fit items-center gap-3">
        <Mark />
        <span>
          <span className="block text-sm font-medium text-navy">Silverleaf</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-navy/45">Data & Tech</span>
        </span>
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-navy/45">Support</p>
          <h1 className="mt-1 text-3xl font-medium text-navy">Check your ticket</h1>
        </div>
        <Link href="/tickets">
          <Button variant="secondary">Submit a new ticket</Button>
        </Link>
      </div>
      <TicketLookupForm />
    </div>
  );
}
