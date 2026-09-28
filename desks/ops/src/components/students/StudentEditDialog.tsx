"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { StudentInitials } from "@/components/students/StudentInitials";
import { parseLocationLink } from "@/lib/geo/parse-location-link";
import type { StudentPickupDetails } from "@/lib/db/routes";
import type { StudentWithDetails } from "@/types/database";

type PickupForm = {
  routeId: string;
  lat: string;
  lng: string;
  stopName: string;
  link: string;
  fromOverrideId: string | null;
};

const emptyPickup: PickupForm = {
  routeId: "",
  lat: "",
  lng: "",
  stopName: "",
  link: "",
  fromOverrideId: null,
};

function mapLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

const inputClass =
  "w-full rounded-[var(--radius-sm)] border border-card-border bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-electric-blue focus:ring-2 focus:ring-gold/40";

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

type FormState = {
  firstName: string;
  lastName: string;
  className: string;
  active: boolean;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
};

function fromStudent(student: StudentWithDetails): FormState {
  return {
    firstName: student.first_name,
    lastName: student.last_name,
    className: student.class_name ?? "",
    active: student.active,
    parentName: student.parent_name ?? "",
    parentPhone: student.parent_phone ?? "",
    parentEmail: student.parent_email ?? "",
  };
}

/**
 * "Edit" button + pop-up for one student on the admin Students tab. Campus,
 * QR code and fee balance are shown read-only — see updateStudent() for why.
 *
 * The pop-up is portalled to <body>: student cards use .ui-panel, whose
 * backdrop-filter makes it the containing block for position:fixed children,
 * so rendering it inline trapped the overlay inside the card.
 */
