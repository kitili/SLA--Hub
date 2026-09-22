export type DepartmentId =
  | "onboarding"
  | "talent-academy"
  | "ops"
  | "uniforms"
  | "marketing"
  | "data-tech"
  | "visitors"
  | "workboard-tasks";

export type DepartmentPhase = 1 | 2 | 3 | 4;

export interface Department {
  id: DepartmentId;
  name: string;
  kicker: string;
  summary: string;
  phase: DepartmentPhase;
  phaseNote: string;
  href: string;
  liveUrl: string;
  localUrl: string;
  localPort: number;
  desks: string[];
  accent: "gold" | "sky" | "silver" | "navy";
  repo: string;
  branch: string;
  deskPath: string;
  /** False when the desk only runs on this computer and is not on Vercel yet. */
  hosted?: boolean;
}

/** Documented env names. Hosted desks ignore these so a laptop .env cannot retarget live sites. */
export const LIVE_ENV: Record<DepartmentId, string> = {
  onboarding: "WORKPLACE_ONBOARDING_URL",
  "talent-academy": "WORKPLACE_TALENT_ACADEMY_URL",
  ops: "WORKPLACE_OPS_URL",
  uniforms: "WORKPLACE_UNIFORMS_URL",
  marketing: "WORKPLACE_MARKETING_URL",
  "data-tech": "WORKPLACE_DATA_TECH_URL",
  visitors: "WORKPLACE_VISITORS_URL",
  "workboard-tasks": "WORKPLACE_WORKBOARD_TASKS_URL",
};

const LOCAL_ENV: Record<DepartmentId, string> = {
  onboarding: "WORKPLACE_ONBOARDING_LOCAL_URL",
  "talent-academy": "WORKPLACE_TALENT_ACADEMY_LOCAL_URL",
  ops: "WORKPLACE_OPS_LOCAL_URL",
  uniforms: "WORKPLACE_UNIFORMS_LOCAL_URL",
  marketing: "WORKPLACE_MARKETING_LOCAL_URL",
  "data-tech": "WORKPLACE_DATA_TECH_LOCAL_URL",
  visitors: "WORKPLACE_VISITORS_LOCAL_URL",
  "workboard-tasks": "WORKPLACE_WORKBOARD_TASKS_LOCAL_URL",
};

function envUrl(key: string, fallback: string) {
  const value = process.env[key]?.trim();
  return value || fallback;
}

export function isHostedDesk(department: Department) {
  return department.hosted !== false;
}

function localPortFromUrl(url: string, fallback: number) {
  try {
    return Number.parseInt(new URL(url).port, 10) || fallback;
  } catch {
    return fallback;
  }
}

export const departments: Department[] = [
  {
    id: "onboarding",
    name: "Onboarding",
    kicker: "People",
    summary:
      "Staff workplace, policies, hiring, SLA-bot, and campus onboarding — the same desk people already use to join Silverleaf.",
    phase: 1,
    phaseNote: "Always opens the live Onboarding site.",
    href: "https://sla-onboarding-hub-steel.vercel.app",
    liveUrl: "https://sla-onboarding-hub-steel.vercel.app",
    localUrl: "http://localhost:3000",
    localPort: 3000,
    desks: ["Staff onboarding", "Policies & sign-off", "Hiring board", "SLA-bot"],
    accent: "gold",
    repo: "https://github.com/kitili/SLA-Onboarding-hub.git",
    branch: "main",
    deskPath: "desks/onboarding",
  },
  {
    id: "workboard-tasks",
    name: "Workboard Tasks",
    kicker: "Daily work",
    summary:
      "Daily 5, project boards, tasks, and WhatsApp updates — the Silverleaf workboard staff already use.",
    phase: 1,
    phaseNote: "Always opens the live Workboard site.",
    href: "https://silverleaf-tasks.vercel.app",
    liveUrl: "https://silverleaf-tasks.vercel.app",
    localUrl: "http://localhost:3200",
    localPort: 3200,
    desks: ["Today", "Daily 5", "Boards", "Projects", "Tasks"],
    accent: "navy",
    repo: "https://github.com/kitili/workboard-tasks.git",
    branch: "main",
    deskPath: "desks/workboard-tasks",
  },
  {
    id: "talent-academy",
    name: "Talent Academy",
    kicker: "Teacher training",
    summary:
      "Fellows, trainers, weekly competencies, and certificates — the Silverleaf teacher training academy on this computer. Not hosted yet.",
    phase: 1,
    phaseNote: "Local only at localhost:8765. Not on Vercel yet.",
    href: "http://localhost:8765",
    liveUrl: "http://localhost:8765",
    localUrl: "http://localhost:8765",
    localPort: 8765,
    hosted: false,
    desks: ["Fellows", "Trainers", "Courses", "Certificates"],
    accent: "gold",
    repo: "https://github.com/kitili/SLA-Talent-Academy.git",
    branch: "main",
    deskPath: "desks/talent-academy",
  },
  {
    id: "ops",
    name: "Ops",
    kicker: "Campus operations",
    summary:
      "Day-to-day operations: transport, facilities, kitchen, and ticketing across campuses.",
    phase: 1,
    phaseNote: "Always opens the live Ops site.",
    href: "https://ops-transport-system.vercel.app",
    liveUrl: "https://ops-transport-system.vercel.app",
    localUrl: "http://localhost:3020",
    localPort: 3020,
    desks: ["Transport", "Facilities", "Kitchen", "Ticketing"],
    accent: "sky",
    repo: "https://github.com/kitili/OPS_SYSTEM.git",
    branch: "main",
    deskPath: "desks/ops",
  },
  {
    id: "uniforms",
    name: "Uniforms",
    kicker: "Kit & stores",
    summary:
      "Tailoring, warehouses, parent orders, purchase orders, sewing, and campus distribution.",
    phase: 1,
    phaseNote: "Always opens the live Uniforms site.",
    href: "https://school-uniforms-lyart.vercel.app",
    liveUrl: "https://school-uniforms-lyart.vercel.app",
    localUrl: "http://localhost:3010",
    localPort: 3010,
    desks: ["Stores", "Tailoring", "Parent orders", "Finance"],
    accent: "silver",
    repo: "https://github.com/kitili/school_uniforms.git",
    branch: "main",
    deskPath: "desks/uniforms",
  },
  {
    id: "marketing",
    name: "Marketing",
    kicker: "Brand & growth",
    summary:
      "Official brand, inbound leads, campus marketing, and student-experience dashboards.",
    phase: 1,
    phaseNote: "Always opens the live Marketing site.",
    href: "https://sla-marketing-web.vercel.app",
    liveUrl: "https://sla-marketing-web.vercel.app",
    localUrl: "http://localhost:3180",
    localPort: 3180,
    desks: ["Leads", "Brand channels", "Student experience", "Campuses"],
    accent: "gold",
    repo: "https://github.com/kitili/SLA-Marketing-S.E.git",
    branch: "marketing",
    deskPath: "desks/marketing",
  },
  {
    id: "data-tech",
    name: "Data & Tech",
    kicker: "Systems",
    summary:
      "Tickets, tech tools, system boards, sprints, and 1–5s — the Data & Tech workplace.",
    phase: 1,
    phaseNote: "Always opens the live Data & Tech site.",
    href: "https://dataandtech.silverleaf.co.tz",
    liveUrl: "https://dataandtech.silverleaf.co.tz",
    localUrl: "http://localhost:4050",
    localPort: 4050,
    desks: ["Tickets", "Tech tools", "Systems", "1–5s & pulse"],
    accent: "navy",
    repo: "https://github.com/kitili/silverleaf-data-and-tech.git",
    branch: "main",
    deskPath: "desks/data-tech",
  },
  {
    id: "visitors",
    name: "Visitors",
    kicker: "Front desk",
    summary:
      "Campus visitor log — sign-in, QR self check-in, history, and photos across Usa River, Arusha Modern, Kijenge, Ilboru, and Boma.",
    phase: 1,
    phaseNote: "Always opens the live Visitor Log.",
    href: "https://v-isitors.vercel.app",
    liveUrl: "https://v-isitors.vercel.app",
    localUrl: "http://localhost:3108",
    localPort: 3108,
    desks: ["Front desk", "Self check-in", "Visit history", "QR posters"],
    accent: "sky",
    repo: "https://github.com/kitili/SLA.git",
    branch: "main",
    deskPath: "desks/visitors",
  },
];

