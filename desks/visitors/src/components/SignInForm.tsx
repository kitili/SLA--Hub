"use client";

import { FormEvent, useState } from "react";
import { VISIT_PURPOSES } from "@/domain/VisitPurpose";
import { createVisit } from "@/lib/visits-client";
import { PhoneField } from "./PhoneField";
import { PhotoCapture } from "./PhotoCapture";

export function SignInForm({
  campus,
  source,
  onSignedIn,
}: {
  campus: string;
  source: "desk" | "self";
  onSignedIn?: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState("");
  const [host, setHost] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    setMessage("");
    try {
      const visit = await createVisit({
        name,
        phone,
        purpose,
        host,
        campus,
        photo,
        source,
      });
      setName("");
      setPhone("");
      setPurpose("");
      setHost("");
      setPhoto(null);
      if (source === "self") {
        setCompleted(visit.name);
      } else {
        setMessage(`${visit.name} signed in at ${visit.campus}.`);
      }
      onSignedIn?.(visit.name);
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  if (completed && source === "self") {
    return (
      <div className="checkin-card card success-panel">
        <h2>You&apos;re signed in</h2>
        <p className="sub">
          Welcome to Silverleaf Academy, {completed}. Please wait at reception if you need a visitor badge.
        </p>
        <button type="button" className="primary-btn" onClick={() => setCompleted("")}>
          Sign in another visitor
        </button>
      </div>
    );
  }

  return (
    <form className={source === "self" ? "checkin-card card" : "signin-card card"} onSubmit={onSubmit}>
      <h2>{source === "self" ? "Sign yourself in" : "Sign in a visitor"}</h2>
      <p className="sub">{campus} campus</p>

      <label htmlFor="fName">Full name</label>
      <input
        id="fName"
        type="text"
        autoComplete="name"
        placeholder="e.g. Amina Joseph"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />

      <PhoneField id="fPhone" value={phone} onChange={setPhone} />

      <label htmlFor="fPurpose">Purpose of visit</label>
      <select
        id="fPurpose"
        value={purpose}
        onChange={(event) => setPurpose(event.target.value)}
        required
      >
        <option value="">Select a reason</option>
        {VISIT_PURPOSES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <label htmlFor="fHost">Person / office visiting</label>
      <input
        id="fHost"
        type="text"
        placeholder="e.g. Erick Anthony, Front Office"
        value={host}
        onChange={(event) => setHost(event.target.value)}
        required
      />

      {source === "desk" ? <PhotoCapture photo={photo} onCapture={setPhoto} /> : null}

      <button className="submit-btn" type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <div className={`form-msg${error ? " err" : ""}`}>{message}</div>
    </form>
  );
}
