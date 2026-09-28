/**
 * Excel Transport scan log + Bus Arrival Time algorithms.
 *
 * AM: first student picked → last student picked → bus enters school.
 * PM: last AM pickup is first drop-off; first AM pickup is last drop-off
 *     (the live PM scan order is that reverse path).
 */

export type TripRunDirection = "am" | "pm";

export type TripRunScan = {
  id: string;
  studentName: string;
  scannedAt: string;
  eventType: "in" | "out";
};

export type TripRunLeg = {
  id: string;
  index: number;
  role: "first" | "middle" | "last";
  label: string;
  studentName: string;
  scannedAt: string;
  eventType: "in" | "out";
};

export type TripRunLog = {
  direction: TripRunDirection;
  legs: TripRunLeg[];
  first: TripRunLeg | null;
  last: TripRunLeg | null;
  schoolGateAt: string | null;
  schoolGateLabel: string;
};

function firstLastLabels(direction: TripRunDirection): {
  first: string;
  last: string;
} {
  if (direction === "pm") {
    return {
      first: "First drop-off (last AM pickup)",
      last: "Last drop-off (first AM pickup)",
    };
  }
  return {
    first: "First pickup",
    last: "Last pickup",
  };
}

export function buildTripRunLog(input: {
  direction: TripRunDirection | string;
  scans: TripRunScan[];
  schoolGateAt?: string | null;
}): TripRunLog {
  const direction: TripRunDirection = input.direction === "pm" ? "pm" : "am";
  const labels = firstLastLabels(direction);
  const ordered = [...input.scans].sort(
    (a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime(),
  );

  const legs: TripRunLeg[] = ordered.map((scan, i) => {
    const isFirst = i === 0;
    const isLast = i === ordered.length - 1 && ordered.length > 0;
    const role: TripRunLeg["role"] = isFirst
      ? "first"
      : isLast
        ? "last"
        : "middle";
    return {
      id: scan.id,
      index: i + 1,
      role,
      label: isFirst
        ? labels.first
        : isLast && ordered.length > 1
          ? labels.last
          : `Scan ${i + 1}`,
      studentName: scan.studentName,
      scannedAt: scan.scannedAt,
      eventType: scan.eventType,
    };
  });

  return {
    direction,
    legs,
    first: legs[0] ?? null,
    last: legs.length > 1 ? legs[legs.length - 1]! : legs[0] ?? null,
    schoolGateAt: input.schoolGateAt ?? null,
    schoolGateLabel:
      direction === "pm" ? "Left school" : "Bus entered school",
  };
}

/** Same physical AM path, reversed for the return leg. */
export function reverseAmPickupNames(amPickupOrder: string[]): string[] {
  return [...amPickupOrder].reverse();
}

export function formatScanClock(iso: string, timeZone = "Africa/Dar_es_Salaam") {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  });
}