export function getDepartment(slug: string): Department | undefined {
  return departments.find((department) => department.id === slug);
}

export function isInHubApp(department: Department) {
  return department.id === "onboarding";
}

/** One click from the hub: hosted live site, or local only if not hosted yet. */
export function hubEntryHref(department: Department) {
  return entryUrl(department);
}

/** Hosted desks always use the catalog live URL. Laptop env cannot change that. */
export function entryUrl(department: Department) {
  return resolveDepartment(department).liveUrl;
}

export function isExternalUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://");
}

export function resolveDepartment(department: Department): Department {
  const localUrl = envUrl(LOCAL_ENV[department.id], department.localUrl);
  const localPort = localPortFromUrl(localUrl, department.localPort);

  if (!isHostedDesk(department)) {
    return {
      ...department,
      hosted: false,
      href: localUrl,
      liveUrl: localUrl,
      localUrl,
      localPort,
    };
  }

  const liveUrl = department.liveUrl;
  return {
    ...department,
    hosted: true,
    href: liveUrl,
    liveUrl,
    localUrl,
    localPort,
  };
}

export function resolveDepartments(): Department[] {
  return departments.map(resolveDepartment);
}

export function getLiveUrl(department: Department): string {
  return resolveDepartment(department).liveUrl;
}

export function getLocalUrl(department: Department): string {
  return resolveDepartment(department).localUrl;
}

export function isDepartmentPath(pathname: string, department: Department) {
  if (department.id === "onboarding") {
    return (
      pathname === "/en" ||
      pathname.startsWith("/en/") ||
      pathname === "/sw" ||
      pathname.startsWith("/sw/")
    );
  }
  return pathname === department.href || pathname.startsWith(`${department.href}/`);
}

export function lastDeskFromPath(pathname: string): string | null {
  if (
    pathname === "/en" ||
    pathname.startsWith("/en/") ||
    pathname === "/sw" ||
    pathname.startsWith("/sw/")
  ) {
    return "/en";
  }
  if (pathname.startsWith("/departments/")) return pathname;
  return null;
}

export const hubPhases = [
  {
    id: 1,
    title: "One front door",
    body: "This hub, official brand, email sign-in, every department one click away.",
    current: true,
  },
  {
    id: 2,
    title: "One sign-in",
    body: "Carry the hub session into the live department apps so people are not logging in twice.",
    current: false,
  },
  {
    id: 3,
    title: "Aligned desks",
    body: "Ops, Uniforms, Marketing, Data & Tech, Talent Academy, Visitors, and Workboard Tasks live in desks/ and pull from origin every day.",
    current: true,
  },
  {
    id: 4,
    title: "Ed Admin later",
    body: "Optional staff-directory check. OTP does not talk to Ed Admin yet.",
    current: false,
  },
] as const;
