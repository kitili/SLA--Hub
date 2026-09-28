"use client";

/**
 * BioForm — the member's multi-section bio-data form (client island).
 *
 * Owns all form state, the repeating-group add/remove logic, consent, and
 * submission via the `saveMyBioAction` server action. On success it swaps to a
 * "saved" confirmation with a re-edit button.
 *
 * Accessibility: every input has an associated <label>; required inputs set
 * `aria-required`; validation errors from the server are shown inline and tied
 * to the field via `aria-describedby`. Mobile-first: a single responsive column
 * grid that collapses to one column on narrow screens.
 *
 * Privacy: no field values are logged anywhere. Consent is required to submit
 * and is recorded server-side.
 */

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { saveMyBioAction, type BioFormInput } from "@/lib/actions/bio";
import { useRouter } from "@/i18n/navigation";
import QualDocUpload from "./QualDocUpload";
import CvUpload from "./CvUpload";
import type { BioDocumentView } from "@/lib/db/queries/bio-documents";

/* ------------------------------------------------------------------ */
/* Initial-values type (all strings — produced by serialize.ts)        */
/* ------------------------------------------------------------------ */

interface SpouseValues {
  fullName: string;
  phone: string;
  occupation: string;
  employer: string;
}
interface ChildValues {
  fullNames: string;
  dateOfBirth: string;
  gender: string;
  schoolEmployer: string;
  contactNumber: string;
}
interface FamilyContactValues {
  relationship: string;
  fullName: string;
  phone: string;
  address: string;
  occupation: string;
}
interface EmergencyContactValues {
  fullName: string;
  relationship: string;
  phone: string;
  address: string;
  priority: string;
}
interface RelativeValues {
  fullName: string;
  relationship: string;
  position: string;
  workStation: string;
}
interface QualificationValues {
  level: string;
  qualification: string;
  institution: string;
  yearObtained: string;
}
interface EmploymentValues {
  employer: string;
  position: string;
  dateFrom: string;
  dateTo: string;
  leavingReason: string;
}
interface ReferenceValues {
  referenceOrder: number;
  fullName: string;
  relationship: string;
  phone: string;
  email: string;
  organization: string;
}

export interface BioInitialValues {
  surname: string;
  firstName: string;
  middleName: string;
  otherNames: string;
  maidenName: string;
  gender: string;
  maritalStatus: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  hasDisabilities: "yes" | "no" | "";
  disabilitiesDetails: string;
  homePhone: string;
  mobilePhone: string;
  email: string;
  residentialAddress: string;
  identificationNo: string;
  idPlaceOfIssue: string;
  idExpiryDate: string;
  drivingPermitNo: string;
  drivingPlaceOfIssue: string;
  drivingExpiryDate: string;
  nssfNo: string;
  tinNo: string;
  nhifNo: string;
  position: string;
  workStation: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  mobileMoneyNumber: string;
  arrestRecord: "yes" | "no" | "";
  arrestDetails: string;
  misconductRecord: "yes" | "no" | "";
  misconductDetails: string;
  certificationName: string;
  certificationDate: string;
  consent: boolean;
  spouse: SpouseValues;
  children: ChildValues[];
  familyContacts: FamilyContactValues[];
  emergencyContacts: EmergencyContactValues[];
  relativesEmployed: RelativeValues[];
  qualifications: QualificationValues[];
  employmentHistory: EmploymentValues[];
  references: ReferenceValues[];
}

interface Props {
  initial: BioInitialValues;
  locale: string;
  lastSaved: string | null;
  /** Per-row qualification files, keyed by string row index ("0", "1", …). */
  initialQualDocuments: Record<string, BioDocumentView[]>;
  /** CV files already uploaded by this member. */
  initialCvDocuments: BioDocumentView[];
}

/* ------------------------------------------------------------------ */
/* Style tokens                                                        */
/* ------------------------------------------------------------------ */

const C = {
  border: "#dee2e6",
  muted: "#6c757d",
  danger: "#dc3545",
  primary: "#0d6efd",
  primaryDark: "#0b5ed7",
  bgSubtle: "#f8f9fa",
  sensitive: "#fff8e1",
  sensitiveBorder: "#ffe08a",
};

const sectionStyle: React.CSSProperties = {
  // `position: relative` + extra top padding lets the legend sit absolutely in
  // the top padding (see legendStyle) so the card border renders complete.
  position: "relative",
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: "52px 20px 20px",
  marginBottom: 20,
  background: "#fff",
  boxSizing: "border-box",
  minWidth: 0,
};

const legendStyle: React.CSSProperties = {
  // Absolutely position the title inside the fieldset's top padding so the
  // border renders COMPLETE — the default legend "notch" read as a visual
  // glitch against the rounded corners. Fields then flow normally below it.
  position: "absolute",
  top: 20,
  left: 20,
  right: 20,
  margin: 0,
  padding: 0,
  fontSize: "1.15rem",
  fontWeight: 700,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  // Comfortable touch target on mobile (>=44px). width:100% already makes
  // every field full-width inside the single-column grid on phones.
  minHeight: 44,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  fontSize: "0.95rem",
  boxSizing: "border-box",
};

const supportLinkCardStyle: React.CSSProperties = {
  marginTop: 16,
  padding: "14px 16px",
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  background: C.bgSubtle,
};

const supportLinkListStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 10,
};

const supportLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 10px",
  borderRadius: 999,
  background: "#fff",
  border: `1px solid ${C.border}`,
  color: C.primary,
  fontSize: "0.86rem",
  fontWeight: 600,
  textDecoration: "none",
};

const prepCardStyle: React.CSSProperties = {
  marginBottom: 20,
  padding: "16px 18px",
  borderRadius: 12,
  border: `1px solid ${C.sensitiveBorder}`,
  background: C.sensitive,
};

const prepListStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "8px 18px",
  margin: "10px 0 0",
  paddingLeft: 20,
  color: "#5f4b00",
  fontSize: "0.9rem",
};

/* ------------------------------------------------------------------ */
/* Empty-row factories                                                 */
/* ------------------------------------------------------------------ */

