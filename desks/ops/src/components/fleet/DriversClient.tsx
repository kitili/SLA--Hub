"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Driver, DriverWithPhotoUrls } from "@/lib/db/drivers";
import { buildDriverCompliance } from "@/lib/compliance/driver-compliance";
import { COMPLIANCE_STATUS_STYLES, SEVERITY_ORDER } from "@/lib/compliance/expiry-check";
import { docCompletionPercent } from "@/lib/compliance/tz-driver-docs";
import {
  uploadDriverDocument,
  type DriverDocSlot,
} from "@/lib/storage/driver-documents";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { DriverBulkProvision } from "@/components/fleet/DriverBulkProvision";
import { suggestDriverEmail } from "@/lib/driver/provision";

type Props = {
  initialDrivers: DriverWithPhotoUrls[];
};

const STATUS_STYLES = COMPLIANCE_STATUS_STYLES;

function ComplianceBadgeRow({ driver }: { driver: Driver }) {
  const { checks } = buildDriverCompliance(driver);
  const filePct = docCompletionPercent(driver);
  const flagged = Object.values(checks)
    .filter((check) => check.status !== "ok")
    .sort((a, b) => SEVERITY_ORDER[a.status] - SEVERITY_ORDER[b.status]);

  if (flagged.length === 0) {
    return (
      <span className="inline-block rounded-[var(--radius-sm)] px-2 py-1 text-xs font-semibold bg-success-15 text-success">
        Compliance OK · file {filePct}%
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="inline-block rounded-[var(--radius-sm)] bg-light-blue-30 px-2 py-0.5 text-[0.65rem] font-bold text-electric-blue">
        TZ file {filePct}%
      </span>
      {flagged.slice(0, 4).map((check) => (
        <span
          key={check.note}
          className={`inline-block rounded-[var(--radius-sm)] px-2 py-1 text-xs font-semibold ${STATUS_STYLES[check.status]}`}
        >
          {check.note}
        </span>
      ))}
      {flagged.length > 4 ? (
        <span className="text-xs text-ink-faint">+{flagged.length - 4}</span>
      ) : null}
    </div>
  );
}

type FieldsetProps = {
  heading: string;
  children: React.ReactNode;
};

function FieldsetGroup({ heading, children }: FieldsetProps) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {heading}
      </legend>
      <div className="mt-2 flex flex-wrap gap-3">{children}</div>
    </fieldset>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date";
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
      <span className="font-semibold text-ink">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

function FileField({
  label,
  driverId,
  slot,
  hasFile,
  signedUrl,
  accept = "image/jpeg,image/png,image/webp,application/pdf",
  onUploaded,
  onDeleted,
}: {
  label: string;
  driverId: string;
  slot: DriverDocSlot;
  hasFile: boolean;
  signedUrl: string | null;
  accept?: string;
  onUploaded: (path: string) => void;
  onDeleted?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ok = await confirm({
      title: "Upload document?",
      message: `Upload "${file.name}" as this driver's ${label}?`,
      confirmLabel: "Upload",
    });
    if (!ok) return;
    setError(null);
    setUploading(true);
    const result = await uploadDriverDocument(driverId, slot, file);
    setUploading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onUploaded(result.path);
  }

  async function onDeleteClick() {
    if (!onDeleted) return;
    const ok = await confirm({
      title: "Delete document?",
      message: `Delete this driver's ${label}? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setError(null);
    setUploading(true);
    const { deleteDriverDocumentFiles } = await import(
      "@/lib/storage/driver-documents"
    );
    const result = await deleteDriverDocumentFiles(driverId, slot);
    setUploading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onDeleted();
  }

  return (
    <div className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
      <span className="font-semibold text-ink">{label}</span>
      {signedUrl ? (
        <a
          href={signedUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-electric-blue hover:underline"
        >
          View current file
        </a>
      ) : hasFile ? (
        <span className="text-xs text-ink-faint">On file</span>
      ) : (
        <span className="text-xs text-ink-faint">No file uploaded</span>
      )}
      <input
        type="file"
        accept={accept}
        onChange={(e) => void onFileChange(e)}
        disabled={uploading}
        className="text-xs"
      />
      {hasFile && onDeleted ? (
        <button
          type="button"
          disabled={uploading}
          onClick={() => void onDeleteClick()}
          className="self-start text-xs font-semibold text-danger hover:underline disabled:opacity-50"
        >
          Delete file
        </button>
      ) : null}
      {uploading ? <span className="text-xs text-ink-faint">Working…</span> : null}
      {error ? <span className="text-xs font-semibold text-danger">{error}</span> : null}
      {dialog}
    </div>
  );
}

type DriverFormValues = {
  name: string;
  phone: string;
  licenseNumber: string;
  licenseClass: string;
  licenseExpiry: string;
  psvPermitNumber: string;
  psvPermitExpiry: string;
  firstAidCertExpiry: string;
  personalInsuranceExpiry: string;
  medicalExamDate: string;
  medicalCertExpiry: string;
  policeClearanceDate: string;
  childSafetyTrainingDate: string;
  defensiveDrivingTrainingDate: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  nextOfKinRelationship: string;
  photoUrl: string;
  nationalIdNumber: string;
  nationalIdPhotoUrl: string;
  passportNumber: string;
  passportPhotoUrl: string;
  cvUrl: string;
  licensePhotoUrl: string;
  psvBadgePhotoUrl: string;
  medicalCertPhotoUrl: string;
};

const EMPTY_FORM: DriverFormValues = {
  name: "",
  phone: "",
  licenseNumber: "",
  licenseClass: "",
  licenseExpiry: "",
  psvPermitNumber: "",
  psvPermitExpiry: "",
  firstAidCertExpiry: "",
  personalInsuranceExpiry: "",
  medicalExamDate: "",
  medicalCertExpiry: "",
  policeClearanceDate: "",
  childSafetyTrainingDate: "",
  defensiveDrivingTrainingDate: "",
  nextOfKinName: "",
  nextOfKinPhone: "",
  nextOfKinRelationship: "",
  photoUrl: "",
  nationalIdNumber: "",
  nationalIdPhotoUrl: "",
  passportNumber: "",
  passportPhotoUrl: "",
  cvUrl: "",
  licensePhotoUrl: "",
  psvBadgePhotoUrl: "",
  medicalCertPhotoUrl: "",
};

function driverToFormValues(driver: Driver): DriverFormValues {
  return {
    name: driver.name,
    phone: driver.phone ?? "",
    licenseNumber: driver.license_number ?? "",
    licenseClass: driver.license_class ?? "",
    licenseExpiry: driver.license_expiry ?? "",
    psvPermitNumber: driver.psv_permit_number ?? "",
    psvPermitExpiry: driver.psv_permit_expiry ?? "",
    firstAidCertExpiry: driver.first_aid_cert_expiry ?? "",
    personalInsuranceExpiry: driver.personal_insurance_expiry ?? "",
    medicalExamDate: driver.medical_exam_date ?? "",
    medicalCertExpiry: driver.medical_cert_expiry ?? "",
    policeClearanceDate: driver.police_clearance_date ?? "",
    childSafetyTrainingDate: driver.child_safety_training_date ?? "",
    defensiveDrivingTrainingDate: driver.defensive_driving_training_date ?? "",
    nextOfKinName: driver.next_of_kin_name ?? "",
    nextOfKinPhone: driver.next_of_kin_phone ?? "",
    nextOfKinRelationship: driver.next_of_kin_relationship ?? "",
    photoUrl: driver.photo_url ?? "",
    nationalIdNumber: driver.national_id_number ?? "",
    nationalIdPhotoUrl: driver.national_id_photo_url ?? "",
    passportNumber: driver.passport_number ?? "",
    passportPhotoUrl: driver.passport_photo_url ?? "",
    cvUrl: driver.cv_url ?? "",
    licensePhotoUrl: driver.license_photo_url ?? "",
    psvBadgePhotoUrl: driver.psv_badge_photo_url ?? "",
    medicalCertPhotoUrl: driver.medical_cert_photo_url ?? "",
  };
}

function formValuesToBody(values: DriverFormValues, blankAs: null | undefined) {
  const clean = (v: string) => v.trim() || blankAs;
  return {
    name: values.name.trim(),
    phone: clean(values.phone),
    licenseNumber: clean(values.licenseNumber),
    licenseClass: clean(values.licenseClass),
    licenseExpiry: clean(values.licenseExpiry),
    psvPermitNumber: clean(values.psvPermitNumber),
    psvPermitExpiry: clean(values.psvPermitExpiry),
    firstAidCertExpiry: clean(values.firstAidCertExpiry),
    personalInsuranceExpiry: clean(values.personalInsuranceExpiry),
    medicalExamDate: clean(values.medicalExamDate),
    medicalCertExpiry: clean(values.medicalCertExpiry),
    policeClearanceDate: clean(values.policeClearanceDate),
    childSafetyTrainingDate: clean(values.childSafetyTrainingDate),
    defensiveDrivingTrainingDate: clean(values.defensiveDrivingTrainingDate),
    nextOfKinName: clean(values.nextOfKinName),
    nextOfKinPhone: clean(values.nextOfKinPhone),
    nextOfKinRelationship: clean(values.nextOfKinRelationship),
    photoUrl: clean(values.photoUrl),
    nationalIdNumber: clean(values.nationalIdNumber),
    nationalIdPhotoUrl: clean(values.nationalIdPhotoUrl),
    passportNumber: clean(values.passportNumber),
    passportPhotoUrl: clean(values.passportPhotoUrl),
    cvUrl: clean(values.cvUrl),
    licensePhotoUrl: clean(values.licensePhotoUrl),
    psvBadgePhotoUrl: clean(values.psvBadgePhotoUrl),
    medicalCertPhotoUrl: clean(values.medicalCertPhotoUrl),
  };
}

function DriverFieldGroups({
  values,
  onChange,
  driverId,
  signedUrls,
}: {
  values: DriverFormValues;
  onChange: (patch: Partial<DriverFormValues>) => void;
  /** Documents section only renders when a real driver id exists (edit form
   * only) -- a brand-new driver has no id to namespace an upload path under. */
  driverId?: string;
  signedUrls?: {
    photo: string | null;
    nationalId: string | null;
    passport: string | null;
    cv: string | null;
    license: string | null;
    psvBadge: string | null;
    medical: string | null;
  };
}) {
  const set = <K extends keyof DriverFormValues>(key: K) => (value: string) =>
    onChange({ [key]: value } as Partial<DriverFormValues>);

  return (
    <div className="flex flex-col gap-4">
      <FieldsetGroup heading="Identity">
        <TextField label="Name" value={values.name} onChange={set("name")} required />
        <TextField label="Phone" value={values.phone} onChange={set("phone")} />
        <TextField
          label="License number"
          value={values.licenseNumber}
          onChange={set("licenseNumber")}
        />
        <TextField
          label="License class"
          value={values.licenseClass}
          onChange={set("licenseClass")}
          placeholder="e.g. Class C (PSV)"
        />
        <TextField
          label="License expiry"
          type="date"
          value={values.licenseExpiry}
          onChange={set("licenseExpiry")}
        />
      </FieldsetGroup>

      <FieldsetGroup heading="PSV & health compliance">
        <TextField
          label="PSV permit number"
          value={values.psvPermitNumber}
          onChange={set("psvPermitNumber")}
        />
        <TextField
          label="PSV permit expiry"
          type="date"
          value={values.psvPermitExpiry}
          onChange={set("psvPermitExpiry")}
        />
        <TextField
          label="First aid cert expiry"
          type="date"
          value={values.firstAidCertExpiry}
          onChange={set("firstAidCertExpiry")}
        />
        <TextField
          label="Personal insurance expiry"
          type="date"
          value={values.personalInsuranceExpiry}
          onChange={set("personalInsuranceExpiry")}
        />
        <TextField
          label="Medical exam date"
          type="date"
          value={values.medicalExamDate}
          onChange={set("medicalExamDate")}
        />
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <TextField
            label="Medical cert expiry"
            type="date"
            value={values.medicalCertExpiry}
            onChange={set("medicalCertExpiry")}
          />
          <span className="text-xs text-ink-faint">
            Optional — only set if a fixed re-certification date is known
          </span>
        </div>
      </FieldsetGroup>

      <FieldsetGroup heading="Training & clearance (on file)">
        <TextField
          label="Police clearance date"
          type="date"
          value={values.policeClearanceDate}
          onChange={set("policeClearanceDate")}
        />
        <TextField
          label="Child safety training date"
          type="date"
          value={values.childSafetyTrainingDate}
          onChange={set("childSafetyTrainingDate")}
        />
        <TextField
          label="Defensive driving training date"
          type="date"
          value={values.defensiveDrivingTrainingDate}
          onChange={set("defensiveDrivingTrainingDate")}
        />
      </FieldsetGroup>

      <FieldsetGroup heading="Next of kin">
        <TextField
          label="Next of kin name"
          value={values.nextOfKinName}
          onChange={set("nextOfKinName")}
        />
        <TextField
          label="Next of kin phone"
          value={values.nextOfKinPhone}
          onChange={set("nextOfKinPhone")}
        />
        <TextField
          label="Next of kin relationship"
          value={values.nextOfKinRelationship}
          onChange={set("nextOfKinRelationship")}
          placeholder="e.g. Spouse, Parent"
        />
      </FieldsetGroup>

      {driverId ? (
        <FieldsetGroup heading="Documents (TZ driver file)">
          <FileField
            label="Portrait photo"
            driverId={driverId}
            slot="photo"
            accept="image/jpeg,image/png,image/webp"
            hasFile={Boolean(values.photoUrl)}
            signedUrl={signedUrls?.photo ?? null}
            onUploaded={(path) => onChange({ photoUrl: path })}
            onDeleted={() => onChange({ photoUrl: "" })}
          />
          <FileField
            label="CV / résumé"
            driverId={driverId}
            slot="cv"
            hasFile={Boolean(values.cvUrl)}
            signedUrl={signedUrls?.cv ?? null}
            onUploaded={(path) => onChange({ cvUrl: path })}
            onDeleted={() => onChange({ cvUrl: "" })}
          />
          <FileField
            label="Driving licence scan"
            driverId={driverId}
            slot="license"
            hasFile={Boolean(values.licensePhotoUrl)}
            signedUrl={signedUrls?.license ?? null}
            onUploaded={(path) => onChange({ licensePhotoUrl: path })}
            onDeleted={() => onChange({ licensePhotoUrl: "" })}
          />
          <FileField
            label="PSV badge / permit"
            driverId={driverId}
            slot="psv-badge"
            hasFile={Boolean(values.psvBadgePhotoUrl)}
            signedUrl={signedUrls?.psvBadge ?? null}
            onUploaded={(path) => onChange({ psvBadgePhotoUrl: path })}
            onDeleted={() => onChange({ psvBadgePhotoUrl: "" })}
          />
          <FileField
            label="Medical certificate"
            driverId={driverId}
            slot="medical"
            hasFile={Boolean(values.medicalCertPhotoUrl)}
            signedUrl={signedUrls?.medical ?? null}
            onUploaded={(path) => onChange({ medicalCertPhotoUrl: path })}
            onDeleted={() => onChange({ medicalCertPhotoUrl: "" })}
          />
          <TextField
            label="National ID number"
            value={values.nationalIdNumber}
            onChange={set("nationalIdNumber")}
          />
          <FileField
            label="National ID photo"
            driverId={driverId}
            slot="national-id"
            hasFile={Boolean(values.nationalIdPhotoUrl)}
            signedUrl={signedUrls?.nationalId ?? null}
            onUploaded={(path) => onChange({ nationalIdPhotoUrl: path })}
            onDeleted={() => onChange({ nationalIdPhotoUrl: "" })}
          />
          <TextField
            label="Passport number"
            value={values.passportNumber}
            onChange={set("passportNumber")}
          />
          <FileField
            label="Passport photo"
            driverId={driverId}
            slot="passport"
            hasFile={Boolean(values.passportPhotoUrl)}
            signedUrl={signedUrls?.passport ?? null}
            onUploaded={(path) => onChange({ passportPhotoUrl: path })}
            onDeleted={() => onChange({ passportPhotoUrl: "" })}
          />
        </FieldsetGroup>
      ) : null}
    </div>
  );
}

export function DriversClient({ initialDrivers }: Props) {
  const router = useRouter();
  const [drivers, setDrivers] = useState(initialDrivers);
  const { confirm, dialog } = useConfirm();

  // --- Add driver ---
  const [form, setForm] = useState<DriverFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // --- Inline edit ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DriverFormValues>(EMPTY_FORM);
  const [rowSaving, setRowSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [linkEmailById, setLinkEmailById] = useState<Record<string, string>>(
    {},
  );
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [linkMsgById, setLinkMsgById] = useState<
    Record<string, { ok: boolean; text: string }>
  >({});

  function startEdit(driver: DriverWithPhotoUrls) {
    setEditingId(driver.id);
    setEditForm(driverToFormValues(driver));
    setRowError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    if (!form.name.trim()) {
      setError("Driver name is required");
      return;
    }
    const ok = await confirm({
      title: "Add driver?",
      message: `Add "${form.name.trim()}" as a new driver?`,
      confirmLabel: "Add driver",
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValuesToBody(form, undefined)),
      });
      const data = (await res.json()) as { driver?: Driver; error?: string };
      if (!res.ok || !data.driver) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      // A brand-new driver has no documents yet -- no signed urls to resolve.
      const newDriver: DriverWithPhotoUrls = {
        ...data.driver,
        photo_signed_url: null,
        national_id_photo_signed_url: null,
        passport_photo_signed_url: null,
        cv_signed_url: null,
        license_photo_signed_url: null,
        psv_badge_photo_signed_url: null,
        medical_cert_photo_signed_url: null,
      };
      setDrivers((prev) =>
        [...prev, newDriver].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setForm(EMPTY_FORM);
      // Drop straight into the edit row for the driver just created -- same
      // form everyone else uses, now with a real id ready for document upload.
      startEdit(newDriver);
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setRowError(null);
    if (!editForm.name.trim()) {
      setRowError("Driver name is required");
      return;
    }
    const ok = await confirm({
      title: "Save changes?",
      message: `Save changes to "${editForm.name.trim()}"?`,
      confirmLabel: "Save",
    });
    if (!ok) return;
    setRowSaving(true);
    try {
      const res = await fetch(`/api/drivers/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValuesToBody(editForm, null)),
      });
      const data = (await res.json()) as { driver?: Driver; error?: string };
      if (!res.ok || !data.driver) {
        setRowError(data.error ?? `Failed (${res.status})`);
        return;
      }
      // data.driver has no signed urls (PATCH doesn't resolve them) -- spread
      // it over the existing entry so previously-resolved signed urls survive
      // until the next full load naturally re-signs against the new paths.
      setDrivers((prev) =>
        prev.map((d) => (d.id === editingId ? { ...d, ...data.driver! } : d)),
      );
      setEditingId(null);
      router.refresh();
    } catch {
      setRowError("Network error — try again");
    } finally {
      setRowSaving(false);
    }
  }

  async function linkLogin(driver: Driver, create: boolean) {
    const email = (
      linkEmailById[driver.id] ?? suggestDriverEmail(driver.name)
    ).trim();
    const ok = await confirm({
      title: create ? "Create & link login?" : "Link login?",
      message: create
        ? `Create "${email}" and link it to ${driver.name}'s Matron app login? They board students and run GPS on the same phone.`
        : `Link "${email}" to ${driver.name}'s Matron app login? They board students and run GPS on the same phone.`,
      confirmLabel: create ? "Create & link" : "Link",
    });
    if (!ok) return;
    setLinkBusyId(driver.id);
    setLinkMsgById((prev) => {
      const next = { ...prev };
      delete next[driver.id];
      return next;
    });
    try {
      const res = await fetch(`/api/drivers/${driver.id}/link-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, create }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        hint?: string;
        email?: string;
        temporary_password?: string | null;
        action?: string;
      };
      if (!res.ok || !data.ok) {
        setLinkMsgById((prev) => ({
          ...prev,
          [driver.id]: {
            ok: false,
            text: [data.error, data.hint].filter(Boolean).join(" — "),
          },
        }));
        return;
      }
      const pw = data.temporary_password
        ? ` Temp password: ${data.temporary_password}`
        : "";
      setLinkMsgById((prev) => ({
        ...prev,
        [driver.id]: {
          ok: true,
          text: `${data.action === "created" ? "Created" : "Linked"} ${data.email} → Matron app.${pw}`,
        },
      }));
    } catch {
      setLinkMsgById((prev) => ({
        ...prev,
        [driver.id]: { ok: false, text: "Network error — try again" },
      }));
    } finally {
      setLinkBusyId(null);
    }
  }

  async function remove(driver: Driver) {
    const ok = await confirm({
      title: "Delete driver?",
      message: `Delete driver "${driver.name}"? Any bus assigned to them will show "Not assigned" instead.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/drivers/${driver.id}`, { method: "DELETE" });
      const data = (await res.json()) as { ok?: true; error?: string };
      if (!res.ok || !data.ok) {
        alert(data.error ?? `Failed (${res.status})`);
        return;
      }
      setDrivers((prev) => prev.filter((d) => d.id !== driver.id));
      router.refresh();
    } catch {
      alert("Network error — try again");
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      <DriverBulkProvision />

      <form
        onSubmit={submit}
        className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Add driver
        </h2>
        <div className="mt-3">
          <DriverFieldGroups
            values={form}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-4 rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          {saving ? "Saving…" : "Add driver"}
        </button>
        {error ? (
          <p className="mt-3 text-sm font-semibold text-danger">{error}</p>
        ) : null}
        {okMsg ? (
          <p className="mt-3 text-sm font-semibold text-success">{okMsg}</p>
        ) : null}
      </form>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Drivers
        </h2>
        {drivers.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No drivers yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
            {drivers.map((driver) =>
              editingId === driver.id ? (
                <li key={driver.id} className="p-4">
                  <form
                    onSubmit={saveEdit}
                    className="rounded-[var(--radius-sm)] border border-card-border bg-light-blue-30/40 p-4"
                  >
                    <DriverFieldGroups
                      values={editForm}
                      onChange={(patch) =>
                        setEditForm((prev) => ({ ...prev, ...patch }))
                      }
                      driverId={driver.id}
                      signedUrls={{
                        photo: driver.photo_signed_url,
                        nationalId: driver.national_id_photo_signed_url,
                        passport: driver.passport_photo_signed_url,
                        cv: driver.cv_signed_url,
                        license: driver.license_photo_signed_url,
                        psvBadge: driver.psv_badge_photo_signed_url,
                        medical: driver.medical_cert_photo_signed_url,
                      }}
                    />
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={rowSaving}
                        className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
                      >
                        {rowSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-sm font-semibold text-ink-muted hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                    {rowError ? (
                      <p className="mt-3 text-sm font-semibold text-danger">
                        {rowError}
                      </p>
                    ) : null}
                  </form>
                </li>
              ) : (
                <li
                  key={driver.id}
                  className="flex flex-wrap items-start justify-between gap-4 p-4"
                >
                  <div>
                    <p className="font-semibold text-ink">{driver.name}</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {driver.license_number ?? "No license number"}
                      {driver.phone ? ` · ${driver.phone}` : ""}
                    </p>
                    {driver.next_of_kin_name ? (
                      <p className="mt-1 text-xs text-ink-faint">
                        Next of kin: {driver.next_of_kin_name}
                        {driver.next_of_kin_phone ? ` · ${driver.next_of_kin_phone}` : ""}
                        {driver.next_of_kin_relationship
                          ? ` (${driver.next_of_kin_relationship})`
                          : ""}
                      </p>
                    ) : null}
                    <div className="mt-2">
                      <ComplianceBadgeRow driver={driver} />
                    </div>
                    <div className="mt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => startEdit(driver)}
                        className="text-xs font-semibold text-electric-blue hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(driver)}
                        className="text-xs font-semibold text-danger hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="mt-3 max-w-lg rounded-[var(--radius-sm)] border border-dashed border-card-border bg-[#f7f9fc] p-3">
                      <p className="text-xs font-semibold text-ink">
                        Matron app login
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        Create or link a personal @silverleaf.co.tz login so
                        they can use the Matron app (boarding + GPS).
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <input
                          type="email"
                          value={
                            linkEmailById[driver.id] ??
                            suggestDriverEmail(driver.name)
                          }
                          onChange={(e) =>
                            setLinkEmailById((prev) => ({
                              ...prev,
                              [driver.id]: e.target.value,
                            }))
                          }
                          placeholder={suggestDriverEmail(driver.name)}
                          className="min-w-[12rem] flex-1 rounded-[var(--radius-sm)] border border-card-border px-2.5 py-1.5 text-sm text-ink"
                        />
                        <button
                          type="button"
                          disabled={linkBusyId === driver.id}
                          onClick={() => void linkLogin(driver, true)}
                          className="rounded-[var(--radius-sm)] bg-electric-blue px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                        >
                          {linkBusyId === driver.id
                            ? "Working…"
                            : "Create & link"}
                        </button>
                        <button
                          type="button"
                          disabled={linkBusyId === driver.id}
                          onClick={() => void linkLogin(driver, false)}
                          className="rounded-[var(--radius-sm)] border border-electric-blue px-3 py-1.5 text-xs font-bold text-electric-blue disabled:opacity-60"
                        >
                          Link existing
                        </button>
                      </div>
                      {linkMsgById[driver.id] ? (
                        <p
                          className={`mt-2 text-xs font-semibold ${
                            linkMsgById[driver.id].ok
                              ? "text-success"
                              : "text-danger"
                          }`}
                        >
                          {linkMsgById[driver.id].text}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
      {dialog}
    </div>
  );
}
