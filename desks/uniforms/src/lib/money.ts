/** Integer TZS — never use floats for money. */
export function tzs(amount: number): string {
  const n = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `TZS ${n.toLocaleString("en-TZ")}`;
}

export function parseTzs(value: FormDataEntryValue | null): number {
  const raw = String(value ?? "").replace(/[^\d-]/g, "");
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

export function sumTzs(values: number[]): number {
  return values.reduce((acc, n) => acc + Math.round(n), 0);
}
