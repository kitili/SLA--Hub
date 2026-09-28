"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
} from "@/lib/geo/mapDefaults";
import { isPlausibleTanzaniaCoord } from "@/lib/geo/plausible-coord";

export type MapStopPoint = {
  id: string;
  name: string;
  order: number;
  lat: number | null;
  lng: number | null;
};

export type MapLineMode = "road" | "straight";

type Props = {
  stops: MapStopPoint[];
  /**
   * Draw a path through stops that have coordinates.
   * With `lineMode="road"`, uses /api/routes/geometry (ORS → Google → OSRM)
   * and falls back to a straight stop-to-stop line if every provider fails.
   */
  showPolyline?: boolean;
  /**
   * `road` = road-following path when geometry is available; `straight` =
   * plain stop-to-stop line. Road falls back to straight on provider failure.
   */
  lineMode?: MapLineMode;
  /** When set, map click reports lat/lng for placing a new stop. */
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
  height?: string;
};

/**
 * Admin route map: unlabeled stop dots + road path when available.
 * Implausible coordinates (outside Tanzania) stay visible as warning pins so
 * staff can fix them, but are excluded from the route line and fit-bounds.
 * Numbered order labels are omitted — route_stop order is not the same as
 * “which children board here”.
 */
export function StopsMap({
  stops,
  showPolyline = true,
  lineMode = "road",
  onMapClick,
  className = "",
  height = "22rem",
}: Props) {
  const mapId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const onClickRef = useRef(onMapClick);
  onClickRef.current = onMapClick;

  // Road-following geometry from /api/routes/geometry, when available —
  // falls back to the straight-line polyline below if every provider fails.
  // Paired with the signature it was fetched for, so a stale result from a
  // previous stop sequence is never mistakenly applied to a new one.
  const [roadGeometryState, setRoadGeometryState] = useState<{
    signature: string;
    coordinates: [number, number][];
  } | null>(null);
  // True only after a real fetch attempt came back with no usable geometry
  // from any provider (not "haven't tried yet") — drives the visible
  // fallback notice below.
  const [roadGeometryFailed, setRoadGeometryFailed] = useState(false);
  const [geometryLoading, setGeometryLoading] = useState(false);

  const coordsSignature = useMemo(
    () =>
      stops
        .filter(
          (s): s is MapStopPoint & { lat: number; lng: number } =>
            s.lat != null &&
            s.lng != null &&
            Number.isFinite(s.lat) &&
            Number.isFinite(s.lng) &&
            isPlausibleTanzaniaCoord(s.lat, s.lng),
        )
        .map((s) => `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`)
        .join("|"),
    [stops],
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !containerRef.current || mapRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current, {
        center: [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng],
        zoom: DEFAULT_MAP_ZOOM,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      map.on("click", (e) => {
        onClickRef.current?.(e.latlng.lat, e.latlng.lng);
      });
    }

    void init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function redraw() {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      const layers = layerRef.current;
      if (cancelled || !map || !layers) return;

      layers.clearLayers();

      const withCoords = stops.filter(
        (s): s is MapStopPoint & { lat: number; lng: number } =>
          s.lat != null &&
          s.lng != null &&
          Number.isFinite(s.lat) &&
          Number.isFinite(s.lng),
      );
      // Still shown as a marker so staff can SEE the problem and fix it, but
      // excluded from the route line / bounds / geometry request below.
      const plausibleCoords = withCoords.filter((s) =>
        isPlausibleTanzaniaCoord(s.lat, s.lng),
      );

      for (const stop of withCoords) {
        const suspect = !isPlausibleTanzaniaCoord(stop.lat, stop.lng);
        if (suspect) {
          // Leaflet's default icon only applies when `icon` is absent —
          // passing `icon: undefined` overwrites the default and crashes
          // normal markers.
          const marker = L.marker([stop.lat, stop.lng], {
            icon: L.icon({
              iconUrl:
                "data:image/svg+xml;base64," +
                btoa(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41"><path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#b42318"/><text x="12.5" y="17" font-size="14" font-weight="bold" fill="white" text-anchor="middle">!</text></svg>',
                ),
              iconSize: [25, 41],
              iconAnchor: [12, 41],
            }),
          });
          marker.bindPopup(
            `<strong>${escapeHtml(stop.name)}</strong><br/><span style="color:#b42318">Coordinates look wrong (outside Tanzania) — excluded from the route line. Needs a real fix.</span>`,
          );
          layers.addLayer(marker);
        } else {
          // Unlabeled dots only — no order numbers.
          const marker = L.circleMarker([stop.lat, stop.lng], {
            radius: 6,
            color: "#002368",
            fillColor: "#80bfec",
            fillOpacity: 0.95,
            weight: 2,
          });
          marker.bindPopup(`<strong>${escapeHtml(stop.name)}</strong>`);
          layers.addLayer(marker);
        }
      }

      if (showPolyline && plausibleCoords.length >= 2) {
        const roadGeometry =
          lineMode === "road" &&
          roadGeometryState?.signature === coordsSignature
            ? roadGeometryState.coordinates
            : null;
        const latlngs: [number, number][] = roadGeometry
          ? roadGeometry.map(([lng, lat]) => [lat, lng])
          : plausibleCoords.map((s) => [s.lat, s.lng]);
        const usingRoad = Boolean(roadGeometry);
        layers.addLayer(
          L.polyline(latlngs, {
            color: usingRoad ? "#002368" : "#80bfec",
            weight: usingRoad ? 5 : 4,
            opacity: usingRoad ? 0.92 : 0.9,
            dashArray: usingRoad ? undefined : "10 8",
          }),
        );
      }

      // Bounds/center use only plausible stops — one garbage coordinate should
      // not zoom the whole map out and hide every real stop.
      if (plausibleCoords.length === 1) {
        map.setView([plausibleCoords[0].lat, plausibleCoords[0].lng], 13);
      } else if (plausibleCoords.length > 1) {
        const bounds = L.latLngBounds(
          plausibleCoords.map((s) => [s.lat, s.lng] as [number, number]),
        );
        map.fitBounds(bounds.pad(0.2));
      } else if (withCoords.length === 1) {
        map.setView([withCoords[0].lat, withCoords[0].lng], 13);
      }
    }

    void redraw();
    return () => {
      cancelled = true;
    };
  }, [stops, showPolyline, lineMode, roadGeometryState, coordsSignature]);

  useEffect(() => {
    if (!showPolyline || lineMode !== "road") {
      setGeometryLoading(false);
      setRoadGeometryFailed(false);
      return;
    }
    const plausibleCoords = stops.filter(
      (s): s is MapStopPoint & { lat: number; lng: number } =>
        s.lat != null &&
        s.lng != null &&
        Number.isFinite(s.lat) &&
        Number.isFinite(s.lng) &&
        isPlausibleTanzaniaCoord(s.lat, s.lng),
    );
    if (plausibleCoords.length < 2) {
      setGeometryLoading(false);
      setRoadGeometryFailed(false);
      return;
    }

    let cancelled = false;
    setGeometryLoading(true);
    setRoadGeometryFailed(false);

    async function fetchGeometry() {
      try {
        const res = await fetch("/api/routes/geometry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            points: plausibleCoords.map((s) => ({ lat: s.lat, lng: s.lng })),
          }),
        });
        if (cancelled) return;
        if (!res.ok) {
          setRoadGeometryFailed(true);
          setGeometryLoading(false);
          return;
        }
        const data = (await res.json()) as {
          coordinates: [number, number][] | null;
        };
        if (cancelled) return;
        if (data.coordinates?.length) {
          setRoadGeometryState({
            signature: coordsSignature,
            coordinates: data.coordinates,
          });
          setRoadGeometryFailed(false);
        } else {
          setRoadGeometryFailed(true);
        }
      } catch {
        if (!cancelled) setRoadGeometryFailed(true);
      } finally {
        if (!cancelled) setGeometryLoading(false);
      }
    }

    void fetchGeometry();
    return () => {
      cancelled = true;
    };
    // Keyed on coordsSignature (stable derived summary), not the stops array
    // reference, to avoid re-fetching on every unrelated parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordsSignature, showPolyline, lineMode]);

  return (
    <div className={className}>
      <div
        id={`stops-map-${mapId}`}
        ref={containerRef}
        style={{ height, width: "100%" }}
        className="z-0 overflow-hidden rounded-[var(--radius)] border border-card-border"
      />
      {showPolyline && lineMode === "road" && geometryLoading ? (
        <p className="mt-2 text-xs text-ink-faint">Loading road path…</p>
      ) : null}
      {showPolyline && lineMode === "road" && roadGeometryFailed ? (
        <p className="mt-2 rounded-[var(--radius-sm)] border border-danger/30 bg-danger-15 px-2 py-1 text-xs font-semibold text-danger">
          Could not load the road-following path (all routing providers failed)
          — showing a straight line between stops instead.
        </p>
      ) : null}
      {onMapClick ? (
        <p className="mt-2 text-xs text-ink-faint">
          Click the map to set coordinates for a new stop.
        </p>
      ) : null}
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
