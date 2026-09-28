import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function fail(message: string): Promise<never> {
  const headerList = await headers();
  const ref = headerList.get("referer");
  // Resolve the target path first, entirely outside any try/catch around
  // redirect() itself — redirect() throws by design to signal Next.js's
  // navigation, and a try/catch wrapping that call would (and previously
  // did) mis-catch its own throw as if the referer URL had failed to
  // parse, silently sending every failure to /desk regardless of where it
  // actually happened. That's invisible for staff (/desk is their home
  // anyway) but breaks error delivery entirely for PARENT, who can't open
  // /desk — middleware bounces them to /parent and drops the query string,
  // so the message never rendered.
  let target = `/desk?error=${encodeURIComponent(message)}`;
  if (ref) {
    try {
      const url = new URL(ref);
      url.searchParams.set("error", message);
      target = `${url.pathname}?${url.searchParams.toString()}`;
    } catch {
      // malformed referer — keep the /desk fallback
    }
  }
  redirect(target);
}

// Mirrors fail()'s referer-redirect so a success message lands back on
// whichever page the action was submitted from (the Ask page's own form, or
// the Alerts page's Request button), instead of every action needing to know
// its own caller.
export async function succeed(message: string): Promise<never> {
  const headerList = await headers();
  const ref = headerList.get("referer");
  let target = `/desk?ok=${encodeURIComponent(message)}`;
  if (ref) {
    try {
      const url = new URL(ref);
      url.searchParams.set("ok", message);
      target = `${url.pathname}?${url.searchParams.toString()}`;
    } catch {
      // malformed referer — keep the /desk fallback
    }
  }
  redirect(target);
}

/**
 * UI-first draft actions: the button/form/confirm-modal is real, but the
 * backend isn't built yet. Marks that clearly instead of silently no-op'ing,
 * and gives every draft action the same message shape. Replace with the
 * real mutation (in a $transaction, with writeAudit()) once wired up.
 */
export async function notYetImplemented(feature: string): Promise<never> {
  return fail(`"${feature}" is a UI draft — backend action not wired up yet.`);
}
