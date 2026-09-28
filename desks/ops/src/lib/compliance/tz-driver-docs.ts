/** Tanzania school-transport driver file — required uploads for fleet compliance. */

export type DriverDocField =
  | "photo_url"
  | "license_photo_url"
  | "psv_badge_photo_url"
  | "medical_cert_photo_url"
  | "national_id_photo_url"
  | "cv_url";

export type TzDocRequirement = {
  field: DriverDocField;
  label: string;
  /** Required for “complete file” status */
  required: boolean;
};

/** LATRA / SUMATRA-aligned school bus driver pack (interview + fleet ops). */
export const TZ_DRIVER_DOC_REQUIREMENTS: TzDocRequirement[] = [
  { field: "photo_url", label: "Portrait photo", required: true },
  { field: "license_photo_url", label: "Driving licence", required: true },
  { field: "psv_badge_photo_url", label: "PSV badge / permit", required: true },
  { field: "medical_cert_photo_url", label: "Medical certificate", required: true },
  { field: "national_id_photo_url", label: "National ID (NIDA)", required: true },
  { field: "cv_url", label: "CV / résumé", required: false },
];

export type DriverDocRecord = Partial<Record<DriverDocField, string | null | undefined>>;

export function missingRequiredDocs(driver: DriverDocRecord | null | undefined): TzDocRequirement[] {
  if (!driver) return TZ_DRIVER_DOC_REQUIREMENTS.filter((d) => d.required);
  return TZ_DRIVER_DOC_REQUIREMENTS.filter(
    (d) => d.required && !String(driver[d.field] ?? "").trim(),
  );
}

export function docCompletionPercent(driver: DriverDocRecord | null | undefined): number {
  const required = TZ_DRIVER_DOC_REQUIREMENTS.filter((d) => d.required);
  if (required.length === 0) return 100;
  const have = required.filter((d) => String(driver?.[d.field] ?? "").trim()).length;
  return Math.round((have / required.length) * 100);
}