export function StudentEditDialog({ student }: { student: StudentWithDetails }) {
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => fromStudent(student));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickup, setPickup] = useState<StudentPickupDetails | null>(null);
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [pickupForm, setPickupForm] = useState<PickupForm>(emptyPickup);
  const [linkHint, setLinkHint] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setPick<K extends keyof PickupForm>(key: K, value: PickupForm[K]) {
    setPickupForm((prev) => ({ ...prev, [key]: value }));
  }

  async function loadPickup() {
    setPickup(null);
    setPickupError(null);
    try {
      const res = await fetch(`/api/students/${student.id}/pickup`);
      const data = (await res.json()) as StudentPickupDetails & { error?: string };
      if (!res.ok) {
        setPickupError(data.error ?? "Could not load pickup point");
        return;
      }
      setPickup(data);
      setPickupForm({ ...emptyPickup, routeId: data.current?.routeId ?? "" });
    } catch {
      setPickupError("Network error loading pickup point");
    }
  }

  function openDialog() {
    // Re-fill from the latest saved data each time, so a cancelled edit
    // never lingers into the next one.
    setForm(fromStudent(student));
    setPickupForm(emptyPickup);
    setLinkHint(null);
    setError(null);
    setOpen(true);
    void loadPickup();
  }

  function applyLink(value: string) {
    setPick("link", value);
    if (!value.trim()) {
      setLinkHint(null);
      return;
    }
    const coords = parseLocationLink(value);
    if (coords) {
      setPickupForm((prev) => ({
        ...prev,
        link: value,
        lat: String(coords.lat),
        lng: String(coords.lng),
      }));
      setLinkHint("Location read from the link ✓");
    } else if (/goo\.gl|maps\.app/i.test(value)) {
      setLinkHint(
        "Short links hide the location. Open it in the browser, then copy the long link from the address bar.",
      );
    } else {
      setLinkHint("Couldn't find a location in that — type the latitude and longitude instead.");
    }
  }

  function applyTemporaryAsPermanent() {
    const o = pickup?.activeOverride;
    if (!o) return;
    setPickupForm((prev) => ({
      ...prev,
      routeId: prev.routeId || pickup?.current?.routeId || "",
      lat: String(o.lat),
      lng: String(o.lng),
      stopName: o.name ?? "",
      link: "",
      fromOverrideId: o.id,
    }));
    setLinkHint(null);
  }

  const pickupChanging = Boolean(pickupForm.lat.trim() || pickupForm.lng.trim());

  function close() {
    if (!saving) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, saving]);

  async function save(e: React.FormEvent) {
    e.preventDefault();

    const lat = Number(pickupForm.lat);
    const lng = Number(pickupForm.lng);
    if (pickupChanging) {
      if (!pickupForm.routeId) {
        setError("Choose the route (bus) for the new pickup point.");
        return;
      }
      if (
        !pickupForm.lat.trim() ||
        !pickupForm.lng.trim() ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        setError("Fill in both latitude and longitude for the new pickup point.");
        return;
      }
    }

    if (student.active && !form.active) {
      const ok = await confirm({
        title: "Deactivate student?",
        message: `${form.firstName} ${form.lastName} will disappear from rosters and their QR code will stop scanning. Their trip history is kept, and you can reactivate them later.`,
        confirmLabel: "Deactivate",
        tone: "danger",
      });
      if (!ok) return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save");
        return;
      }

      if (pickupChanging) {
        const pickupRes = await fetch(`/api/students/${student.id}/pickup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            routeId: pickupForm.routeId,
            lat,
            lng,
            stopName: pickupForm.stopName,
            fromOverrideId: pickupForm.fromOverrideId ?? undefined,
          }),
        });
        const pickupData = (await pickupRes.json()) as { error?: string };
        if (!pickupRes.ok) {
          setError(
            `Details saved, but the pickup point wasn't: ${pickupData.error ?? "unknown error"}`,
          );
          router.refresh();
          void loadPickup();
          return;
        }
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  const popup = (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${student.first_name} ${student.last_name}`}
      onClick={close}
    >
      <form
        onSubmit={(e) => void save(e)}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius)] bg-white shadow-[0_24px_60px_rgba(0,35,104,0.28)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-card-border bg-light-blue-30 px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <StudentInitials
              firstName={form.firstName || student.first_name}
              lastName={form.lastName || student.last_name}
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
                Edit student
              </p>
              <h2 className="truncate text-xl font-extrabold text-electric-blue">
                {student.first_name} {student.last_name}
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                {student.school_name ?? "Unknown campus"} · QR{" "}
                <span className="font-mono font-semibold">
                  {student.qr_code ?? "—"}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-mr-1 rounded-full p-1.5 text-lg leading-none text-ink-muted transition hover:bg-white hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5">
          <section>
            <h3 className="text-sm font-bold text-ink">Student details</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="First name">
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="Last name">
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="Class">
                <input
                  type="text"
                  value={form.className}
                  onChange={(e) => set("className", e.target.value)}
                  placeholder="e.g. Grade 3"
                  className={inputClass}
                />
              </Field>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-ink">Parent contact</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Parent name">
                <input
                  type="text"
                  value={form.parentName}
                  onChange={(e) => set("parentName", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={form.parentPhone}
                  onChange={(e) => set("parentPhone", e.target.value)}
                  placeholder="e.g. 0712 345 678"
                  className={inputClass}
                />
              </Field>
              <Field label="Email (optional)" wide>
                <input
                  type="email"
                  value={form.parentEmail}
                  onChange={(e) => set("parentEmail", e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-ink">Pickup point</h3>

            {pickupError ? (
              <p className="mt-2 text-sm text-danger">{pickupError}</p>
            ) : !pickup ? (
              <p className="mt-2 text-sm text-ink-faint">Loading pickup point…</p>
            ) : (
              <div className="mt-3 flex flex-col gap-4">
                <div className="rounded-[var(--radius-sm)] border border-card-border bg-light-blue-30/60 px-4 py-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Now
                  </p>
                  {pickup.current ? (
                    <>
                      <p className="mt-1 font-semibold text-ink">
                        {pickup.current.stopName}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {pickup.current.busLabel ?? "No bus on this route"} ·{" "}
                        {pickup.current.routeName ?? "No route"}
                        {pickup.current.lat != null && pickup.current.lng != null ? (
                          <>
                            {" · "}
                            <a
                              href={mapLink(pickup.current.lat, pickup.current.lng)}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-electric-blue"
                            >
                              View on map
                            </a>
                          </>
                        ) : null}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-ink-muted">No pickup point assigned yet.</p>
                  )}
                </div>

                {pickup.activeOverride ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-gold/40 bg-gold-15 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        Temporary pickup · {pickup.activeOverride.startsOn} →{" "}
                        {pickup.activeOverride.endsOn}
                      </p>
                      <p className="mt-1 font-semibold text-ink">
                        {pickup.activeOverride.name ?? "Temporary location"}
                        {" · "}
                        <a
                          href={mapLink(pickup.activeOverride.lat, pickup.activeOverride.lng)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-electric-blue"
                        >
                          View on map
                        </a>
                      </p>
                      {pickup.activeOverride.reason ? (
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {pickup.activeOverride.reason}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={applyTemporaryAsPermanent}
                      disabled={pickupForm.fromOverrideId === pickup.activeOverride.id}
                      className="rounded-[var(--radius-sm)] border border-electric-blue/30 bg-white px-3 py-1.5 text-xs font-bold text-electric-blue hover:border-electric-blue disabled:opacity-60"
                    >
                      {pickupForm.fromOverrideId === pickup.activeOverride.id
                        ? "Will be made permanent on Save"
                        : "Make this permanent"}
                    </button>
                  </div>
                ) : null}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Change permanently{" "}
                    <span className="font-normal normal-case tracking-normal text-ink-faint">
                      — leave blank to keep the current one
                    </span>
                  </p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field label="Route (bus)" wide>
                      <select
                        value={pickupForm.routeId}
                        onChange={(e) => setPick("routeId", e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Choose a route…</option>
                        {pickup.routes.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.direction.toUpperCase()}) —{" "}
                            {r.busLabel ?? "no bus"}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Paste Google Maps / WhatsApp location link" wide>
                      <input
                        type="text"
                        value={pickupForm.link}
                        onChange={(e) => applyLink(e.target.value)}
                        placeholder="https://maps.google.com/?q=-3.37,36.68"
                        className={inputClass}
                      />
                    </Field>
                    {linkHint ? (
                      <p
                        className={`-mt-2 text-xs sm:col-span-2 ${
                          linkHint.endsWith("✓") ? "text-success" : "text-ink-muted"
                        }`}
                      >
                        {linkHint}
                      </p>
                    ) : null}
                    <Field label="Latitude">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={pickupForm.lat}
                        onChange={(e) => setPick("lat", e.target.value)}
                        placeholder="e.g. -3.3702"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Longitude">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={pickupForm.lng}
                        onChange={(e) => setPick("lng", e.target.value)}
                        placeholder="e.g. 36.6847"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Pickup name (optional)" wide>
                      <input
                        type="text"
                        value={pickupForm.stopName}
                        onChange={(e) => setPick("stopName", e.target.value)}
                        placeholder="e.g. Njiro, near the petrol station"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  {pickupChanging ? (
                    <p className="mt-2 text-xs text-ink-muted">
                      On Save, the student moves to this point for good. Their old
                      stop comes off the route if no one else uses it.
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </section>

          <section
            className={`flex items-center justify-between gap-4 rounded-[var(--radius-sm)] border p-4 ${
              form.active
                ? "border-card-border bg-light-blue-30/60"
                : "border-danger/30 bg-danger/5"
            }`}
          >
            <div>
              <p className="text-sm font-bold text-ink">
                {form.active ? "Active" : "Deactivated"}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {form.active
                  ? "Shows on rosters and their QR code scans."
                  : "Hidden from rosters and QR won't scan. History is kept."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.active}
              aria-label="Active"
              onClick={() => set("active", !form.active)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                form.active ? "bg-success" : "bg-ink-faint/40"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  form.active ? "left-6" : "left-1"
                }`}
              />
            </button>
          </section>

          {error ? (
            <p className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-card-border px-6 py-4">
          <button
            type="button"
            onClick={close}
            disabled={saving}
            className="rounded-[var(--radius-sm)] border border-card-border px-4 py-2.5 text-sm font-semibold text-ink-muted transition hover:border-ink-muted hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-[var(--radius-sm)] bg-gradient-to-br from-navy-light to-electric-blue px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(0,35,104,0.2)] transition hover:brightness-105 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-electric-blue/30 bg-white px-3 py-1.5 text-xs font-bold text-electric-blue transition hover:border-electric-blue hover:bg-light-blue-30"
      >
        <span aria-hidden>✎</span>
        {student.active ? "Edit" : "Edit / reactivate"}
      </button>

      {open ? createPortal(popup, document.body) : null}
      {confirmDialog ? createPortal(confirmDialog, document.body) : null}
    </>
  );
}
