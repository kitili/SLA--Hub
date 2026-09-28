export const CLASSES = ["P1", "P2", "P3", "P4", "P5", "P6", "P7"] as const;

export type FitRow = {
  className: string;
  gender: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  garmentKind: string;
  size: string;
  note: string;
};

export function fitsFor(
  fits: FitRow[],
  className: string,
  gender: string,
): FitRow[] {
  const exact = fits.filter(
    (f) => f.className.toUpperCase() === className.toUpperCase() && f.gender === gender,
  );
  if (exact.length) return exact;
  return fits.filter(
    (f) =>
      f.className.toUpperCase() === className.toUpperCase() &&
      (f.gender === "UNISEX" || gender === "UNISEX"),
  );
}

export function suggestedSize(
  fits: FitRow[],
  className: string,
  gender: string,
  skuId: string,
): string | null {
  return (
    fitsFor(fits, className, gender).find((f) => f.skuId === skuId)?.size ?? null
  );
}

/** Typical day-school size by class — used to seed SizeFit. */
export function defaultSizeForClass(className: string): string {
  const map: Record<string, string> = {
    P1: "18",
    P2: "20",
    P3: "22",
    P4: "24",
    P5: "26",
    P6: "28",
    P7: "30",
  };
  return map[className.toUpperCase()] ?? "24";
}