const emptyChild = (): ChildValues => ({
  fullNames: "",
  dateOfBirth: "",
  gender: "",
  schoolEmployer: "",
  contactNumber: "",
});
const emptyFamilyContact = (): FamilyContactValues => ({
  relationship: "",
  fullName: "",
  phone: "",
  address: "",
  occupation: "",
});
const emptyEmergencyContact = (): EmergencyContactValues => ({
  fullName: "",
  relationship: "",
  phone: "",
  address: "",
  priority: "",
});
const emptyRelative = (): RelativeValues => ({
  fullName: "",
  relationship: "",
  position: "",
  workStation: "",
});
const emptyQualification = (): QualificationValues => ({
  level: "",
  qualification: "",
  institution: "",
  yearObtained: "",
});
const emptyEmployment = (): EmploymentValues => ({
  employer: "",
  position: "",
  dateFrom: "",
  dateTo: "",
  leavingReason: "",
});

function DocumentSupportLinks({ locale }: { locale: string }) {
  const isSw = locale === "sw";
  const links = [
    {
      label: isSw ? "Jinsi ya kupata NSSF" : "How to find/register NSSF",
      href: "https://www.youtube.com/results?search_query=NSSF+Tanzania+registration+number",
    },
    {
      label: isSw ? "Jinsi ya kupata TIN" : "How to get a TRA TIN",
      href: "https://www.youtube.com/results?search_query=TRA+TIN+number+Tanzania+registration",
    },
    {
      label: isSw ? "Jinsi ya kupata NHIF" : "How to find/register NHIF",
      href: "https://www.youtube.com/results?search_query=NHIF+Tanzania+registration+number",
    },
  ];

  return (
    <aside style={supportLinkCardStyle}>
      <h3 style={{ fontSize: "0.98rem", margin: 0 }}>
        {isSw
          ? "Unahitaji msaada kupata namba hizi?"
          : "Need help finding these numbers?"}
      </h3>
      <p style={{ color: C.muted, fontSize: "0.86rem", margin: "4px 0 0" }}>
        {isSw
          ? "Fungua video za YouTube kwa mwongozo wa NSSF, TIN na NHIF. HR bado inaweza kukusaidia kama huna namba hizi sasa."
          : "Open these YouTube support links for NSSF, TIN and NHIF guidance. HR can still help if you do not have the numbers yet."}
      </p>
      <div style={supportLinkListStyle}>
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            style={supportLinkStyle}
          >
            YouTube: {link.label}
          </a>
        ))}
      </div>
    </aside>
  );
}

function BioPrepChecklist({ locale }: { locale: string }) {
  const isSw = locale === "sw";
  const items = isSw
    ? [
        "Kitambulisho cha taifa au hati ya kusafiria",
        "NSSF, TIN na NHIF kama unazo",
        "Taarifa za benki au malipo ya simu",
        "Vyeti vya elimu na sifa",
        "CV yako ya sasa",
        "Mawasiliano ya dharura na wadhamini",
      ]
    : [
        "National ID or passport details",
        "NSSF, TIN and NHIF numbers if available",
        "Bank or mobile money details",
        "Education and qualification certificates",
        "Your current CV",
        "Emergency contacts and references",
      ];

  return (
    <aside style={prepCardStyle}>
      <h2 style={{ color: "#5f4b00", fontSize: "1rem", margin: 0 }}>
        {isSw ? "Kabla ya kuanza" : "Before you start"}
      </h2>
      <p style={{ color: "#5f4b00", fontSize: "0.9rem", margin: "4px 0 0" }}>
        {isSw
          ? "Utamaliza haraka zaidi ukiandaa vitu hivi kwanza."
          : "You will finish faster if you prepare these items first."}
      </p>
      <ul style={prepListStyle}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  );
}

/* ================================================================== */
/* Component                                                          */
/* ================================================================== */

