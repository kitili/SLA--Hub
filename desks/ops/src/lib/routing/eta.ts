/** Anchor timestamp + a stop's eta_offset_minutes -> the expected clock
 * moment the trip should reach that stop. Shared by the driver-facing
 * display formatter and any server-side on-time comparison. */
export function computeEtaTimestamp(
  anchorIso: string | null | undefined,
  offsetMinutes: number | null,
): Date | null {
  if (offsetMinutes == null) return null;
  const base = anchorIso ? new Date(anchorIso) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + offsetMinutes * 60_000);
}
