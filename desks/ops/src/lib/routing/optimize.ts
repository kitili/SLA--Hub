/**
 * Nearest-neighbor + 2-opt for stop ordering (school stop stays first when present).
 */

export type OptimizePoint = {
  id: string;
  lat: number;
  lng: number;
  kind?: string;
};

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pathLengthKm(order: OptimizePoint[]): number {
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) {
    total += haversineKm(order[i], order[i + 1]);
  }
  return total;
}

export function measurePathKm(points: OptimizePoint[]): number {
  return pathLengthKm(
    points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
  );
}

function nearestNeighbor(points: OptimizePoint[]): OptimizePoint[] {
  if (points.length <= 1) return [...points];
  const remaining = [...points];
  const schoolIdx = remaining.findIndex((p) => p.kind === "school");
  const start =
    schoolIdx >= 0
      ? remaining.splice(schoolIdx, 1)[0]
      : remaining.shift()!;
  const path: OptimizePoint[] = [start];
  while (remaining.length) {
    const last = path[path.length - 1];
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(last, remaining[i]);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    path.push(remaining.splice(bestI, 1)[0]);
  }
  return path;
}

function twoOpt(path: OptimizePoint[]): OptimizePoint[] {
  if (path.length < 4) return path;
  const order = [...path];
  // Keep index 0 fixed (school / depot)
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < order.length - 2; i++) {
      for (let k = i + 1; k < order.length - 1; k++) {
        const before = pathLengthKm(order);
        const next = [
          ...order.slice(0, i),
          ...order.slice(i, k + 1).reverse(),
          ...order.slice(k + 1),
        ];
        if (pathLengthKm(next) + 1e-9 < before) {
          for (let j = 0; j < order.length; j++) order[j] = next[j];
          improved = true;
        }
      }
    }
  }
  return order;
}

export function optimizeStopOrder(points: OptimizePoint[]): {
  order: OptimizePoint[];
  distanceKm: number;
} {
  const withCoords = points.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
  );
  if (withCoords.length === 0) {
    return { order: points, distanceKm: 0 };
  }
  const missing = points.filter(
    (p) => !Number.isFinite(p.lat) || !Number.isFinite(p.lng),
  );
  const nn = nearestNeighbor(withCoords);
  const optimized = twoOpt(nn);
  return {
    order: [...optimized, ...missing],
    distanceKm: pathLengthKm(optimized),
  };
}

/** ~2.5 min per km + 3 min dwell — static ETA offsets from depot */
export function estimateEtaOffsetsMinutes(
  order: OptimizePoint[],
): number[] {
  const offsets: number[] = [];
  let minutes = 0;
  offsets.push(0);
  for (let i = 1; i < order.length; i++) {
    const km = haversineKm(order[i - 1], order[i]);
    minutes += Math.max(4, Math.round(km * 2.5 + 3));
    offsets.push(minutes);
  }
  return offsets;
}