export default function BioForm({
  initial,
  locale,
  lastSaved,
  initialQualDocuments,
  initialCvDocuments,
}: Props) {
  const t = useTranslations("bio");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // One state object for the flat fields; arrays handled separately so add/
  // remove is simple and stable.
  const [v, setV] = useState<BioInitialValues>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(lastSaved);
  const [justSaved, setJustSaved] = useState(false);
  const [showBioWelcome, setShowBioWelcome] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("sla_bio_seen")) {
        setShowBioWelcome(true);
      }
    } catch {
      // localStorage blocked (private browsing, etc.) — skip silently
    }
  }, []);

  function dismissBioWelcome() {
    try { localStorage.setItem("sla_bio_seen", "1"); } catch { /* ignore */ }
    setShowBioWelcome(false);
  }

  const showSpouse = v.maritalStatus === "Married";

  /** Set a flat field. */
  function set<K extends keyof BioInitialValues>(
    key: K,
    value: BioInitialValues[K],
  ) {
    setV((prev) => ({ ...prev, [key]: value }));
  }

  /** Update one element of a repeating-group array. */
  function setRow<T>(
    key: keyof BioInitialValues,
    index: number,
    patch: Partial<T>,
  ) {
    setV((prev) => {
      const arr = [...(prev[key] as unknown as T[])];
      arr[index] = { ...arr[index], ...patch } as T;
      return { ...prev, [key]: arr };
    });
  }

  function addRow<T>(key: keyof BioInitialValues, factory: () => T) {
    setV((prev) => ({
      ...prev,
      [key]: [...(prev[key] as unknown as T[]), factory()],
    }));
  }

  function removeRow(key: keyof BioInitialValues, index: number) {
    setV((prev) => {
      const arr = [...(prev[key] as unknown as unknown[])];
      arr.splice(index, 1);
      return { ...prev, [key]: arr };
    });
  }

  /** Build the server-action payload from current state. */
  function buildPayload(): BioFormInput {
    return {
      surname: v.surname,
      firstName: v.firstName,
      middleName: v.middleName,
      otherNames: v.otherNames,
      maidenName: v.maidenName,
      gender: v.gender as BioFormInput["gender"],
      maritalStatus: v.maritalStatus as BioFormInput["maritalStatus"],
      dateOfBirth: v.dateOfBirth,
      placeOfBirth: v.placeOfBirth,
      nationality: v.nationality,
      hasDisabilities: v.hasDisabilities === "" ? null : v.hasDisabilities,
      disabilitiesDetails: v.disabilitiesDetails,
      homePhone: v.homePhone,
      mobilePhone: v.mobilePhone,
      email: v.email,
      residentialAddress: v.residentialAddress,
      identificationNo: v.identificationNo,
      idPlaceOfIssue: v.idPlaceOfIssue,
      idExpiryDate: v.idExpiryDate,
      drivingPermitNo: v.drivingPermitNo,
      drivingPlaceOfIssue: v.drivingPlaceOfIssue,
      drivingExpiryDate: v.drivingExpiryDate,
      nssfNo: v.nssfNo,
      tinNo: v.tinNo,
      nhifNo: v.nhifNo,
      position: v.position,
      workStation: v.workStation,
      bankName: v.bankName,
      accountName: v.accountName,
      accountNumber: v.accountNumber,
      mobileMoneyNumber: v.mobileMoneyNumber,
      arrestRecord: v.arrestRecord === "" ? null : v.arrestRecord,
      arrestDetails: v.arrestDetails,
      misconductRecord: v.misconductRecord === "" ? null : v.misconductRecord,
      misconductDetails: v.misconductDetails,
      certificationName: v.certificationName,
      certificationDate: v.certificationDate,
      consent: v.consent as true,
      spouse: showSpouse ? v.spouse : null,
      children: v.children,
      familyContacts: v.familyContacts,
      emergencyContacts: v.emergencyContacts,
      relativesEmployed: v.relativesEmployed,
      qualifications: v.qualifications,
      employmentHistory: v.employmentHistory,
      references: v.references,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = await saveMyBioAction(buildPayload());
      if (result.ok) {
        setJustSaved(true);
        setSaved(
          new Date().toLocaleDateString(locale === "sw" ? "sw-TZ" : "en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        );
        // Refresh RSC so a hard reload shows the persisted state.
        router.refresh();
        if (typeof window !== "undefined") window.scrollTo({ top: 0 });
      } else if (result.code === "unauthenticated") {
        setFormError(t("errors.unauthenticated"));
      } else if (result.error) {
        setFieldErrors(result.error.error.fieldErrors ?? {});
        setFormError(t("errors.fixFields"));
        if (typeof window !== "undefined") window.scrollTo({ top: 0 });
      } else {
        setFormError(t("errors.generic"));
      }
    });
  }

  /* ---- small field helpers (translate error keys returned by Zod) ---- */

  /** Translate a server field-error key; falls back to the raw message. */
  const translateError = useMemo(
    () =>
      (msgs: string[] | undefined): string | null => {
        if (!msgs || msgs.length === 0) return null;
        const key = msgs[0]!;
        // Error keys are namespaced like "bio.errors.surnameRequired"; strip
        // the leading "bio." so the bio-scoped `t` resolves them.
        const localKey = key.startsWith("bio.") ? key.slice(4) : key;
        const translated = t(localKey);
        // If translation is missing next-intl echoes the key — show raw then.
        return translated === localKey ? key : translated;
      },
    [t],
  );

  // Dependencies the flat-field helpers need. `Text`/`Area` live at module
  // scope (stable component identity) so they are NOT remounted on every
  // keystroke — that remount was what dropped input focus after each
  // character. Passing the live state through `ctx` keeps them controlled.
  const flatCtx: FlatFieldCtx = {
    values: v,
    fieldErrors,
    translateError,
    set,
    disabled: isPending,
  };

  /* ----------------------------- render ----------------------------- */

  if (justSaved) {
    return (
      <div
        role="status"
        style={{
          textAlign: "center",
          padding: "40px 24px",
          border: "1px solid #d1e7dd",
          borderRadius: 12,
          background: "#f0fff4",
        }}
      >
        <span style={{ fontSize: 44, display: "block", marginBottom: 12 }}>
          ✅
        </span>
        <h2 style={{ color: "#198754", marginBottom: 8 }}>
          {t("status.savedTitle")}
        </h2>
        <p style={{ color: C.muted, marginBottom: 8 }}>{t("status.savedBody")}</p>
        {saved && (
          <p style={{ fontWeight: 600, marginBottom: 24 }}>
            {t("status.savedOn", { date: saved })}
          </p>
        )}
        <button
          type="button"
          onClick={() => setJustSaved(false)}
          style={primaryBtn(false)}
        >
          {t("buttons.edit")}
        </button>
      </div>
    );
  }

  return (
    <>
      {/* ── First-visit welcome modal ───────────────────────────────── */}
      {showBioWelcome && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bio-welcome-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
        >
          <div style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "2rem",
            maxWidth: "440px",
            width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            borderTop: "4px solid #f59e0b",
          }}>
            <h2 id="bio-welcome-title" style={{ fontSize: "1.2rem", color: "#003087", margin: "0 0 0.75rem" }}>
              📋 Before you begin
            </h2>
            <p style={{ color: "#374151", lineHeight: 1.65, margin: "0 0 0.75rem", fontSize: "0.95rem" }}>
              <strong>Read through the entire form before filling anything in.</strong>
            </p>
            <p style={{ color: "#4b5563", lineHeight: 1.65, margin: "0 0 1.5rem", fontSize: "0.9rem" }}>
              This is a <strong>one-time form fill</strong> — completing it unlocks your onboarding documents.
              Take your time, have your documents ready (ID, bank details, certificates), and fill every section carefully.
            </p>
            <button
              type="button"
              onClick={dismissBioWelcome}
              style={{
                width: "100%",
                padding: "0.75rem",
                background: "#003087",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              Got it — I&apos;m ready
            </button>
          </div>
        </div>
      )}

    <form onSubmit={handleSubmit} noValidate>
      {/* ── Privacy notice ─────────────────────────────────────────── */}
      <section
        aria-labelledby="privacy-heading"
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "18px 20px",
          marginBottom: 20,
          background: C.bgSubtle,
        }}
      >
        <h2 id="privacy-heading" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          🔒 {t("privacy.title")}
        </h2>
        <p style={{ margin: "8px 0", lineHeight: 1.6 }}>{t("privacy.intro")}</p>
        <ul style={{ margin: "8px 0", paddingLeft: 20, lineHeight: 1.6 }}>
          <li>{t("privacy.collected")}</li>
          <li>{t("privacy.purpose")}</li>
          <li>{t("privacy.access")}</li>
          <li>{t("privacy.security")}</li>
        </ul>
        <p style={{ margin: "8px 0 0", color: C.muted }}>
          {t("privacy.retention")}
        </p>
      </section>

      <BioPrepChecklist locale={locale} />

      {/* ── Form-level error ───────────────────────────────────────── */}
      {formError && (
        <p
          role="alert"
          style={{
            color: C.danger,
            background: "#fdecea",
            border: `1px solid ${C.danger}`,
            borderRadius: 6,
            padding: "10px 14px",
            marginBottom: 20,
            fontWeight: 600,
          }}
        >
          {formError}
        </p>
      )}

      {/* ── Personal ───────────────────────────────────────────────── */}
      <fieldset style={sectionStyle} disabled={isPending}>
        <legend style={legendStyle}>{t("sections.personal")}</legend>
        <div style={gridStyle}>
          <Text ctx={flatCtx} name="surname" label={t("fields.surname")} required />
          <Text ctx={flatCtx} name="firstName" label={t("fields.firstName")} required />
          <Text ctx={flatCtx} name="middleName" label={t("fields.middleName")} />
          <Text ctx={flatCtx} name="otherNames" label={t("fields.otherNames")} />
          <Text ctx={flatCtx} name="maidenName" label={t("fields.maidenName")} />
          <Select
            id="f-gender"
            label={t("fields.gender")}
            required
            value={v.gender}
            onChange={(val) => set("gender", val)}
            error={translateError(fieldErrors["gender"])}
            options={[
              { value: "MALE", label: t("options.gender.MALE") },
              { value: "FEMALE", label: t("options.gender.FEMALE") },
            ]}
            placeholder={t("options.select")}
          />
          <Select
            id="f-maritalStatus"
            label={t("fields.maritalStatus")}
            required
            value={v.maritalStatus}
            onChange={(val) => set("maritalStatus", val)}
            error={translateError(fieldErrors["maritalStatus"])}
            options={(
              ["Single", "Married", "Divorced", "Widowed", "Separated"] as const
            ).map((o) => ({
              value: o,
              label: t(`options.maritalStatus.${o}`),
            }))}
            placeholder={t("options.select")}
          />
          <Text ctx={flatCtx}
            name="dateOfBirth"
            label={t("fields.dateOfBirth")}
            type="date"
          />
          <Text ctx={flatCtx} name="placeOfBirth" label={t("fields.placeOfBirth")} />
          <Text ctx={flatCtx} name="nationality" label={t("fields.nationality")} />
        </div>

        {/* Special-category: health (optional) */}
        <SensitiveBlock note={t("sensitive.healthNote")}>
          <div style={gridStyle}>
            <Select
              id="f-hasDisabilities"
              label={t("fields.hasDisabilities")}
              value={v.hasDisabilities}
              onChange={(val) =>
                set("hasDisabilities", val as BioInitialValues["hasDisabilities"])
              }
              options={[
                { value: "yes", label: t("options.yesNo.yes") },
                { value: "no", label: t("options.yesNo.no") },
              ]}
              placeholder={t("options.yesNo.unspecified")}
            />
            {v.hasDisabilities === "yes" && (
              <Area ctx={flatCtx}
                name="disabilitiesDetails"
                label={t("fields.disabilitiesDetails")}
              />
            )}
          </div>
        </SensitiveBlock>
      </fieldset>

      {/* ── Contact ────────────────────────────────────────────────── */}
      <fieldset style={sectionStyle} disabled={isPending}>
        <legend style={legendStyle}>{t("sections.contact")}</legend>
        <div style={gridStyle}>
          <Text ctx={flatCtx} name="homePhone" label={t("fields.homePhone")} />
          <Text ctx={flatCtx} name="mobilePhone" label={t("fields.mobilePhone")} required />
          <Text ctx={flatCtx} name="email" label={t("fields.email")} type="email" />
        </div>
        <div style={{ marginTop: 16 }}>
          <Area ctx={flatCtx}
            name="residentialAddress"
            label={t("fields.residentialAddress")}
            required
          />
        </div>
      </fieldset>

      {/* ── Identification documents ───────────────────────────────── */}
      <fieldset style={sectionStyle} disabled={isPending}>
        <legend style={legendStyle}>{t("sections.identification")}</legend>
        <div style={gridStyle}>
          <Text ctx={flatCtx}
            name="identificationNo"
            label={t("fields.identificationNo")}
            required
          />
          <Text ctx={flatCtx} name="idPlaceOfIssue" label={t("fields.idPlaceOfIssue")} />
          <Text ctx={flatCtx}
            name="idExpiryDate"
            label={t("fields.idExpiryDate")}
            type="date"
          />
          <Text ctx={flatCtx} name="drivingPermitNo" label={t("fields.drivingPermitNo")} />
          <Text ctx={flatCtx}
            name="drivingPlaceOfIssue"
            label={t("fields.drivingPlaceOfIssue")}
          />
          <Text ctx={flatCtx}
            name="drivingExpiryDate"
            label={t("fields.drivingExpiryDate")}
            type="date"
          />
          <Text ctx={flatCtx} name="nssfNo" label={t("fields.nssfNo")} />
          <Text ctx={flatCtx} name="tinNo" label={t("fields.tinNo")} />
          <Text ctx={flatCtx} name="nhifNo" label={t("fields.nhifNo")} />
        </div>
        <DocumentSupportLinks locale={locale} />
      </fieldset>

      {/* ── Employment ─────────────────────────────────────────────── */}
      <fieldset style={sectionStyle} disabled={isPending}>
        <legend style={legendStyle}>{t("sections.employment")}</legend>
        <div style={gridStyle}>
          <Text ctx={flatCtx} name="position" label={t("fields.position")} required />
          <Text ctx={flatCtx} name="workStation" label={t("fields.workStation")} />
        </div>
      </fieldset>

      {/* ── Banking ────────────────────────────────────────────────── */}
      <fieldset style={sectionStyle} disabled={isPending}>
        <legend style={legendStyle}>{t("sections.banking")}</legend>
        <div style={gridStyle}>
          <Text ctx={flatCtx} name="bankName" label={t("fields.bankName")} />
          <Text ctx={flatCtx} name="accountName" label={t("fields.accountName")} />
          <Text ctx={flatCtx} name="accountNumber" label={t("fields.accountNumber")} />
          <Text ctx={flatCtx}
            name="mobileMoneyNumber"
            label={t("fields.mobileMoneyNumber")}
          />
        </div>
      </fieldset>

      {/* ── Family ─────────────────────────────────────────────────── */}
      <fieldset style={sectionStyle} disabled={isPending}>
        <legend style={legendStyle}>{t("sections.family")}</legend>

        {/* Spouse (conditional on married) */}
        {showSpouse && (
          <SubGroup title={t("sections.spouse")} help={t("help.spouse")}>
            <div style={gridStyle}>
              <LabeledInput
                id="spouse-fullName"
                label={t("fields.spouseFullName")}
                value={v.spouse.fullName}
                onChange={(val) =>
                  setV((p) => ({ ...p, spouse: { ...p.spouse, fullName: val } }))
                }
                disabled={isPending}
              />
              <LabeledInput
                id="spouse-phone"
                label={t("fields.spousePhone")}
                value={v.spouse.phone}
                onChange={(val) =>
                  setV((p) => ({ ...p, spouse: { ...p.spouse, phone: val } }))
                }
                disabled={isPending}
              />
              <LabeledInput
                id="spouse-occupation"
                label={t("fields.spouseOccupation")}
                value={v.spouse.occupation}
                onChange={(val) =>
                  setV((p) => ({
                    ...p,
                    spouse: { ...p.spouse, occupation: val },
                  }))
                }
                disabled={isPending}
              />
              <LabeledInput
                id="spouse-employer"
                label={t("fields.spouseEmployer")}
                value={v.spouse.employer}
                onChange={(val) =>
                  setV((p) => ({
                    ...p,
                    spouse: { ...p.spouse, employer: val },
                  }))
                }
                disabled={isPending}
              />
            </div>
          </SubGroup>
        )}

        {/* Children[] */}
        <SubGroup title={t("sections.children")}>
          {v.children.map((c, i) => (
            <RepeatRow
              key={i}
              onRemove={() => removeRow("children", i)}
              removeLabel={t("buttons.remove")}
              disabled={isPending}
            >
              <LabeledInput
                id={`child-name-${i}`}
                label={t("fields.childFullNames")}
                value={c.fullNames}
                onChange={(val) =>
                  setRow<ChildValues>("children", i, { fullNames: val })
                }
                disabled={isPending}
              />
              <LabeledInput
                id={`child-dob-${i}`}
                type="date"
                label={t("fields.dateOfBirth")}
                value={c.dateOfBirth}
                onChange={(val) =>
                  setRow<ChildValues>("children", i, { dateOfBirth: val })
                }
                disabled={isPending}
              />
              <LabeledSelect
                id={`child-gender-${i}`}
                label={t("fields.childGender")}
                value={c.gender}
                onChange={(val) =>
                  setRow<ChildValues>("children", i, { gender: val })
                }
                placeholder={t("options.select")}
                options={[
                  { value: "MALE", label: t("options.childGender.MALE") },
                  { value: "FEMALE", label: t("options.childGender.FEMALE") },
                  { value: "Other", label: t("options.childGender.Other") },
                ]}
                disabled={isPending}
              />
              <LabeledInput
                id={`child-school-${i}`}
                label={t("fields.childSchoolEmployer")}
                value={c.schoolEmployer}
                onChange={(val) =>
                  setRow<ChildValues>("children", i, { schoolEmployer: val })
                }
                disabled={isPending}
              />
              <LabeledInput
                id={`child-contact-${i}`}
                label={t("fields.childContactNumber")}
                value={c.contactNumber}
                onChange={(val) =>
                  setRow<ChildValues>("children", i, { contactNumber: val })
                }
                disabled={isPending}
              />
            </RepeatRow>
          ))}
          <AddButton
            label={t("buttons.addChild")}
            onClick={() => addRow("children", emptyChild)}
            disabled={isPending}
          />
        </SubGroup>

        {/* Family contacts[] */}
        <SubGroup title={t("sections.familyContacts")}>
          {v.familyContacts.map((c, i) => (
            <RepeatRow
              key={i}
              onRemove={() => removeRow("familyContacts", i)}
              removeLabel={t("buttons.remove")}
              disabled={isPending}
            >
              <LabeledSelect
                id={`fc-rel-${i}`}
                label={t("fields.relationship")}
                value={c.relationship}
                onChange={(val) =>
                  setRow<FamilyContactValues>("familyContacts", i, {
                    relationship: val,
                  })
                }
                placeholder={t("options.select")}
                options={(
                  ["Father", "Mother", "Brother", "Sister", "Guardian"] as const
                ).map((o) => ({
                  value: o,
                  label: t(`options.familyRelationship.${o}`),
                }))}
                disabled={isPending}
              />
              <LabeledInput
                id={`fc-name-${i}`}
                label={t("fields.fullName")}
                value={c.fullName}
                onChange={(val) =>
                  setRow<FamilyContactValues>("familyContacts", i, {
                    fullName: val,
                  })
                }
                disabled={isPending}
              />
              <LabeledInput
                id={`fc-phone-${i}`}
                label={t("fields.phone")}
                value={c.phone}
                onChange={(val) =>
                  setRow<FamilyContactValues>("familyContacts", i, {
                    phone: val,
                  })
                }
                disabled={isPending}
              />
              <LabeledInput
                id={`fc-occupation-${i}`}
                label={t("fields.occupation")}
                value={c.occupation}
                onChange={(val) =>
                  setRow<FamilyContactValues>("familyContacts", i, {
                    occupation: val,
                  })
                }
                disabled={isPending}
              />
              <LabeledInput
                id={`fc-address-${i}`}
                label={t("fields.address")}
                value={c.address}
                onChange={(val) =>
                  setRow<FamilyContactValues>("familyContacts", i, {
                    address: val,
                  })
                }
                disabled={isPending}
              />
            </RepeatRow>
          ))}
          <AddButton
            label={t("buttons.addFamilyContact")}
            onClick={() => addRow("familyContacts", emptyFamilyContact)}
            disabled={isPending}
          />
        </SubGroup>

        {/* Emergency contacts[] */}
        <SubGroup title={t("sections.emergencyContacts")}>
          {v.emergencyContacts.map((c, i) => (
            <RepeatRow
              key={i}
              onRemove={() => removeRow("emergencyContacts", i)}
              removeLabel={t("buttons.remove")}
              disabled={isPending}
            >
              <LabeledInput
                id={`ec-name-${i}`}
                label={t("fields.fullName")}
                value={c.fullName}
                onChange={(val) =>
                  setRow<EmergencyContactValues>("emergencyContacts", i, {
                    fullName: val,
                  })
                }
                disabled={isPending}
              />
              <LabeledInput
                id={`ec-rel-${i}`}
                label={t("fields.relationship")}
                value={c.relationship}
                onChange={(val) =>
                  setRow<EmergencyContactValues>("emergencyContacts", i, {
                    relationship: val,
                  })
                }
                disabled={isPending}
              />
              <LabeledInput
                id={`ec-phone-${i}`}
                label={t("fields.phone")}
                value={c.phone}
                onChange={(val) =>
                  setRow<EmergencyContactValues>("emergencyContacts", i, {
                    phone: val,
                  })
                }
                disabled={isPending}
              />
              <LabeledSelect
                id={`ec-priority-${i}`}
                label={t("fields.priority")}
                value={c.priority}
                onChange={(val) =>
                  setRow<EmergencyContactValues>("emergencyContacts", i, {
                    priority: val,
                  })
                }
                placeholder={t("options.select")}
                options={[
                  { value: "Primary", label: t("options.priority.Primary") },
                  {
                    value: "Secondary",
                    label: t("options.priority.Secondary"),
                  },
                ]}
                disabled={isPending}
              />
              <LabeledInput
                id={`ec-address-${i}`}
                label={t("fields.address")}
                value={c.address}
                onChange={(val) =>
                  setRow<EmergencyContactValues>("emergencyContacts", i, {
                    address: val,
                  })
                }
                disabled={isPending}
              />
            </RepeatRow>
          ))}
          <AddButton
            label={t("buttons.addEmergencyContact")}
            onClick={() => addRow("emergencyContacts", emptyEmergencyContact)}
            disabled={isPending}
          />
        </SubGroup>

        {/* Relatives employed[] */}
        <SubGroup
          title={t("sections.relativesEmployed")}
          help={t("help.relativesEmployed")}
        >
          {v.relativesEmployed.map((c, i) => (
            <RepeatRow
              key={i}
              onRemove={() => removeRow("relativesEmployed", i)}
              removeLabel={t("buttons.remove")}
              disabled={isPending}
            >
              <LabeledInput
                id={`rel-name-${i}`}
                label={t("fields.fullName")}
                value={c.fullName}
                onChange={(val) =>
                  setRow<RelativeValues>("relativesEmployed", i, {
                    fullName: val,
                  })
                }
                disabled={isPending}
              />
              <LabeledInput
                id={`rel-rel-${i}`}
                label={t("fields.relationship")}
                value={c.relationship}
                onChange={(val) =>
                  setRow<RelativeValues>("relativesEmployed", i, {
                    relationship: val,
                  })
                }
                disabled={isPending}
              />
              <LabeledInput
                id={`rel-pos-${i}`}
                label={t("fields.position")}
                value={c.position}
                onChange={(val) =>
                  setRow<RelativeValues>("relativesEmployed", i, {
                    position: val,
                  })
                }
                disabled={isPending}
              />
              <LabeledInput
                id={`rel-ws-${i}`}
                label={t("fields.workStation")}
                value={c.workStation}
                onChange={(val) =>
                  setRow<RelativeValues>("relativesEmployed", i, {
                    workStation: val,
                  })
                }
                disabled={isPending}
              />
            </RepeatRow>
          ))}
          <AddButton
            label={t("buttons.addRelative")}
            onClick={() => addRow("relativesEmployed", emptyRelative)}
            disabled={isPending}
          />
        </SubGroup>
      </fieldset>

      {/* ── Qualifications[] ───────────────────────────────────────── */}
      <fieldset style={sectionStyle} disabled={isPending}>
        <legend style={legendStyle}>{t("sections.qualifications")}</legend>
        {v.qualifications.map((c, i) => (
          <RepeatRow
            key={i}
            onRemove={() => removeRow("qualifications", i)}
            removeLabel={t("buttons.remove")}
            disabled={isPending}
          >
            <LabeledSelect
              id={`qual-level-${i}`}
              label={t("fields.level")}
              value={c.level}
              onChange={(val) =>
                setRow<QualificationValues>("qualifications", i, { level: val })
              }
              placeholder={t("options.select")}
              options={(
                ["Certificate", "Diploma", "Degree", "Masters", "PhD"] as const
              ).map((o) => ({ value: o, label: t(`options.level.${o}`) }))}
              disabled={isPending}
            />
            <LabeledInput
              id={`qual-name-${i}`}
              label={t("fields.qualification")}
              value={c.qualification}
              onChange={(val) =>
                setRow<QualificationValues>("qualifications", i, {
                  qualification: val,
                })
              }
              disabled={isPending}
            />
            <LabeledInput
              id={`qual-inst-${i}`}
              label={t("fields.institution")}
              value={c.institution}
              onChange={(val) =>
                setRow<QualificationValues>("qualifications", i, {
                  institution: val,
                })
              }
              disabled={isPending}
            />
            <LabeledInput
              id={`qual-year-${i}`}
              type="number"
              label={t("fields.yearObtained")}
              value={c.yearObtained}
              onChange={(val) =>
                setRow<QualificationValues>("qualifications", i, {
                  yearObtained: val,
                })
              }
              disabled={isPending}
            />
            <QualDocUpload
              qualIndex={i}
              initialDocuments={initialQualDocuments[String(i)] ?? []}
            />
          </RepeatRow>
        ))}
        <AddButton
          label={t("buttons.addQualification")}
          onClick={() => addRow("qualifications", emptyQualification)}
          disabled={isPending}
        />
      </fieldset>

      {/* ── Employment history[] ───────────────────────────────────── */}
      <fieldset style={sectionStyle} disabled={isPending}>
        <legend style={legendStyle}>{t("sections.employmentHistory")}</legend>
        {v.employmentHistory.map((c, i) => (
          <RepeatRow
            key={i}
            onRemove={() => removeRow("employmentHistory", i)}
            removeLabel={t("buttons.remove")}
            disabled={isPending}
          >
            <LabeledInput
              id={`emp-employer-${i}`}
              label={t("fields.employer")}
              value={c.employer}
              onChange={(val) =>
                setRow<EmploymentValues>("employmentHistory", i, {
                  employer: val,
                })
              }
              disabled={isPending}
            />
            <LabeledInput
              id={`emp-position-${i}`}
              label={t("fields.position")}
              value={c.position}
              onChange={(val) =>
                setRow<EmploymentValues>("employmentHistory", i, {
                  position: val,
                })
              }
              disabled={isPending}
            />
            <LabeledInput
              id={`emp-from-${i}`}
              type="date"
              label={t("fields.dateFrom")}
              value={c.dateFrom}
              onChange={(val) =>
                setRow<EmploymentValues>("employmentHistory", i, {
                  dateFrom: val,
                })
              }
              disabled={isPending}
            />
            <LabeledInput
              id={`emp-to-${i}`}
              type="date"
              label={t("fields.dateTo")}
              value={c.dateTo}
              onChange={(val) =>
                setRow<EmploymentValues>("employmentHistory", i, {
                  dateTo: val,
                })
              }
              disabled={isPending}
            />
            <LabeledInput
              id={`emp-reason-${i}`}
              label={t("fields.leavingReason")}
              value={c.leavingReason}
              onChange={(val) =>
                setRow<EmploymentValues>("employmentHistory", i, {
                  leavingReason: val,
                })
              }
              disabled={isPending}
            />
          </RepeatRow>
        ))}
        <AddButton
          label={t("buttons.addEmployment")}
          onClick={() => addRow("employmentHistory", emptyEmployment)}
          disabled={isPending}
        />
      </fieldset>

      {/* ── Curriculum Vitae ───────────────────────────────────────── */}
      <fieldset style={sectionStyle} disabled={isPending}>
        <legend style={legendStyle}>Curriculum Vitae (CV)</legend>
        <CvUpload
          initialDocuments={initialCvDocuments}
        />
      </fieldset>

      {/* ── References (fixed 3) ───────────────────────────────────── */}
      <fieldset style={sectionStyle} disabled={isPending}>
        <legend style={legendStyle}>{t("sections.references")}</legend>
        <p style={{ color: C.muted, marginTop: 0 }}>{t("help.references")}</p>
        {v.references.map((r, i) => (
          <div
            key={r.referenceOrder}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <strong style={{ display: "block", marginBottom: 10 }}>
              {t("referenceLabel", { n: r.referenceOrder })}
            </strong>
            <div style={gridStyle}>
              <LabeledInput
                id={`ref-name-${i}`}
                label={t("fields.referenceName")}
                value={r.fullName}
                onChange={(val) =>
                  setRow<ReferenceValues>("references", i, { fullName: val })
                }
                disabled={isPending}
              />
              <LabeledInput
                id={`ref-rel-${i}`}
                label={t("fields.referenceRelationship")}
                value={r.relationship}
                onChange={(val) =>
                  setRow<ReferenceValues>("references", i, {
                    relationship: val,
                  })
                }
                disabled={isPending}
              />
              <LabeledInput
                id={`ref-phone-${i}`}
                label={t("fields.referencePhone")}
                value={r.phone}
                onChange={(val) =>
                  setRow<ReferenceValues>("references", i, { phone: val })
                }
                disabled={isPending}
              />
              <LabeledInput
                id={`ref-email-${i}`}
                type="email"
                label={t("fields.referenceEmail")}
                value={r.email}
                onChange={(val) =>
                  setRow<ReferenceValues>("references", i, { email: val })
                }
                disabled={isPending}
              />
              <LabeledInput
                id={`ref-org-${i}`}
                label={t("fields.referenceOrganization")}
                value={r.organization}
                onChange={(val) =>
                  setRow<ReferenceValues>("references", i, {
                    organization: val,
                  })
                }
                disabled={isPending}
              />
            </div>
          </div>
        ))}
      </fieldset>

      {/* ── Declaration + special-category criminal + consent ──────── */}
      <fieldset style={sectionStyle} disabled={isPending}>
        <legend style={legendStyle}>{t("sections.declaration")}</legend>

        {/* Special-category: criminal history (optional) */}
        <SensitiveBlock note={t("sensitive.criminalNote")}>
          <div style={gridStyle}>
            <Select
              id="f-arrestRecord"
              label={t("fields.arrestRecord")}
              value={v.arrestRecord}
              onChange={(val) =>
                set("arrestRecord", val as BioInitialValues["arrestRecord"])
              }
              options={[
                { value: "yes", label: t("options.yesNo.yes") },
                { value: "no", label: t("options.yesNo.no") },
              ]}
              placeholder={t("options.yesNo.unspecified")}
            />
            {v.arrestRecord === "yes" && (
              <Area ctx={flatCtx} name="arrestDetails" label={t("fields.arrestDetails")} />
            )}
            <Select
              id="f-misconductRecord"
              label={t("fields.misconductRecord")}
              value={v.misconductRecord}
              onChange={(val) =>
                set(
                  "misconductRecord",
                  val as BioInitialValues["misconductRecord"],
                )
              }
              options={[
                { value: "yes", label: t("options.yesNo.yes") },
                { value: "no", label: t("options.yesNo.no") },
              ]}
              placeholder={t("options.yesNo.unspecified")}
            />
            {v.misconductRecord === "yes" && (
              <Area ctx={flatCtx}
                name="misconductDetails"
                label={t("fields.misconductDetails")}
              />
            )}
          </div>
        </SensitiveBlock>

        <div style={{ ...gridStyle, marginTop: 16 }}>
          <Text ctx={flatCtx}
            name="certificationName"
            label={t("fields.certificationName")}
          />
          <Text ctx={flatCtx}
            name="certificationDate"
            label={t("fields.certificationDate")}
            type="date"
          />
        </div>

        {/* Consent (required) */}
        <div
          style={{
            marginTop: 20,
            padding: "16px 18px",
            border: `2px solid ${
              translateError(fieldErrors["consent"]) ? C.danger : C.primary
            }`,
            borderRadius: 8,
            background: "#f5f9ff",
          }}
        >
          <strong style={{ display: "block", marginBottom: 8 }}>
            {t("consent.heading")}
          </strong>
          <label
            htmlFor="f-consent"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              cursor: "pointer",
              lineHeight: 1.5,
            }}
          >
            <input
              id="f-consent"
              type="checkbox"
              checked={v.consent}
              onChange={(e) => set("consent", e.target.checked)}
              disabled={isPending}
              aria-required="true"
              aria-invalid={
                translateError(fieldErrors["consent"]) ? true : undefined
              }
              aria-describedby={
                translateError(fieldErrors["consent"])
                  ? "consent-err"
                  : "consent-note"
              }
              style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
            />
            <span>{t("consent.label")}</span>
          </label>
          <p id="consent-note" style={{ margin: "8px 0 0", color: C.muted }}>
            {t("consent.recordedNote")}
          </p>
          {translateError(fieldErrors["consent"]) && (
            <p
              id="consent-err"
              role="alert"
              style={{ color: C.danger, margin: "8px 0 0", fontWeight: 600 }}
            >
              {translateError(fieldErrors["consent"])}
            </p>
          )}
        </div>
      </fieldset>

      {/* ── Submit ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button type="submit" disabled={isPending} style={primaryBtn(isPending)}>
          {isPending ? t("buttons.submitting") : t("buttons.submit")}
        </button>
        {saved && (
          <span style={{ color: C.muted }}>
            {t("status.savedOn", { date: saved })}
          </span>
        )}
      </div>
    </form>
    </>
  );
}

/* ================================================================== */
/* Presentational helpers                                             */
/* ================================================================== */

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "12px 32px",
    minHeight: 44, // touch-friendly submit/primary action on mobile
    background: disabled ? "#6c757d" : "#0d6efd",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: "1rem",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontWeight: 600,
  fontSize: "0.9rem",
};

