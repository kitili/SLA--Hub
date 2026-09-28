export type GeoStatus = "idle" | "loading" | "granted" | "denied" | "unavailable";

export type GeoPosition = {
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: string;
};

export function formatCoords(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
