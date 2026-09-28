'use client';

/** Tanzania-friendly phone helpers for marketing follow-up CTAs. */

export function digitsOnly(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/** Build wa.me number (country code, no +). Defaults TZ 255 when local 0… / 9-digit. */
export function whatsappDigits(phone) {
  let d = digitsOnly(phone);
  if (!d) return '';
  if (d.startsWith('255')) return d;
  if (d.startsWith('0') && d.length >= 10) return `255${d.slice(1)}`;
  if (d.length === 9) return `255${d}`;
  return d;
}

export function telHref(phone) {
  const d = digitsOnly(phone);
  if (!d) return null;
  if (d.startsWith('255')) return `tel:+${d}`;
  if (d.startsWith('0')) return `tel:+255${d.slice(1)}`;
  if (d.length === 9) return `tel:+255${d}`;
  return `tel:+${d}`;
}

export function whatsappHref(phone, text) {
  const d = whatsappDigits(phone);
  if (!d) return null;
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${d}${q}`;
}

/** Stale if no follow-up date and untouched > days, or follow-up date is past. */
export function isFollowUpOverdue(lead, days = 7) {
  if (!lead) return false;
  if (['admission_paid', 'enrolled', 'declined', 'lapsed', 'dead_lead'].includes(lead.computed_stage)) {
    return false;
  }
  if (lead.follow_up_date) {
    const due = new Date(lead.follow_up_date);
    due.setHours(23, 59, 59, 999);
    return due.getTime() < Date.now();
  }
  const updated = new Date(lead.last_contacted_at || lead.created_at || lead.updated_at).getTime();
  if (Number.isNaN(updated)) return false;
  return (Date.now() - updated) / 86400000 > days;
}
