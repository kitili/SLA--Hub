/**
 * Pulls a lat/lng out of what parents usually send: a Google Maps link, a
 * WhatsApp shared-location link, a geo: URI, or plain "-3.36, 36.68" text.
 * Returns null when nothing coordinate-shaped is found — notably for short
 * links (maps.app.goo.gl/…), which hide the coordinates behind a redirect.
 */
export function parseLocationLink(raw: string): { lat: number; lng: number } | null {
  let text = raw.trim();
  if (!text) return null;
  try {
    text = decodeURIComponent(text);
  } catch {
    // Keep the raw text if it isn't valid URI encoding.
  }

  const num = String.raw`(-?\d{1,2}(?:\.\d+)?)`;
  const patterns = [
    // …/data=!3d-3.36!4d36.68 — the exact pin, preferred over the map centre.
    new RegExp(String.raw`!3d${num}!4d${num}`),
    // ?q=-3.36,36.68 / ?query= / ?ll= / ?destination=
    new RegExp(String.raw`[?&](?:q|query|ll|destination|daddr)=(?:loc:)?${num}\s*,\s*${num}`),
    // geo:-3.36,36.68
    new RegExp(String.raw`geo:${num}\s*,\s*${num}`),
    // …/@-3.36,36.68,17z — map centre.
    new RegExp(String.raw`@${num},${num}`),
    // Plain "-3.36, 36.68"
    new RegExp(String.raw`^${num}\s*,\s*${num}$`),
  ];

  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }
  return null;
}
