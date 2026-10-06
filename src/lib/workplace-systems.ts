export type WorkplaceSystemId =
  | "hub"
  | "ops"
  | "onboarding"
  | "marketing"
  | "data-tech"
  | "talent-academy"
  | "uniforms"
  | "visitors"
  | "workboard-tasks"
  | "lesson-plans"
  | "mel-dashboard";

export type WorkplaceSystem = {
  id: WorkplaceSystemId;
  name: string;
  lane: string;
  schemaName: string;
  repoFolder: string;
  liveUrl: string;
  notes: string;
};

/** One row per system. This is the map for the repo, the hub page, and Supabase. */
export const workplaceSystems: WorkplaceSystem[] = [
  {
    id: "hub",
    name: "Hub / Code",
    lane: "CODE",
    schemaName: "shared",
    repoFolder: "src/",
    liveUrl: "https://sla-hub-nu.vercel.app",
    notes: "Front door. Hub code only. People directory is shared.people. Do not put Ops or desk tables here.",
  },
  {
    id: "ops",
    name: "Ops",
    lane: "OPS",
    schemaName: "public",
    repoFolder: "desks/ops",
    liveUrl: "https://ops-transport-system.vercel.app",
    notes: "Live Ops only: transport, facilities, kitchen, ticketing. Other systems never write here.",
  },
  {
    id: "onboarding",
    name: "Onboarding",
    lane: "ONBOARDING",
    schemaName: "onboarding",
    repoFolder: "desks/onboarding",
    liveUrl: "https://onboarding.silverleaf.co.tz",
    notes: "Staff, policies, hiring, document reads, signatures.",
  },
  {
    id: "marketing",
    name: "Marketing",
    lane: "MARKETING",
    schemaName: "marketing",
    repoFolder: "desks/marketing",
    liveUrl: "https://sla-marketing-web.vercel.app",
    notes: "Leads, brand, student experience. Isolated from Ops public.",
  },
  {
    id: "data-tech",
    name: "Data & Tech",
    lane: "DATA & TECH",
    schemaName: "data_tech",
    repoFolder: "desks/data-tech",
    liveUrl: "https://dataandtech.silverleaf.co.tz",
    notes: "Tickets, tools, system boards. Isolated from Ops public.",
  },
  {
    id: "talent-academy",
    name: "Talent Academy",
    lane: "TALENT ACADEMY",
    schemaName: "talent",
    repoFolder: "desks/talent-academy",
    liveUrl: "https://talent-academy-sla.vercel.app",
    notes: "Fellows, trainers, courses, certificates.",
  },
  {
    id: "uniforms",
    name: "Uniforms",
    lane: "UNIFORMS",
    schemaName: "uniforms",
    repoFolder: "desks/uniforms",
    liveUrl: "https://school-uniforms-lyart.vercel.app",
    notes: "Stores, tailoring, parent orders.",
  },
  {
    id: "visitors",
    name: "Visitors",
    lane: "VISITORS",
    schemaName: "visitors",
    repoFolder: "desks/visitors",
    liveUrl: "https://v-isitors.vercel.app",
    notes: "Front-desk visits. Isolated from Ops public.",
  },
  {
    id: "workboard-tasks",
    name: "1–5’s",
    lane: "1–5’S",
    schemaName: "workboard",
    repoFolder: "desks/workboard-tasks",
    liveUrl: "https://silverleaf-tasks.vercel.app",
    notes: "Today’s 1–5’s, boards, and WhatsApp updates.",
  },
  {
    id: "lesson-plans",
    name: "Lesson Plans",
    lane: "LESSON PLANS",
    schemaName: "lesson_plans",
    repoFolder: "desks/lesson-plans",
    liveUrl: "https://silverleaf-lesson-plans-main.vercel.app",
    notes: "Plans, schemes, AI studio.",
  },
  {
    id: "mel-dashboard",
    name: "MEL Dashboard",
    lane: "MEL",
    schemaName: "mel",
    repoFolder: "desks/mel-dashboard",
    liveUrl: "https://silverleafmeldashboard-production.up.railway.app/#overview",
    notes: "Live Railway site. Source was not available to copy.",
  },
];
