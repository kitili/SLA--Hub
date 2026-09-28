import { createClient } from "@/lib/supabase/server";
import type { Bus } from "@/types/database";

export type Driver = {
  id: string;
  name: string;
  license_number: string | null;
  license_expiry: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  next_of_kin_relationship: string | null;
  psv_permit_number: string | null;
  psv_permit_expiry: string | null;
  first_aid_cert_expiry: string | null;
  personal_insurance_expiry: string | null;
  medical_exam_date: string | null;
  medical_cert_expiry: string | null;
  license_class: string | null;
  police_clearance_date: string | null;
  child_safety_training_date: string | null;
  defensive_driving_training_date: string | null;
  photo_url: string | null;
  national_id_number: string | null;
  national_id_photo_url: string | null;
  passport_number: string | null;
  passport_photo_url: string | null;
  cv_url: string | null;
  license_photo_url: string | null;
  psv_badge_photo_url: string | null;
  medical_cert_photo_url: string | null;
  last_service_date: string | null;
  next_service_due: string | null;
};

export type DriverWithPhotoUrls = Driver & {
  photo_signed_url: string | null;
  national_id_photo_signed_url: string | null;
  passport_photo_signed_url: string | null;
  cv_signed_url: string | null;
  license_photo_signed_url: string | null;
  psv_badge_photo_signed_url: string | null;
  medical_cert_photo_signed_url: string | null;
};

export type BusWithCompliance = Bus & {
  driver: Pick<
    Driver,
    | "id"
    | "name"
    | "license_expiry"
    | "psv_permit_expiry"
    | "first_aid_cert_expiry"
    | "personal_insurance_expiry"
    | "medical_cert_expiry"
    | "next_service_due"
    | "police_clearance_date"
    | "phone"
    | "photo_url"
    | "license_photo_url"
    | "psv_badge_photo_url"
    | "medical_cert_photo_url"
    | "national_id_photo_url"
    | "cv_url"
  > | null;
};

export const DRIVER_COLUMNS = [
  "id",
  "name",
  "license_number",
  "license_expiry",
  "phone",
  "active",
  "created_at",
  "updated_at",
  "next_of_kin_name",
  "next_of_kin_phone",
  "next_of_kin_relationship",
  "psv_permit_number",
  "psv_permit_expiry",
  "first_aid_cert_expiry",
  "personal_insurance_expiry",
  "medical_exam_date",
  "medical_cert_expiry",
  "license_class",
  "police_clearance_date",
  "child_safety_training_date",
  "defensive_driving_training_date",
  "photo_url",
  "national_id_number",
  "national_id_photo_url",
  "passport_number",
  "passport_photo_url",
  "cv_url",
  "license_photo_url",
  "psv_badge_photo_url",
  "medical_cert_photo_url",
  "last_service_date",
  "next_service_due",
].join(", ");

export type DriverWriteInput = {
  name?: string;
  licenseNumber?: string | null;
  licenseExpiry?: string | null;
  phone?: string | null;
  nextOfKinName?: string | null;
  nextOfKinPhone?: string | null;
  nextOfKinRelationship?: string | null;
  psvPermitNumber?: string | null;
  psvPermitExpiry?: string | null;
  firstAidCertExpiry?: string | null;
  personalInsuranceExpiry?: string | null;
  medicalExamDate?: string | null;
  medicalCertExpiry?: string | null;
  licenseClass?: string | null;
  policeClearanceDate?: string | null;
  childSafetyTrainingDate?: string | null;
  defensiveDrivingTrainingDate?: string | null;
  photoUrl?: string | null;
  nationalIdNumber?: string | null;
  nationalIdPhotoUrl?: string | null;
  passportNumber?: string | null;
  passportPhotoUrl?: string | null;
  cvUrl?: string | null;
  licensePhotoUrl?: string | null;
  psvBadgePhotoUrl?: string | null;
  medicalCertPhotoUrl?: string | null;
  lastServiceDate?: string | null;
  nextServiceDue?: string | null;
};

