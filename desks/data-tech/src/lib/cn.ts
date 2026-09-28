type ClassValue = string | number | boolean | undefined | null;

export function cn(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}
