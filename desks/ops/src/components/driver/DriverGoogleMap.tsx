"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  getGoogleMapsBrowserKey,
  loadGoogleMaps,
} from "@/lib/maps/load-google-maps";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/geo/mapDefaults";
import { isPlausibleTanzaniaCoord } from "@/lib/geo/plausible-coord";
import { googleMapsDirectionsUrl } from "@/lib/driver/stop-labels";

export type DriverMapStop = {
  id: string;
  name: string;
  order: number;
  lat: number | null;
  lng: number | null;
};

type DriverLoc = {
  lat: number;
  lng: number;
  heading?: number | null;
};

type Props = {
  stops: DriverMapStop[];
  driverLocation?: DriverLoc | null;
  height?: string;
  className?: string;
};

/**
 * Driver Path map — Google road directions + live GPS blue-dot.
 * No numbered stop pins (route order ≠ child boarding roster).
 */
export function DriverGoogleMap({
  stops,
  driverLocation = null,
  height = "min(52vh, 28rem)",
  className = "",
}: Props) {
  const mapId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const accuracyCircleRef = useRef<google.maps.Circle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const keyPresent = Boolean(getGoogleMapsBrowserKey());

  const withCoords = useMemo(
    () =>
      stops.filter(
        (s): s is DriverMapStop & { lat: number; lng: number } =>
          s.lat != null &&
          s.lng != null &&
          Number.isFinite(s.lat) &&
          Number.isFinite(s.lng) &&
          isPlausibleTanzaniaCoord(s.lat, s.lng),
      ),
    [stops],
  );

  const suspectCount = useMemo(
    () =>
      stops.filter(
        (s) =>
          s.lat != null &&
          s.lng != null &&
          Number.isFinite(s.lat) &&
          Number.isFinite(s.lng) &&
          !isPlausibleTanzaniaCoord(s.lat, s.lng),
      ).length,
    [stops],
  );

  const coordsSignature = useMemo(
    () => withCoords.map((s) => `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`).join("|"),
    [withCoords],
  );

  const driverOriginSig = useMemo(() => {
    if (!driverLocation) return "";
    // Coarse signature so we don't re-route on every GPS tick — ~40m buckets.
    return `${driverLocation.lat.toFixed(3)},${driverLocation.lng.toFixed(3)}`;
  }, [driverLocation]);

  const externalUrl = useMemo(
    () =>
      googleMapsDirectionsUrl({
        stops: withCoords,
        origin: driverLocation
          ? { lat: driverLocation.lat, lng: driverLocation.lng }
          : null,
      }),
    [withCoords, driverLocation],
  );

  useEffect(() => {
    if (!keyPresent || !containerRef.current) return;
    let cancelled = false;

    async function init() {
      try {
        const g = await loadGoogleMaps(["maps"]);
        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = new g.maps.Map(containerRef.current, {
          center: {
            lat: DEFAULT_MAP_CENTER.lat,
            lng: DEFAULT_MAP_CENTER.lng,
          },
          zoom: DEFAULT_MAP_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });

        const renderer = new g.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          preserveViewport: false,
          polylineOptions: {
            strokeColor: "#1a73e8",
            strokeWeight: 5,
            strokeOpacity: 0.95,
          },
        });

        mapRef.current = map;
        rendererRef.current = renderer;
        setReady(true);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load Google Maps");
        setReady(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [keyPresent]);

  // Actual Google driving path — origin is live GPS when available.
  useEffect(() => {
    if (!ready || !mapRef.current || !rendererRef.current) return;
    const g = (window as Window & { google?: typeof google }).google;
    if (!g?.maps) return;

    if (withCoords.length === 0) {
      rendererRef.current.set("directions", null);
      return;
    }

    if (withCoords.length === 1 && !driverLocation) {
      rendererRef.current.set("directions", null);
      mapRef.current.setCenter({
        lat: withCoords[0].lat,
        lng: withCoords[0].lng,
      });
      mapRef.current.setZoom(15);
      return;
    }

    const gpsOrigin =
      driverLocation &&
      Number.isFinite(driverLocation.lat) &&
      Number.isFinite(driverLocation.lng)
        ? { lat: driverLocation.lat, lng: driverLocation.lng }
        : null;

    const origin = gpsOrigin ?? {
      lat: withCoords[0].lat,
      lng: withCoords[0].lng,
    };
    const destination = withCoords[withCoords.length - 1];
    // When GPS is origin, all stops become waypoints (cap at Google's 25).
    const waypointStops = gpsOrigin
      ? withCoords.slice(0, -1)
      : withCoords.slice(1, -1);
    const waypoints = waypointStops.slice(0, 23).map((s) => ({
      location: { lat: s.lat, lng: s.lng },
      stopover: true,
    }));

    const service = new g.maps.DirectionsService();
    void service.route(
      {
        origin,
        destination: { lat: destination.lat, lng: destination.lng },
        waypoints,
        travelMode: g.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status === g.maps.DirectionsStatus.OK && result && rendererRef.current) {
          rendererRef.current.setDirections(result);
          setError(null);
        } else if (status !== g.maps.DirectionsStatus.OK) {
          setError("Could not draw the Google driving route for these stops.");
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, coordsSignature, driverOriginSig]);

  // Live driver GPS (blue dot).
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = (window as Window & { google?: typeof google }).google;
    if (!g?.maps || !driverLocation) return;

    const pos = { lat: driverLocation.lat, lng: driverLocation.lng };
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new g.maps.Marker({
        map: mapRef.current,
        position: pos,
        zIndex: 10,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: "#1a73e8",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
        title: "You",
      });
    } else {
      driverMarkerRef.current.setPosition(pos);
    }

    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = new g.maps.Circle({
        map: mapRef.current,
        center: pos,
        radius: 25,
        strokeColor: "#1a73e8",
        strokeOpacity: 0.35,
        strokeWeight: 1,
        fillColor: "#1a73e8",
        fillOpacity: 0.12,
        clickable: false,
        zIndex: 1,
      });
    } else {
      accuracyCircleRef.current.setCenter(pos);
    }

    if (
      typeof driverLocation.heading === "number" &&
      Number.isFinite(driverLocation.heading)
    ) {
      driverMarkerRef.current.setIcon({
        path: g.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 5,
        fillColor: "#1a73e8",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        rotation: driverLocation.heading,
      });
    }

    mapRef.current.panTo(pos);
  }, [ready, driverLocation]);

  if (!keyPresent) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-[1.2rem] border border-card-border bg-[#e8f0fe] px-4 text-center ${className}`}
        style={{ height }}
      >
        <p className="font-display text-lg font-bold text-[#174ea6]">
          Google Maps
        </p>
        <p className="max-w-sm text-sm text-[#3c4043]">
          Add a Google Maps key so the in-app road path and live GPS can show.
          Until then, open the route in Google Maps.
        </p>
        {externalUrl ? (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-11 rounded-xl bg-[#1a73e8] px-5 text-sm font-bold text-white no-underline"
          >
            Open route in Google Maps
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        id={`driver-gmap-${mapId}`}
        ref={containerRef}
        style={{ height, width: "100%" }}
        className="z-0 overflow-hidden rounded-[1.2rem] border border-card-border shadow-[var(--shadow)]"
      />
      {suspectCount > 0 ? (
        <p className="mt-2 text-center text-xs font-semibold text-danger">
          {suspectCount} stop{suspectCount === 1 ? "" : "s"} excluded from the
          road path (coordinates look wrong). Ask transport to fix them.
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-center text-xs text-ink-muted">{error}</p>
      ) : null}
    </div>
  );
}
