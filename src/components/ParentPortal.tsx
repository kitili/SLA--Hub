"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { signInParentAction, signInTestParentAction, signOutParentAction } from "@/lib/actions/parent-portal";
import type { DayMoment, PortalChild, PortalHousehold } from "@/lib/parent-portal/household";
import styles from "./ParentPortal.module.css";

const ERRORS = {
  invalid: "Enter the mobile number the school has for this family.",
  "not-found": "That number is not on the family list. Enter it as 07… or +255…, using the mobile number saved for the parent.",
  "rate-limited": "Too many tries. Wait a few minutes and try again.",
  unavailable: "The family register is not answering. Try again shortly.",
};

export default function ParentPortal({ household }: { household: PortalHousehold | null }) {
  if (!household) return <SignIn />;
  return <Home household={household} />;
}

function SignIn() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entered = String(new FormData(event.currentTarget).get("phone") ?? phone);
    setError("");
    startTransition(async () => {
      const result = await signInParentAction(entered);
      if (result.ok) {
        router.refresh();
        return;
      }
      setError(ERRORS[result.error]);
    });
  }

  return (
    <main className={styles.gate}>
      <section className={styles.intro}>
        <BrandLogo variant="tagline" width={280} height={72} priority />
        <p className={styles.kicker}>For families</p>
        <h1>Parents</h1>
        <p>One place for your child: the bus, the fee record, and uniform orders.</p>
      </section>
      <form className={styles.card} onSubmit={submit}>
        <h2>Sign in</h2>
        <p>Use the mobile number saved for the parent. 07… and +255… are the same number.</p>
        <label>
          Mobile number
          <input
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="07… or +255…"
            required
            disabled={pending}
          />
        </label>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? "Checking…" : "Open my children"}
        </button>
        <button
          type="button"
          className={styles.secondary}
          disabled={pending}
          onClick={() => {
            setError("");
            startTransition(async () => {
              const result = await signInTestParentAction();
              if (result.ok) {
                router.refresh();
                return;
              }
              setError(ERRORS[result.error]);
            });
          }}
        >
          Enter as a test user
        </button>
      </form>
    </main>
  );
}

function nairobiNow(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", hour: "numeric", hourCycle: "h23" }).format(date),
  );
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const clock = new Intl.DateTimeFormat("en-TZ", {
    timeZone: "Africa/Nairobi",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return { greeting, clock };
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

function dayOf(child: PortalChild): { line: string; moments: DayMoment[] } {
  if (child.line && child.moments?.length) return { line: child.line, moments: child.moments };
  const name = firstName(child.name);
  const scan = child.scan;
  if (scan?.droppedOff) {
    return {
      line: `${name} was dropped off at ${scan.when} on ${scan.bus}.`,
      moments: [
        { label: "Morning", detail: "Bus recorded", state: "done" },
        { label: "Class", detail: child.grade, state: "done" },
        { label: "Home", detail: scan.when, state: "now" },
      ],
    };
  }
  if (scan?.morningBoarded) {
    return {
      line: `${name} boarded ${scan.bus} at ${scan.when}. No afternoon scan yet.`,
      moments: [
        { label: "Morning", detail: `${scan.bus} · ${scan.when}`, state: "now" },
        { label: "Class", detail: child.grade, state: "later" },
        { label: "Home", detail: "No afternoon scan", state: "later" },
      ],
    };
  }
  return {
    line: `${name} has no bus scan today. Class and fees below are from the register.`,
    moments: [
      { label: "Morning", detail: "No scan today", state: "now" },
      { label: "Class", detail: child.grade, state: "later" },
      { label: "Home", detail: "No afternoon scan", state: "later" },
    ],
  };
}

function feeFace(fee: string) {
  if (/nothing outstanding/i.test(fee)) return { title: "Clear", detail: "Nothing left on the fee record." };
  const amount = fee.match(/[A-Z]{3}\s[\d,]+/);
  if (amount) return { title: amount[0], detail: "Still on the fee record." };
  return { title: "Not in yet", detail: fee };
}

function Home({ household }: { household: PortalHousehold }) {
  const router = useRouter();
  const [childId, setChildId] = useState(household.children[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => nairobiNow());
  const child = household.children.find((item) => item.id === childId) ?? household.children[0];

  function signOut() {
    startTransition(async () => {
      await signOutParentAction();
      router.refresh();
    });
  }

  return (
    <main className={styles.home}>
      <Clock onTick={setNow} />
      <header className={styles.sky}>
        <div className={styles.sun} aria-hidden="true" />
        <div className={styles.skyCopy}>
          <p className={styles.kicker}>{child ? `${now.greeting}, ${firstName(child.name)}` : now.greeting}</p>
          <h1>{child ? child.school : "Your children"}</h1>
          <p className={styles.when}>{now.clock}</p>
        </div>
        <button type="button" className={styles.textButton} onClick={signOut} disabled={pending}>
          Sign out
        </button>
      </header>

      {household.demo ? <p className={styles.chip}>Test family · a sample day, not a real pupil</p> : null}
      {household.preview ? (
        <p className={styles.chip}>From the family register. The bus scan, class, and fee are this child’s records.</p>
      ) : null}

      {household.children.length === 0 ? (
        <p className={styles.note}>This number is on file, and no pupil is linked to it yet.</p>
      ) : (
        <>
          <div className={styles.family} role="tablist" aria-label="Children">
            {household.children.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                className={styles.child}
                data-active={item.id === child?.id}
                aria-selected={item.id === child?.id}
                onClick={() => setChildId(item.id)}
              >
                <span className={styles.face} aria-hidden="true">
                  {initials(item.name).toUpperCase()}
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <span>
                    {item.grade}
                    {item.active ? "" : " · not current"}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {child ? (
            <section className={styles.stage} key={child.id} aria-live="polite">
              <article className={styles.today}>
                <p className={styles.nowLabel}>From the register</p>
                <h2>{dayOf(child).line}</h2>
                <ol className={styles.track}>
                  {dayOf(child).moments.map((moment) => (
                    <li key={moment.label} data-state={moment.state}>
                      <span className={styles.dot} />
                      <span>
                        <strong>{moment.label}</strong>
                        <span>{moment.detail}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </article>

              <div className={styles.stack}>
                <article className={styles.bus}>
                  <h2>Bus</h2>
                  <div className={styles.route} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <p>{child.boarding}</p>
                </article>
                <article className={styles.fee} data-clear={/nothing outstanding/i.test(child.fee)}>
                  <h2>Fees</h2>
                  <p className={styles.amount}>{feeFace(child.fee).title}</p>
                  <p>{feeFace(child.fee).detail}</p>
                </article>
                <article>
                  <h2>Uniforms</h2>
                  {child.uniforms.length === 0 ? (
                    <p>No uniform order is on file for this child.</p>
                  ) : (
                    <ul className={styles.orders}>
                      {child.uniforms.map((order) => (
                        <li key={order.ref}>
                          <strong>{order.ref}</strong>
                          <span>{order.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
                <a className={styles.calendar} href="https://sla-marketing-web.vercel.app/calendar">
                  <span>School calendar</span>
                  <strong>Term dates and what is coming</strong>
                </a>
              </div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

function Clock({ onTick }: { onTick: (value: { greeting: string; clock: string }) => void }) {
  useEffect(() => {
    const id = window.setInterval(() => onTick(nairobiNow()), 30_000);
    return () => window.clearInterval(id);
  }, [onTick]);
  return null;
}
