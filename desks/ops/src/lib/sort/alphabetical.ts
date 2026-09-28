/** Case-insensitive A–Z order for filter dropdowns and lists. */
export function compareAlpha(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

export function sortByAlpha<T>(
  items: readonly T[],
  label: (item: T) => string,
): T[] {
  return [...items].sort((x, y) => compareAlpha(label(x), label(y)));
}

export function sortStringsAlpha(values: readonly string[]): string[] {
  return [...values].sort(compareAlpha);
}

export function studentDisplayName(student: {
  first_name: string;
  last_name: string;
}): string {
  return `${student.first_name} ${student.last_name}`.trim();
}

/** Same order as the full name on roster cards (A–Z). */
export function compareStudentName(
  a: { first_name: string; last_name: string },
  b: { first_name: string; last_name: string },
): number {
  const byFull = compareAlpha(studentDisplayName(a), studentDisplayName(b));
  if (byFull !== 0) return byFull;
  return compareAlpha(a.first_name, b.first_name);
}

export function sortStudentsByName<
  T extends { first_name: string; last_name: string },
>(students: readonly T[]): T[] {
  return [...students].sort(compareStudentName);
}

/** Today’s trip lists: bus A–Z, then AM before PM. */
export function sortTripsTodayByBus<
  T extends { bus_label: string; direction: string },
>(trips: readonly T[]): T[] {
  return [...trips].sort((a, b) => {
    const byBus = compareAlpha(a.bus_label, b.bus_label);
    return byBus !== 0 ? byBus : compareAlpha(a.direction, b.direction);
  });
}

/** Trip history: newest date first, then bus A–Z, then direction. */
export function sortTripsHistoryByDateBus<
  T extends {
    trip_date: string;
    bus_label: string;
    direction: string;
    started_at?: string | null;
  },
>(trips: readonly T[]): T[] {
  return [...trips].sort((a, b) => {
    const byDate = b.trip_date.localeCompare(a.trip_date);
    if (byDate !== 0) return byDate;
    const byBus = compareAlpha(a.bus_label, b.bus_label);
    if (byBus !== 0) return byBus;
    const byDir = compareAlpha(a.direction, b.direction);
    if (byDir !== 0) return byDir;
    const aStart = a.started_at ? new Date(a.started_at).getTime() : 0;
    const bStart = b.started_at ? new Date(b.started_at).getTime() : 0;
    return bStart - aStart;
  });
}
