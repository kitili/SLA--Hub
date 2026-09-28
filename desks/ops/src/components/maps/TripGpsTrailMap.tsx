"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  googleMapsTrailUrl,
  type GpsTrailPoint,
  trailToLatLngs,
} from "@/lib/geo/gps-trail";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
} from "@/lib/geo/mapDefaults";

type Props = {
  tripId: string;
  busLabel: string;
  className?: string;
  height?: string;
};

/** Draw GPS polyline + start/end markers on a Leaflet layer. */
export function drawGpsTrail(
  L: typeof import("leaflet"),
  layer: import("leaflet").LayerGroup,
  trail: GpsTrailPoint[],
): [number, number][] {
  layer.clearLayers();
  const latlngs = trailToLatLngs(trail);
  if (latlngs.length >= 2) {
    L.polyline(latlngs, {
      color: "#133282",
      weight: 4,
      opacity: 0.88,
    }).addTo(layer);
  }
  const start = trail[0];
  const end = trail.length > 1 ? trail[trail.length - 1] : null;
  if (start) {
    L.circleMarker([start.lat, start.lng], {
      radius: 9,
      color: "#167a37",
      fillColor: "#167a37",
      fillOpacity: 1,
      weight: 2,
    })
      .bindTooltip("Start", { permanent: false })
      .addTo(layer);
  }
  if (end && end !== start) {
    L.circleMarker([end.lat, end.lng], {
      radius: 9,
      color: "#c0392b",
      fillColor: "#c0392b",
      fillOpacity: 1,
      weight: 2,
    })
      .bindTooltip("End", { permanent: false })
      .addTo(layer);
  }
  return latlngs;
}

export function TripGpsTrailMap({
  tripId,
  busLabel,
  className = "",
  height = "22rem",
}: Props) {
  const mapId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const trailLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const [trail, setTrail] = useState<GpsTrailPoint[]>([]);
  const [pingCount, setPingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/trips/${tripId}/locations`);
        const data = (await res.json()) as {
          trail?: GpsTrailPoint[];
          ping_count?: number;
          error?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Could not load GPS trail");
          setTrail([]);
          return;
        }
        if (!cancelled) {
          setTrail(data.trail ?? []);
          setPingCount(data.ping_count ?? data.trail?.length ?? 0);
        }
      } catch {
        if (!cancelled) setError("Network error loading GPS trail");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng],
        zoom: DEFAULT_MAP_ZOOM,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      trailLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    }

    void initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        trailLayerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function redraw() {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      const layer = trailLayerRef.current;
      if (cancelled || !map || !layer) return;

      const latlngs = drawGpsTrail(L, layer, trail);
      if (latlngs.length >= 2) {
        map.fitBounds(L.latLngBounds(latlngs).pad(0.12));
      } else if (latlngs.length === 1) {
        map.setView(latlngs[0]!, 15);
      }
    }

    if (!loading) void redraw();
    return () => {
      cancelled = true;
    };
  }, [trail, loading]);

  const mapsUrl = googleMapsTrailUrl(trail);

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">
          GPS path · {busLabel} ·{" "}
          <span className="font-semibold text-ink">
            {trail.length >= 2
              ? `${trail.length} map points`
              : pingCount > 0
                ? `${pingCount} ping(s) — not enough for a line`
                : "No GPS pings recorded"}
          </span>
        </p>
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-electric-blue hover:underline"
          >
            Open in Google Maps
          </a>
        ) : null}
      </div>
      {error ? (
        <p className="mb-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div
        id={mapId}
        ref={containerRef}
        className="overflow-hidden rounded-[var(--radius)] border border-card-border bg-light-blue-30/40"
        style={{ height }}
        aria-label={`GPS trail map for ${busLabel}`}
      />
      {loading ? (
        <p className="mt-2 text-xs text-ink-muted">Loading trail…</p>
      ) : null}
    </div>
  );
}