function Field(props: {
  id: string;
  label: string;
  required?: boolean;
  error?: string | null;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={props.id} style={labelStyle}>
        {props.label}
        {props.required && (
          <span style={{ color: C.danger }} aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {props.children}
      {props.help && (
        <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: C.muted }}>
          {props.help}
        </p>
      )}
      {props.error && (
        <p
          id={`${props.id}-err`}
          role="alert"
          style={{ margin: "4px 0 0", color: C.danger, fontSize: "0.85rem" }}
        >
          {props.error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Flat-field helpers — MODULE SCOPE so their component identity is     */
/* stable across renders. Defining these inside BioForm remounted the   */
/* <input> on every keystroke, which is why focus was lost per letter.  */
/* ------------------------------------------------------------------ */

interface FlatFieldCtx {
  values: BioInitialValues;
  fieldErrors: Record<string, string[]>;
  translateError: (msgs: string[] | undefined) => string | null;
  set: <K extends keyof BioInitialValues>(
    key: K,
    value: BioInitialValues[K],
  ) => void;
  disabled: boolean;
}

function Text(props: {
  ctx: FlatFieldCtx;
  name: keyof BioInitialValues;
  label: string;
  required?: boolean;
  type?: string;
  help?: string;
}) {
  const { ctx } = props;
  const err = ctx.translateError(ctx.fieldErrors[props.name as string]);
  const id = `f-${String(props.name)}`;
  return (
    <Field
      id={id}
      label={props.label}
      required={props.required}
      error={err}
      help={props.help}
    >
      <input
        id={id}
        type={props.type ?? "text"}
        value={String(ctx.values[props.name] ?? "")}
        onChange={(e) => ctx.set(props.name, e.target.value as never)}
        disabled={ctx.disabled}
        aria-required={props.required ? true : undefined}
        aria-invalid={err ? true : undefined}
        aria-describedby={err ? `${id}-err` : undefined}
        style={inputStyle}
      />
    </Field>
  );
}

function Area(props: {
  ctx: FlatFieldCtx;
  name: keyof BioInitialValues;
  label: string;
  required?: boolean;
}) {
  const { ctx } = props;
  const err = ctx.translateError(ctx.fieldErrors[props.name as string]);
  const id = `f-${String(props.name)}`;
  return (
    <Field id={id} label={props.label} required={props.required} error={err}>
      <textarea
        id={id}
        value={String(ctx.values[props.name] ?? "")}
        onChange={(e) => ctx.set(props.name, e.target.value as never)}
        disabled={ctx.disabled}
        rows={3}
        aria-required={props.required ? true : undefined}
        aria-invalid={err ? true : undefined}
        aria-describedby={err ? `${id}-err` : undefined}
        style={{ ...inputStyle, resize: "vertical" }}
      />
    </Field>
  );
}

function LabeledInput(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <Field id={props.id} label={props.label}>
      <input
        id={props.id}
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
        style={inputStyle}
      />
    </Field>
  );
}

function Select(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  error?: string | null;
}) {
  return (
    <Field
      id={props.id}
      label={props.label}
      required={props.required}
      error={props.error}
    >
      <select
        id={props.id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        aria-required={props.required ? true : undefined}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error ? `${props.id}-err` : undefined}
        style={inputStyle}
      >
        <option value="">{props.placeholder ?? ""}</option>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function LabeledSelect(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Field id={props.id} label={props.label}>
      <select
        id={props.id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
        style={inputStyle}
      >
        <option value="">{props.placeholder ?? ""}</option>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** A bordered sub-group inside a fieldset (e.g. Spouse, Children). */
function SubGroup(props: {
  title: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ fontSize: "1rem", margin: "0 0 4px" }}>{props.title}</h3>
      {props.help && (
        <p style={{ margin: "0 0 10px", color: C.muted, fontSize: "0.85rem" }}>
          {props.help}
        </p>
      )}
      {props.children}
    </div>
  );
}

/** One removable row in a repeating group. */
function RepeatRow(props: {
  children: ReactNode;
  onRemove: () => void;
  removeLabel: string;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        border: `1px dashed ${C.border}`,
        borderRadius: 8,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <div style={gridStyle}>{props.children}</div>
      <button
        type="button"
        onClick={props.onRemove}
        disabled={props.disabled}
        style={{
          marginTop: 10,
          padding: "6px 14px",
          minHeight: 44, // touch-friendly "remove row" control on mobile
          background: "transparent",
          color: C.danger,
          border: `1px solid ${C.danger}`,
          borderRadius: 6,
          cursor: props.disabled ? "not-allowed" : "pointer",
          fontSize: "0.85rem",
        }}
      >
        {props.removeLabel}
      </button>
    </div>
  );
}

function AddButton(props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        padding: "8px 16px",
        minHeight: 44, // touch-friendly "add row" control on mobile
        background: "#e7f1ff",
        color: "#0b5ed7",
        border: "1px solid #b6d4fe",
        borderRadius: 6,
        cursor: props.disabled ? "not-allowed" : "pointer",
        fontWeight: 600,
        fontSize: "0.9rem",
      }}
    >
      + {props.label}
    </button>
  );
}

/** Wrapper that visually flags optional special-category (GDPR Art. 9) data. */
function SensitiveBlock(props: { note: string; children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: 18,
        padding: "14px 16px",
        background: C.sensitive,
        border: `1px solid ${C.sensitiveBorder}`,
        borderRadius: 8,
      }}
    >
      <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "#7a5b00" }}>
        ⚠ {props.note}
      </p>
      {props.children}
    </div>
  );
}