function applyDriverPatch(
  update: Record<string, unknown>,
  patch: DriverWriteInput,
) {
  if (patch.licenseNumber !== undefined) update.license_number = patch.licenseNumber;
  if (patch.licenseExpiry !== undefined) update.license_expiry = patch.licenseExpiry;
  if (patch.phone !== undefined) update.phone = patch.phone;
  if (patch.nextOfKinName !== undefined) update.next_of_kin_name = patch.nextOfKinName;
  if (patch.nextOfKinPhone !== undefined) update.next_of_kin_phone = patch.nextOfKinPhone;
  if (patch.nextOfKinRelationship !== undefined)
    update.next_of_kin_relationship = patch.nextOfKinRelationship;
  if (patch.psvPermitNumber !== undefined) update.psv_permit_number = patch.psvPermitNumber;
  if (patch.psvPermitExpiry !== undefined) update.psv_permit_expiry = patch.psvPermitExpiry;
  if (patch.firstAidCertExpiry !== undefined)
    update.first_aid_cert_expiry = patch.firstAidCertExpiry;
  if (patch.personalInsuranceExpiry !== undefined)
    update.personal_insurance_expiry = patch.personalInsuranceExpiry;
  if (patch.medicalExamDate !== undefined) update.medical_exam_date = patch.medicalExamDate;
  if (patch.medicalCertExpiry !== undefined)
    update.medical_cert_expiry = patch.medicalCertExpiry;
  if (patch.licenseClass !== undefined) update.license_class = patch.licenseClass;
  if (patch.policeClearanceDate !== undefined)
    update.police_clearance_date = patch.policeClearanceDate;
  if (patch.childSafetyTrainingDate !== undefined)
    update.child_safety_training_date = patch.childSafetyTrainingDate;
  if (patch.defensiveDrivingTrainingDate !== undefined)
    update.defensive_driving_training_date = patch.defensiveDrivingTrainingDate;
  if (patch.photoUrl !== undefined) update.photo_url = patch.photoUrl;
  if (patch.nationalIdNumber !== undefined)
    update.national_id_number = patch.nationalIdNumber;
  if (patch.nationalIdPhotoUrl !== undefined)
    update.national_id_photo_url = patch.nationalIdPhotoUrl;
  if (patch.passportNumber !== undefined) update.passport_number = patch.passportNumber;
  if (patch.passportPhotoUrl !== undefined)
    update.passport_photo_url = patch.passportPhotoUrl;
  if (patch.cvUrl !== undefined) update.cv_url = patch.cvUrl;
  if (patch.licensePhotoUrl !== undefined) update.license_photo_url = patch.licensePhotoUrl;
  if (patch.psvBadgePhotoUrl !== undefined)
    update.psv_badge_photo_url = patch.psvBadgePhotoUrl;
  if (patch.medicalCertPhotoUrl !== undefined)
    update.medical_cert_photo_url = patch.medicalCertPhotoUrl;
  if (patch.lastServiceDate !== undefined) update.last_service_date = patch.lastServiceDate;
  if (patch.nextServiceDue !== undefined) update.next_service_due = patch.nextServiceDue;
}

export function documentPathsForDriver(d: Driver): string[] {
  return [
    d.photo_url,
    d.national_id_photo_url,
    d.passport_photo_url,
    d.cv_url,
    d.license_photo_url,
    d.psv_badge_photo_url,
    d.medical_cert_photo_url,
  ].filter((p): p is string => Boolean(p));
}

export async function getDrivers(): Promise<Driver[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drivers")
    .select(DRIVER_COLUMNS)
    .order("name");
  if (error || !data) return [];
  return data as unknown as Driver[];
}

export async function getDriverById(id: string): Promise<Driver | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drivers")
    .select(DRIVER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as Driver;
}

export async function createDriver(
  input: DriverWriteInput & { name: string },
): Promise<{ driver: Driver } | { error: string }> {
  const supabase = await createClient();
  const name = input.name.trim();
  if (!name) return { error: "Driver name is required" };

  const row: Record<string, unknown> = { name };
  applyDriverPatch(row, input);

  const { data, error } = await supabase
    .from("drivers")
    .insert(row)
    .select(DRIVER_COLUMNS)
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to create driver" };
  }
  return { driver: data as unknown as Driver };
}

