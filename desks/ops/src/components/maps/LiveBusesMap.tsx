"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
} from "@/lib/geo/mapDefaults";
import { formatCoords } from "@/lib/geo/format";
import { isPlausibleTanzaniaCoord } from "@/lib/geo/plausible-coord";
import {
  googleMapsTrailUrl,
  type GpsTrailPoint,
} from "@/lib/geo/gps-trail";
import { drawGpsTrail } from "@/components/maps/TripGpsTrailMap";

export type LiveBusMarker = {
  trip_id: string;
  bus_label: string;
  bus_plate: string;
  route_id: string | null;
  direction: string;
  status: string;
  online: boolean;
  lat: number;
  lng: number;
  recorded_at: string;
};

type RouteStop = { lat: number | null; lng: number | null };

type Props = {
  buses: LiveBusMarker[];
  /** Pans/zooms to this bus and opens its popup -- lets the list below the
   * map act as a reliable fallback for picking out one bus when several
   * are clustered close together and their labels overlap. */
  selectedTripId?: string | null;
  /** Clicking a bus's own marker on the map selects it too, not just the
   * list below -- lets the caller keep both in sync. */
  onSelectTrip?: (tripId: string) => void;
  className?: string;
  height?: string;
};

/** Short, consistent identifier for the on-map label -- free-text bus
 * labels vary wildly in length ("HIACE - Normal route" vs "BHM"), but the
 * plate's last token is always a short 3-letter code and is already how
 * staff casually refer to buses (several `label` values in the DB are
 * literally just this code). */
function shortBusLabel(bus: LiveBusMarker): string {
  const plateSuffix = bus.bus_plate.trim().split(/\s+/).pop();
  return plateSuffix || bus.bus_label || "?";
}

