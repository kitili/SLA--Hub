export type DriverDocSlot =
  | "photo"
  | "national-id"
  | "passport"
  | "cv"
  | "license"
  | "psv-badge"
  | "medical";

export const DRIVER_DOC_SLOTS: DriverDocSlot[] = [
  "photo",
  "national-id",
  "passport",
  "cv",
  "license",
  "psv-badge",
  "medical",
];

export function slotColumn(
  slot: DriverDocSlot,
):
  | "photoUrl"
  | "nationalIdPhotoUrl"
  | "passportPhotoUrl"
  | "cvUrl"
  | "licensePhotoUrl"
  | "psvBadgePhotoUrl"
  | "medicalCertPhotoUrl" {
  switch (slot) {
    case "photo":
      return "photoUrl";
    case "national-id":
      return "nationalIdPhotoUrl";
    case "passport":
      return "passportPhotoUrl";
    case "cv":
      return "cvUrl";
    case "license":
      return "licensePhotoUrl";
    case "psv-badge":
      return "psvBadgePhotoUrl";
    case "medical":
      return "medicalCertPhotoUrl";
  }
}

export function slotStoragePaths(driverId: string, slot: DriverDocSlot): string[] {
  return ["jpg", "png", "webp", "pdf"].map((ext) => `${driverId}/${slot}.${ext}`);
}
