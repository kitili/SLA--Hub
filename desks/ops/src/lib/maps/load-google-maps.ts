const SCRIPT_ID = "ops-google-maps-js";

type GoogleMapsWindow = Window & {
  google?: typeof google;
  __opsGoogleMapsPromise?: Promise<typeof google>;
};

export function getGoogleMapsBrowserKey(): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return key || null;
}

/** Load Maps JavaScript API (places Directions) once per page. */
export function loadGoogleMaps(libraries: string[] = ["maps", "marker"]): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }

  const w = window as GoogleMapsWindow;
  if (w.google?.maps) return Promise.resolve(w.google);
  if (w.__opsGoogleMapsPromise) return w.__opsGoogleMapsPromise;

  const key = getGoogleMapsBrowserKey();
  if (!key) {
    return Promise.reject(new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
  }

  w.__opsGoogleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => {
        if (w.google?.maps) resolve(w.google);
        else reject(new Error("Google Maps failed to initialize"));
      });
      existing.addEventListener("error", () =>
        reject(new Error("Google Maps script failed to load")),
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    const libs = libraries.join(",");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=${encodeURIComponent(libs)}&v=weekly`;
    script.onload = () => {
      if (w.google?.maps) resolve(w.google);
      else reject(new Error("Google Maps failed to initialize"));
    };
    script.onerror = () => reject(new Error("Google Maps script failed to load"));
    document.head.appendChild(script);
  });

  return w.__opsGoogleMapsPromise;
}
