/** Same bounding box already used at import time in
 * scripts/import-student-coordinates.mjs -- reused here at runtime so a
 * garbage coordinate (e.g. a digit-transposition typo, or lat/lng swapped)
 * gets excluded from road-geometry requests and route calculations instead
 * of silently poisoning them. Generous on purpose -- this only needs to
 * reject "obviously not Tanzania," not validate precision. */
export function isPlausibleTanzaniaCoord(lat: number, lng: number): boolean {
  return lat >= -6 && lat <= -1 && lng >= 34 && lng <= 39;
}
