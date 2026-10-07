"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { signInParentAction, signInTestParentAction, signOutParentAction } from "@/lib/actions/parent-portal";
import type { PortalHousehold } from "@/lib/parent-portal/household";
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

function Home({ household }: { household: PortalHousehold }) {
  const router = useRouter();
  const [childId, setChildId] = useState(household.children[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const child = household.children.find((item) => item.id === childId) ?? household.children[0];

  function signOut() {
    startTransition(async () => {
      await signOutParentAction();
      router.refresh();
    });
  }

  return (
    <main className={styles.home}>
      <header className={styles.top}>
        <div>
          <p className={styles.kicker}>Silverleaf</p>
          <h1>{household.demo ? "Test family" : "Your children"}</h1>
        </div>
        <button type="button" className={styles.textButton} onClick={signOut} disabled={pending}>
          Sign out
        </button>
      </header>

      {household.demo ? (
        <p className={styles.note}>Sample figures for a test family. This is not a real pupil.</p>
      ) : null}

      {household.children.length === 0 ? (
        <p className={styles.note}>This number is on file, and no active pupil is linked to it yet.</p>
      ) : (
        <>
          <div className={styles.children}>
            {household.children.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.child}
                data-active={item.id === child?.id}
                aria-pressed={item.id === child?.id}
                onClick={() => setChildId(item.id)}
              >
                <strong>{item.name}</strong>
                <span>
                  {item.grade} · {item.school}
                  {item.active ? "" : " · not current"}
                </span>
              </button>
            ))}
          </div>
          {child ? (
            <section className={styles.facts} aria-live="polite">
              <article>
                <h2>Bus</h2>
                <p>{child.boarding}</p>
              </article>
              <article>
                <h2>Fees</h2>
                <p>{child.fee}</p>
              </article>
              <article>
                <h2>Uniforms</h2>
                {child.uniforms.length === 0 ? (
                  <p>No uniform order is on file for this child.</p>
                ) : (
                  <ul>
                    {child.uniforms.map((order) => (
                      <li key={order.ref}>
                        {order.ref} · {order.status}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
              <article>
                <h2>School</h2>
                <p>
                  Term dates are on the school calendar. A serious incident is sent by text. This page does not
                  show other children.
                </p>
                <a href="https://sla-marketing-web.vercel.app/calendar">Open the calendar</a>
              </article>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