export async function updateDriver(
  id: string,
  patch: DriverWriteInput,
): Promise<{ driver: Driver } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  let newName: string | undefined;
  if (patch.name != null) {
    newName = patch.name.trim();
    if (!newName) return { error: "Driver name is required" };
    update.name = newName;
  }
  applyDriverPatch(update, patch);

  const { data, error } = await supabase
    .from("drivers")
    .update(update)
    .eq("id", id)
    .select(DRIVER_COLUMNS)
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to update driver" };
  }

  if (newName !== undefined) {
    await supabase.from("buses").update({ driver_name: newName }).eq("driver_id", id);
  }

  return { driver: data as unknown as Driver };
}

const DOC_EXTS = ["jpg", "png", "webp", "pdf"] as const;
const DOC_SLOTS = [
  "photo",
  "national-id",
  "passport",
  "cv",
  "license",
  "psv-badge",
  "medical",
] as const;

export async function deleteDriver(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();

  await supabase.from("buses").update({ driver_name: null }).eq("driver_id", id);

  const paths = DOC_SLOTS.flatMap((slot) =>
    DOC_EXTS.map((ext) => `${id}/${slot}.${ext}`),
  );
  await supabase.storage.from("driver-documents").remove(paths);

  const { error } = await supabase.from("drivers").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

const SIGNED_URL_TTL_SECONDS = 300;

export async function attachSignedUrls(
  drivers: Driver[],
): Promise<DriverWithPhotoUrls[]> {
  const supabase = await createClient();
  const paths = Array.from(
    new Set(drivers.flatMap((d) => documentPathsForDriver(d))),
  );

  const signedByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage
      .from("driver-documents")
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) signedByPath.set(entry.path, entry.signedUrl);
    }
  }

  return drivers.map((d) => ({
    ...d,
    photo_signed_url: d.photo_url ? (signedByPath.get(d.photo_url) ?? null) : null,
    national_id_photo_signed_url: d.national_id_photo_url
      ? (signedByPath.get(d.national_id_photo_url) ?? null)
      : null,
    passport_photo_signed_url: d.passport_photo_url
      ? (signedByPath.get(d.passport_photo_url) ?? null)
      : null,
    cv_signed_url: d.cv_url ? (signedByPath.get(d.cv_url) ?? null) : null,
    license_photo_signed_url: d.license_photo_url
      ? (signedByPath.get(d.license_photo_url) ?? null)
      : null,
    psv_badge_photo_signed_url: d.psv_badge_photo_url
      ? (signedByPath.get(d.psv_badge_photo_url) ?? null)
      : null,
    medical_cert_photo_signed_url: d.medical_cert_photo_url
      ? (signedByPath.get(d.medical_cert_photo_url) ?? null)
      : null,
  }));
}

export async function getDriversWithPhotos(): Promise<DriverWithPhotoUrls[]> {
  return attachSignedUrls(await getDrivers());
}

type DriverJoin = NonNullable<BusWithCompliance["driver"]>;
type RawBusComplianceRow = Bus & { drivers: DriverJoin | DriverJoin[] | null };

function mapBusWithCompliance(row: RawBusComplianceRow): BusWithCompliance {
  const { drivers, ...bus } = row;
  const driver = Array.isArray(drivers) ? (drivers[0] ?? null) : drivers;
  return { ...bus, driver };
}

export async function getBusesWithCompliance(): Promise<BusWithCompliance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buses")
    .select(
      `id, school_id, label, plate_number, capacity, driver_name, attendant_name, owner_name,
       active, route_id, driver_id, insurance_expiry,
       drivers (
         id, name, license_expiry, psv_permit_expiry, first_aid_cert_expiry,
         personal_insurance_expiry, medical_cert_expiry, next_service_due, police_clearance_date,
         phone, photo_url, license_photo_url, psv_badge_photo_url, medical_cert_photo_url,
         national_id_photo_url, cv_url
       )`,
    )
    .eq("active", true)
    .order("label");

  if (error || !data) return [];
  return (data as unknown as RawBusComplianceRow[]).map(mapBusWithCompliance);
}