export function LiveBusesMap({
  buses,
  selectedTripId,
  onSelectTrip,
  className = "",
  height = "28rem",
}: Props) {
  const mapId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const markersByTripRef = useRef<Map<string, import("leaflet").CircleMarker>>(new Map());
  // Separate from the route layer -- this draws where the bus has actually
  // been (real GPS pings), the route layer draws where it's assigned to go.
  // Both are useful together: a bus can be perfectly "on schedule" while
  // visibly off its assigned road, and this is the only layer that shows that.
  const trailLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const [trailMapsUrl, setTrailMapsUrl] = useState<string | null>(null);
  // Separate layer so the selected bus's route (drawn underneath, in a
  // lighter style) can be cleared/redrawn independently of the bus dots
  // above -- swapping routes on every selection change shouldn't touch the
  // bus markers at all.
  const routeLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  // Set once the currently-selected bus's route has actually loaded, so the
  // marker-redraw effect below (which reruns on every 15s GPS poll) can keep
  // fitting the view to bus+route instead of repeatedly snapping back to
  // "just the bus" and undoing the wider view the route effect just set.
  const routeBoundsRef = useRef<[number, number][] | null>(null);
  /** Fit bounds once (for the no-selection case) so GPS updates don't keep
   * yanking the viewport back to "fit everything" every 15s poll. Only
   * gates the no-selection branches below -- selecting a bus should always
   * re-fit to show it, regardless of whether the map already auto-fit once. */
  const fittedRef = useRef(false);

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
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      routeLayerRef.current = L.layerGroup().addTo(map);
      trailLayerRef.current = L.layerGroup().addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    }

    void init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
        routeLayerRef.current = null;
        trailLayerRef.current = null;
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
      markersByTripRef.current.clear();

      for (const bus of buses) {
        const color = bus.online ? "#167a37" : "#818283";
        const marker = L.circleMarker([bus.lat, bus.lng], {
          radius: 10,
          color,
          fillColor: color,
          fillOpacity: 0.85,
          weight: 2,
        });
        marker.bindPopup(
          `<strong>${escapeHtml(bus.bus_label)}</strong><br/>` +
            `${escapeHtml(bus.bus_plate)} · ${escapeHtml(bus.direction.toUpperCase())}<br/>` +
            `${bus.online ? "Online" : "Stale"} · ${escapeHtml(bus.status)}<br/>` +
            `<span style="font-size:11px">${formatCoords(bus.lat, bus.lng)}</span>`,
        );
        marker.bindTooltip(escapeHtml(shortBusLabel(bus)), {
          permanent: true,
          direction: "top",
          offset: [0, -10],
          className: "ops-map-order-label",
        });
        if (onSelectTrip) {
          marker.on("click", () => onSelectTrip(bus.trip_id));
        }
        layers.addLayer(marker);
        markersByTripRef.current.set(bus.trip_id, marker);
      }

      // A specific selection (from the list below) wins over the
      // fit-everything view -- this is the fallback for when several buses
      // are clustered too close together for their labels to help. Mutually
      // exclusive with the fit-everything branch below, not just layered on
      // top of it -- two consecutive Leaflet view changes in the same tick
      // can race each other's animations and leave the wrong one visible.
      // Not gated by fittedRef -- selecting a bus should always re-fit to
      // show it, regardless of whether the no-selection view already
      // auto-fit once.
      const selected = selectedTripId ? markersByTripRef.current.get(selectedTripId) : null;
      if (selected) {
        const routeBounds = routeBoundsRef.current;
        if (routeBounds && routeBounds.length >= 2) {
          const busLatLng = selected.getLatLng();
          map.fitBounds(
            L.latLngBounds([...routeBounds, [busLatLng.lat, busLatLng.lng]]).pad(0.15),
          );
        } else {
          map.setView(selected.getLatLng(), Math.max(map.getZoom(), 15));
        }
        selected.openPopup();
      } else if (!fittedRef.current && buses.length === 1) {
        map.setView([buses[0].lat, buses[0].lng], 14);
        fittedRef.current = true;
      } else if (!fittedRef.current && buses.length > 1) {
        const bounds = L.latLngBounds(
          buses.map((b) => [b.lat, b.lng] as [number, number]),
        );
        map.fitBounds(bounds.pad(0.25));
        fittedRef.current = true;
      }
    }

    void redraw();
    return () => {
      cancelled = true;
    };
  }, [buses, selectedTripId, onSelectTrip]);

  // Draws the selected bus's route (stops + road-following path) underneath
  // the bus markers, so clicking a bus shows what it's actually following,
  // not just where it is right now. Cleared whenever the selection changes
  // or clears, independent of the bus-marker redraw above. Keyed on the
  // resolved route id (a stable value across re-renders) rather than the
  // whole buses array, so it doesn't refetch/redraw on every 15s GPS poll
  // -- only when the actual selection or its route changes.
  const selectedBus = selectedTripId ? buses.find((b) => b.trip_id === selectedTripId) : null;
  const selectedRouteId = selectedBus?.route_id ?? null;
  // Read fresh at fitBounds-time via this ref rather than as an effect
  // dependency -- the bus's lat/lng changes on every 15s GPS poll, and
  // keying the route effect on it would refetch/redraw the route on every
  // poll too, plus keep yanking the view back even after the user pans away.
  // Updated in its own no-dependency effect (runs after every render) rather
  // than directly in the render body, which React flags as a ref mutation
  // during render even though the value never affects this render's output.
  const selectedBusLatLngRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    selectedBusLatLngRef.current =
      selectedBus?.lat != null && selectedBus?.lng != null
        ? { lat: selectedBus.lat, lng: selectedBus.lng }
        : null;
  });

  // Surfaced next to the map so a slow fetch reads as "still loading" rather
  // than "broken" -- the route/geometry calls can take several seconds under
  // load, and with no feedback a bus that hasn't finished loading yet looks
  // identical to one that failed.
  const [routeStatus, setRouteStatus] = useState<"idle" | "loading" | "unavailable">("idle");

  useEffect(() => {
    let cancelled = false;
    const routeId = selectedRouteId;

    async function drawRoute() {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      const routeLayer = routeLayerRef.current;
      if (cancelled || !map || !routeLayer) return;

      routeLayer.clearLayers();
      // Cleared up front, not just on failure paths below -- while this
      // selection's route is loading, the marker-redraw effect should treat
      // it as "no route yet" rather than keep fitting to the previous
      // selection's (now-stale) bounds.
      routeBoundsRef.current = null;
      if (!routeId) {
        setRouteStatus("idle");
        return;
      }
      setRouteStatus("loading");

      const res = await fetch(`/api/routes/${routeId}`);
      if (cancelled) return;
      if (!res.ok) {
        setRouteStatus("unavailable");
        return;
      }
      const data = (await res.json()) as { stops?: RouteStop[] };
      const plausibleStops = (data.stops ?? []).filter(
        (s): s is { lat: number; lng: number } =>
          s.lat != null && s.lng != null && isPlausibleTanzaniaCoord(s.lat, s.lng),
      );
      if (cancelled) return;
      if (plausibleStops.length < 2) {
        setRouteStatus("unavailable");
        return;
      }

      let latlngs: [number, number][] = plausibleStops.map((s) => [s.lat, s.lng]);
      const geomRes = await fetch("/api/routes/geometry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: plausibleStops.map((s) => ({ lat: s.lat, lng: s.lng })) }),
      });
      if (!cancelled && geomRes.ok) {
        const geomData = (await geomRes.json()) as { coordinates: [number, number][] | null };
        if (!cancelled && geomData.coordinates) {
          latlngs = geomData.coordinates.map(([lng, lat]) => [lat, lng]);
        }
      }
      if (cancelled || !routeLayerRef.current) return;
      routeBoundsRef.current = latlngs;

      routeLayer.addLayer(
        L.polyline(latlngs, {
          color: "#002368",
          weight: 5,
          opacity: 1,
          dashArray: "8 6",
        }),
      );
      for (const stop of plausibleStops) {
        routeLayer.addLayer(
          L.circleMarker([stop.lat, stop.lng], {
            radius: 4,
            color: "#002368",
            fillColor: "#80bfec",
            fillOpacity: 1,
            weight: 1.5,
          }),
        );
      }
      setRouteStatus("idle");

      // The initial click already zoomed tight on the bus alone (see the
      // marker-redraw effect above). Now that the route's actual extent is
      // known, widen the view to include it too -- a bus with a stale GPS
      // ping can genuinely be many km from the route it's assigned to, and
      // that's exactly the case worth surfacing, not hiding by leaving the
      // route to render off-screen.
      const boundsPoints = [...latlngs];
      const busLatLng = selectedBusLatLngRef.current;
      if (busLatLng) {
        boundsPoints.push([busLatLng.lat, busLatLng.lng]);
      }
      map.fitBounds(L.latLngBounds(boundsPoints).pad(0.15));
    }

    void drawRoute();
    return () => {
      cancelled = true;
    };
  }, [selectedRouteId]);

  // Draws the selected bus's actual driven path (real GPS pings), separate
  // from the assigned-route layer above. Keyed on the trip id, not on the
  // bus's live lat/lng, so this doesn't refetch on every 15s poll -- only
  // when the selection itself changes.
  useEffect(() => {
    let cancelled = false;

    async function drawTrail() {
      const L = (await import("leaflet")).default;
      const layer = trailLayerRef.current;
      if (cancelled || !layer) return;

      layer.clearLayers();
      setTrailMapsUrl(null);
      if (!selectedTripId) return;

      const res = await fetch(`/api/trips/${selectedTripId}/locations`);
      if (cancelled || !res.ok) return;
      const data = (await res.json()) as { trail?: GpsTrailPoint[] };
      const trail = data.trail ?? [];
      if (cancelled || !trailLayerRef.current) return;

      drawGpsTrail(L, trailLayerRef.current, trail);
      setTrailMapsUrl(googleMapsTrailUrl(trail));
    }

    void drawTrail();
    return () => {
      cancelled = true;
    };
  }, [selectedTripId]);

  return (
    <div className={className}>
      <div
        id={`live-map-${mapId}`}
        ref={containerRef}
        style={{ height, width: "100%" }}
        className="z-0 overflow-hidden rounded-[var(--radius)] border border-card-border"
      />
      {routeStatus === "loading" ? (
        <p className="mt-2 text-xs text-ink-faint">Loading route…</p>
      ) : null}
      {routeStatus === "unavailable" ? (
        <p className="mt-2 text-xs text-danger">
          Could not load this bus&apos;s route -- try clicking it again.
        </p>
      ) : null}
      {trailMapsUrl ? (
        <a
          href={trailMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs font-semibold text-electric-blue hover:underline"
        >
          Open this bus&apos;s trail in Google Maps →
        </a>
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
