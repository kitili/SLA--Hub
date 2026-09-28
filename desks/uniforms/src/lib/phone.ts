/** Tanzania mobile → WhatsApp international, digits only. */
export function waDigits(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("255") && d.length >= 12) return d.slice(0, 12);
  if (d.startsWith("0") && d.length >= 10) return `255${d.slice(1, 10)}`;
  if (d.length === 9) return `255${d}`;
  return d;
}

export function waHref(phone: string, text: string): string | null {
  const digits = waDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function smsHref(phone: string, text: string): string | null {
  const digits = waDigits(phone);
  if (!digits) return null;
  return `sms:+${digits}?body=${encodeURIComponent(text)}`;
}
