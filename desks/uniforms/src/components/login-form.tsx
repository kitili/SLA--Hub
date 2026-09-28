"use client";

import { useFormStatus } from "react-dom";
import { loginAction, parentLoginAction } from "@/actions/auth";
import { DEMO_PASSWORD } from "@/lib/constants";
import { Flash } from "./flash";
import { inputClass } from "./ui";

const DESKS = [
  ["ceo@silverleaf.ac.tz", "Leadership", "CEO"],
  ["imani@silverleaf.ac.tz", "Imani", "Store & finance"],
  ["loveness@silverleaf.ac.tz", "Loveness", "Sew"],
  ["schools@silverleaf.ac.tz", "School admins", "All campuses"],
] as const;

function DeskSubmit({ name, hint }: { name: string; hint: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="flex w-full items-center justify-between rounded-[10px] border border-card-border bg-white px-4 py-3 text-left hover:border-electric-blue hover:bg-light-blue-30 disabled:opacity-60"
      type="submit"
      disabled={pending}
      aria-busy={pending}
    >
      <span className="font-semibold text-electric-blue">{pending ? "Signing in…" : name}</span>
      <span className="text-sm text-ink-muted">{hint}</span>
    </button>
  );
}

export function LoginForm({ error }: { error?: string }) {
  return (
    <div className="grid gap-5">
      <Flash error={error} />
      <div className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Staff</p>
        {DESKS.map(([email, name, hint]) => (
          <form action={loginAction} key={email}>
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="password" value={DEMO_PASSWORD} />
            <DeskSubmit name={name} hint={hint} />
          </form>
        ))}
      </div>
      <form action={parentLoginAction} className="grid gap-2 rounded-[12px] border border-gold bg-gold-15 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Parent</p>
        <p className="text-sm text-ink-muted">
          Enter a child registration number. Siblings at any campus share one family account.
        </p>
        <input
          className={inputClass()}
          name="regNo"
          placeholder="Registration number"
          autoComplete="off"
          required
        />
        <button
          className="rounded-[10px] bg-electric-blue px-4 py-2.5 text-sm font-semibold text-white"
          type="submit"
        >
          Open my orders
        </button>
      </form>
    </div>
  );
}
