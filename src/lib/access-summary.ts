export type AccessEventLike = {
  staffId: string;
  name: string;
  email: string;
  action: string;
  part: string | null;
  at: string;
};

export type AccessPerson = {
  staffId: string;
  name: string;
  email: string;
  lastSeenAt: string;
  lastSignInAt: string | null;
  lastDesk: string | null;
  desks: string[];
  deskVisits: number;
  signIns: number;
  eventCount: number;
};

export function summarizeAccessPeople(events: AccessEventLike[]): AccessPerson[] {
  const byStaff = new Map<string, AccessEventLike[]>();
  for (const event of events) {
    const list = byStaff.get(event.staffId) ?? [];
    list.push(event);
    byStaff.set(event.staffId, list);
  }

  return [...byStaff.values()]
    .map((list) => {
      const ordered = [...list].sort((a, b) => b.at.localeCompare(a.at));
      const latest = ordered[0];
      const desks = unique(
        ordered
          .filter((event) => event.action === "opened_desk" && event.part)
          .map((event) => event.part as string),
      );
      return {
        staffId: latest.staffId,
        name: latest.name || latest.email,
        email: latest.email,
        lastSeenAt: latest.at,
        lastSignInAt: ordered.find((event) => event.action === "signed_in")?.at ?? null,
        lastDesk: desks[0] ?? null,
        desks,
        deskVisits: ordered.filter((event) => event.action === "opened_desk").length,
        signIns: ordered.filter((event) => event.action === "signed_in").length,
        eventCount: ordered.length,
      };
    })
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export type AccessSession = {
  id: string;
  staffId: string;
  name: string;
  email: string;
  inAt: string;
  outAt: string | null;
  desks: string[];
};

export function buildAccessSessions(events: AccessEventLike[]): AccessSession[] {
  const byStaff = new Map<string, AccessEventLike[]>();
  for (const event of events) {
    const list = byStaff.get(event.staffId) ?? [];
    list.push(event);
    byStaff.set(event.staffId, list);
  }

  const sessions: AccessSession[] = [];
  for (const list of byStaff.values()) {
    const chronological = [...list].sort((a, b) => a.at.localeCompare(b.at));
    let current: AccessSession | undefined;

    for (const event of chronological) {
      const begin = (): AccessSession => ({
        id: `${event.staffId}-${event.at}`,
        staffId: event.staffId,
        name: event.name || event.email,
        email: event.email,
        inAt: event.at,
        outAt: null,
        desks: event.action === "opened_desk" && event.part ? [event.part] : [],
      });

      if (event.action === "signed_in") {
        if (current) sessions.push(current);
        current = begin();
        continue;
      }
      if (!current) current = begin();
      if (event.action === "opened_desk" && event.part && !current.desks.includes(event.part)) {
        current.desks.push(event.part);
      }
      if (event.action === "signed_out") {
        current.outAt = event.at;
        sessions.push(current);
        current = undefined;
      }
    }
    if (current) sessions.push(current);
  }

  return sessions.sort((a, b) => b.inAt.localeCompare(a.inAt));
}

export function formatStayLength(inAt: string, outAt: string | null) {
  if (!outAt) return "Still in";
  const minutes = Math.max(1, Math.round((Date.parse(outAt) - Date.parse(inAt)) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function unique(values: string[]) {
  return [...new Set(values)];
}
