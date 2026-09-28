export const MODULE_KEYS = [
  "tickets",
  "tech_tools",
  "systems",
  "users",
  "departments",
  "support_contacts",
  "ticket_notifications",
  "one_to_fives",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export type AccessLevel = "view" | "manage";
export type UserModules = Partial<Record<ModuleKey, AccessLevel>>;

export const MODULE_LABELS: Record<ModuleKey, string> = {
  tickets: "Tickets",
  tech_tools: "Tech Tools",
  systems: "Systems",
  users: "Users",
  departments: "Departments",
  support_contacts: "Support Contacts",
  ticket_notifications: "Ticket Notifications",
  one_to_fives: "1–5s & pulse",
};

const LEVEL_RANK: Record<AccessLevel, number> = { view: 1, manage: 2 };

export const DATA_TECH_DEPARTMENT = "Data & Tech";

/** Everyone in Data & Tech can use this app — projects, tickets, tech tools, and 1–5s. */
export const DATA_TECH_STAFF_MODULES: UserModules = {
  tickets: "view",
  tech_tools: "view",
  systems: "view",
  one_to_fives: "view",
};

function higherLevel(a: AccessLevel | undefined, b: AccessLevel | undefined): AccessLevel | undefined {
  if (!a) return b;
  if (!b) return a;
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

export function withDataTechModules(modules: UserModules, departmentName: string | null | undefined): UserModules {
  if (!departmentName || departmentName.toLowerCase() !== DATA_TECH_DEPARTMENT.toLowerCase()) {
    return { ...modules };
  }
  const merged: UserModules = { ...modules };
  for (const [module, floor] of Object.entries(DATA_TECH_STAFF_MODULES) as [ModuleKey, AccessLevel][]) {
    const next = higherLevel(merged[module], floor);
    if (next) merged[module] = next;
  }
  return merged;
}

// role === "admin" bypasses this — check that separately at the call site.
export function hasModuleAccess(modules: UserModules, module: ModuleKey, minLevel: AccessLevel = "view") {
  const level = modules[module];
  return Boolean(level) && LEVEL_RANK[level!] >= LEVEL_RANK[minLevel];
}
