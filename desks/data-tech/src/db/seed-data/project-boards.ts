type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";
type TaskPriority = "urgent" | "high" | "medium" | "low";
type SystemStatus = "active" | "in_development" | "maintenance" | "deprecated";

export type SeedTask = {
  key: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  owner?: string;
  owners?: string[];
  points?: number;
  acceptance?: string[];
  startDate?: string;
  dueDate?: string;
  comment?: string;
  dependsOn?: string[];
  archived?: boolean;
};

export type SeedSprint = {
  key: string;
  number: number;
  name: string;
  phase: string;
  status: TaskStatus;
  startDate?: string;
  dueDate?: string;
  tasks: SeedTask[];
};

export type SeedTicket = {
  issue: string;
  submitterName: string;
  submitterEmail: string;
  campus?: string;
  category: "hardware" | "software" | "network" | "access" | "facilities" | "other";
  impact: "individual" | "classroom" | "campus";
  source: "public" | "internal";
  priority: "low" | "medium" | "high" | "urgent";
  phase: "unassigned" | "in_progress" | "complete";
  linkTaskKey?: string;
  department?: string;
  owner?: string;
  internalNotes?: string;
};

export type SeedProject = {
  name: string;
  description: string;
  features: string[];
  techStack: string[];
  url?: string;
  status: SystemStatus;
  startDate: string;
  targetDate: string;
  sprints: SeedSprint[];
  tickets: SeedTicket[];
};

export function task(
  key: string,
  title: string,
  status: TaskStatus,
  extras: Partial<SeedTask> = {},
): SeedTask {
  return { key, title, status, priority: extras.priority ?? "medium", points: extras.points ?? 2, ...extras };
}

export const PROJECT_BOARDS: SeedProject[] = [
  {
    name: "Onboarding Hub",
    description:
      "SLA staff onboarding — bilingual journeys, learning items, HR admin, hiring ingest. Not Shule One.",
    features: [
      "Member section journey + checkpoints",
      "Admin CMS and completion monitoring",
      "Hiring form ingest",
      "EN / SW locale routes",
      "Live: https://sla-onboarding-hub-steel.vercel.app",
      "Local: http://localhost:3000 (also in Silverleaf Hub at /en)",
    ],
    techStack: ["Next.js", "Drizzle", "PGlite / Postgres", "next-intl"],
    url: "https://sla-onboarding-hub-steel.vercel.app",
    status: "in_development",
    startDate: "2026-06-01",
    targetDate: "2026-09-30",
    sprints: [
      {
        key: "ob-s1",
        number: 1,
        name: "Auth & identity",
        phase: "Phase 1 — Platform",
        status: "done",
        startDate: "2026-06-02",
        dueDate: "2026-06-08",
        tasks: [
          task("ob-1", "Cookie sessions for staff and admin", "done", {
            owner: "product",
            acceptance: ["httpOnly session cookie", "Staff and admin can sign in locally"],
            startDate: "2026-06-02",
            dueDate: "2026-06-04",
          }),
          task("ob-2", "Restrict sign-in to @silverleaf.co.tz", "done", {
            owner: "product",
            startDate: "2026-06-03",
            dueDate: "2026-06-05",
          }),
          task("ob-3", "Admin PIN elevation and hidden admin link", "done", {
            owner: "product",
            startDate: "2026-06-04",
            dueDate: "2026-06-06",
          }),
          task("ob-4", "Admin password change from the dashboard", "done", {
            owner: "hr",
            startDate: "2026-06-05",
            dueDate: "2026-06-08",
          }),
        ],
      },
      {
        key: "ob-s2",
        number: 2,
        name: "Data layer & i18n",
        phase: "Phase 1 — Platform",
        status: "done",
        startDate: "2026-06-09",
        dueDate: "2026-06-15",
        tasks: [
          task("ob-5", "Drizzle + embedded PGlite when DATABASE_URL is unset", "done", {
            owner: "product",
            startDate: "2026-06-09",
            dueDate: "2026-06-11",
          }),
          task("ob-6", "Vercel Postgres + Blob for production", "done", {
            owner: "product",
            startDate: "2026-06-10",
            dueDate: "2026-06-13",
          }),
          task("ob-7", "English and Swahili locale prefix routes", "done", {
            owner: "product",
            startDate: "2026-06-11",
            dueDate: "2026-06-15",
          }),
          task("ob-8", "Idempotent demo seed for members and sections", "done", {
            owner: "hr",
            startDate: "2026-06-12",
            dueDate: "2026-06-15",
          }),
        ],
      },
      {
        key: "ob-s3",
        number: 3,
        name: "Member journey",
        phase: "Phase 2 — Journey",
        status: "done",
        startDate: "2026-06-16",
        dueDate: "2026-06-29",
        tasks: [
          task("ob-9", "Sequential sections unlock after checkpoint", "done", {
            owner: "product",
            startDate: "2026-06-16",
            dueDate: "2026-06-20",
          }),
          task("ob-10", "In-hub viewer for PDF, image, video, YouTube, DOCX", "done", {
            owner: "product",
            startDate: "2026-06-18",
            dueDate: "2026-06-24",
          }),
          task("ob-11", "Mark learning item done while reading", "done", {
            owner: "product",
            startDate: "2026-06-22",
            dueDate: "2026-06-26",
          }),
          task("ob-12", "Bio prep checklist: NSSF, TIN, NHIF", "done", {
            owner: "hr",
            startDate: "2026-06-24",
            dueDate: "2026-06-29",
          }),
        ],
      },
      {
        key: "ob-s4",
        number: 4,
        name: "Admin CMS & hiring",
        phase: "Phase 3 — Admin",
        status: "done",
        startDate: "2026-07-01",
        dueDate: "2026-07-20",
        tasks: [
          task("ob-13", "HR admin content dashboard and readiness counts", "done", {
            owner: "hr",
            startDate: "2026-07-01",
            dueDate: "2026-07-08",
          }),
          task("ob-14", "Google Form hiring ingest", "done", {
            owner: "product",
            startDate: "2026-07-06",
            dueDate: "2026-07-14",
            comment: "Ingest live; fix/hiring-form-ingest (2 Sep) still unmerged to main.",
          }),
          task("ob-15", "Hired-candidate IT and welcome emails", "done", {
            owner: "hr",
            startDate: "2026-07-10",
            dueDate: "2026-07-18",
          }),
          task("ob-16", "Member monitoring: active, behind, complete", "done", {
            owner: "hr",
            startDate: "2026-07-14",
            dueDate: "2026-07-20",
          }),
        ],
      },
      {
        key: "ob-s5",
        number: 5,
        name: "Guided narrative",
        phase: "Phase 4 — Experience",
        status: "review",
        startDate: "2026-08-04",
        dueDate: "2026-08-22",
        tasks: [
          task("ob-17", "Section orientation, outcomes, and reflection prompts", "done", {
            owner: "product",
            startDate: "2026-08-04",
            dueDate: "2026-08-12",
          }),
          task("ob-18", "Welcome story chapters instead of one long CEO video", "done", {
            owner: "product",
            startDate: "2026-08-10",
            dueDate: "2026-08-18",
            comment: "Virtual chapters are in. Physical clip exports still need a comms owner.",
          }),
          task("ob-19", "Learning-item language instead of document-folder feel", "done", {
            owner: "product",
            startDate: "2026-08-12",
            dueDate: "2026-08-20",
          }),
          task("ob-20", "Stakeholder walkthrough of the member journey", "review", {
            owner: "hr",
            priority: "high",
            startDate: "2026-08-18",
            dueDate: "2026-08-22",
          }),
        ],
      },
      {
        key: "ob-s6",
        number: 6,
        name: "Meet the team videos",
        phase: "Phase 4 — Experience",
        status: "in_progress",
        startDate: "2026-08-25",
        dueDate: "2026-09-12",
        tasks: [
          task("ob-21", "Collect CEO / HoS / HR / Finance / IT source clips", "in_progress", {
            owner: "hr",
            priority: "high",
            startDate: "2026-08-25",
            dueDate: "2026-09-05",
            acceptance: ["Confirm which clips exist", "List missing owners", "Host or YouTube links ready"],
            comment: "Blocker is source video, not engineering.",
          }),
          task("ob-22", "Meet the Team cards with first-month why + contact", "todo", {
            owner: "product",
            dependsOn: ["ob-21"],
            startDate: "2026-09-01",
            dueDate: "2026-09-10",
          }),
          task("ob-23", "HOD introductions mapped to department sections", "todo", {
            owner: "hr",
            startDate: "2026-09-03",
            dueDate: "2026-09-12",
          }),
          task("ob-24", "Digital-tools screen recordings for setup tasks", "backlog", {
            owner: "product",
            startDate: "2026-09-08",
            dueDate: "2026-09-15",
          }),
        ],
      },
      {
        key: "ob-s7",
        number: 7,
        name: "Hardening & next slice",
        phase: "Phase 5 — Next",
        status: "in_progress",
        startDate: "2026-09-08",
        dueDate: "2026-09-30",
        tasks: [
          task("ob-25", "Progress celebration after each checkpoint pass", "todo", {
            owner: "product",
            startDate: "2026-09-08",
            dueDate: "2026-09-18",
          }),
          task("ob-26", "Save reflection responses (not just prompts)", "backlog", {
            owner: "product",
            startDate: "2026-09-15",
            dueDate: "2026-09-25",
          }),
          task("ob-27", "Learner and admin onboarding chatbots", "done", {
            owner: "product",
            priority: "low",
            startDate: "2026-09-20",
            dueDate: "2026-09-30",
            comment: "SLA-bot + HR-bot shipped 2 Sep 2026.",
          }),
          task("ob-28", "Vercel / identity / security runbook check", "in_progress", {
            owner: "product",
            priority: "high",
            startDate: "2026-09-08",
            dueDate: "2026-09-16",
            comment: "Live on sla-onboarding-hub.vercel.app. Custom domain and hiring-branch merge still open.",
          }),
        ],
      },
    ],
    tickets: [
      {
        issue: "New teacher cannot sign in to the Onboarding Hub — email rejected as not @silverleaf.co.tz after HR typed a gmail.",
        submitterName: "HR desk",
        submitterEmail: "hr@silverleaf.local",
        campus: "Usa River",
        category: "access",
        impact: "individual",
        source: "internal",
        priority: "high",
        phase: "in_progress",
        linkTaskKey: "ob-2",
        department: "HR",
        owner: "A",
        internalNotes:
          "Test case — Mourine / Onboarding Hub sign-in gate.\nGiven HR typed a gmail for a new teacher\nWhen they try to sign in\nThen the hub rejects the address and asks for @silverleaf.co.tz.",
      },
      {
        issue: "CEO welcome video buffers forever on the staff room wifi at Ngaramtoni.",
        submitterName: "Amina Joseph",
        submitterEmail: "amina@silverleaf.local",
        campus: "Ngaramtoni",
        category: "software",
        impact: "classroom",
        source: "public",
        priority: "medium",
        phase: "unassigned",
        linkTaskKey: "ob-18",
        department: "HR",
        owner: "A",
        internalNotes:
          "Test case — Mourine / Meet the Team clips.\nGiven the CEO welcome video on the Ngaramtoni staff-room wifi\nWhen a new hire opens the clip\nThen it plays without buffering forever.",
      },
    ],
  },
  {
    name: "School Uniforms",
    description:
      "Five-campus uniform tracker — stock, FIFO parent orders, Imani distribution, POs, Loveness sewing. Separate from Shule One.",
    features: [
      "Main warehouse + Usa River shop",
      "Parent order then pay (FIFO)",
      "Campus requests → delivery notes",
      "Sewing jobs and size velocity",
      "Live: https://school-uniforms-lyart.vercel.app",
      "Local: http://localhost:3010",
    ],
    techStack: ["Next.js", "Prisma", "SQLite / Postgres"],
    url: "https://school-uniforms-lyart.vercel.app",
    status: "in_development",
    startDate: "2026-08-26",
    targetDate: "2026-10-21",
    sprints: [
      {
        key: "un-s1",
        number: 1,
        name: "Platform & map",
        phase: "Phase 1 — Foundation",
        status: "done",
        startDate: "2026-08-26",
        dueDate: "2026-09-01",
        tasks: [
          task("un-1", "Prisma schema: campuses, warehouses, users, roles", "done", {
            owner: "A",
            acceptance: ["Campus, Location, User models exist", "prisma generate succeeds"],
            startDate: "2026-08-26",
            dueDate: "2026-08-27",
          }),
          task("un-2", "Session auth + role nav matching the system map", "done", {
            owner: "A",
            startDate: "2026-08-26",
            dueDate: "2026-08-28",
          }),
          task("un-3", "Seed five campuses, two warehouses, named desks", "done", {
            owner: "A",
            startDate: "2026-08-27",
            dueDate: "2026-08-28",
          }),
          task("un-4", "Home desk: Tailoring → Inventory → Distribution → Campuses", "done", {
            owner: "B",
            startDate: "2026-08-27",
            dueDate: "2026-08-29",
          }),
          task("un-5", "Finance and campus views as separate landings", "done", {
            owner: "B",
            startDate: "2026-08-28",
            dueDate: "2026-08-30",
          }),
          task("un-6", "README + db:setup smoke", "done", { owner: "C", startDate: "2026-08-28", dueDate: "2026-09-01" }),
        ],
      },
      {
        key: "un-s2",
        number: 2,
        name: "Catalogue & stock",
        phase: "Phase 1 — Foundation",
        status: "done",
        startDate: "2026-09-02",
        dueDate: "2026-09-08",
        tasks: [
          task("un-7", "SKU + size catalogue from master sheet", "done", { owner: "A", startDate: "2026-09-02", dueDate: "2026-09-04" }),
          task("un-8", "StockBalance and StockMove ledger", "done", { owner: "A", startDate: "2026-09-03", dueDate: "2026-09-05" }),
          task("un-9", "Stock table UI: main, shop, campus filter", "done", { owner: "B", startDate: "2026-09-03", dueDate: "2026-09-06" }),
          task("un-10", "Manual adjust + low-stock highlight", "done", { owner: "B", startDate: "2026-09-04", dueDate: "2026-09-07" }),
          task("un-11", "Opening balances from 2026 size sheet", "done", { owner: "C", startDate: "2026-09-05", dueDate: "2026-09-07" }),
          task("un-12", "Stock movement history page", "done", { owner: "C", startDate: "2026-09-06", dueDate: "2026-09-08" }),
        ],
      },
      {
        key: "un-s3",
        number: 3,
        name: "Parent order + FIFO",
        phase: "Phase 2 — Demand & issue",
        status: "done",
        startDate: "2026-09-09",
        dueDate: "2026-09-15",
        tasks: [
          task("un-13", "Student model with registration number, class, gender, campus", "done", {
            owner: "A",
            startDate: "2026-09-09",
            dueDate: "2026-09-11",
          }),
          task("un-14", "Parent catalogue + create order (no pay yet)", "done", {
            owner: "B",
            startDate: "2026-09-09",
            dueDate: "2026-09-12",
          }),
          task("un-15", "FIFO queue visible to store and parent", "done", {
            owner: "B",
            dependsOn: ["un-14"],
            startDate: "2026-09-11",
            dueDate: "2026-09-13",
            comment: "Nelly: payment date must not jump the queue.",
          }),
          task("un-16", "Payment confirmation step (order before pay)", "done", {
            owner: "C",
            dependsOn: ["un-14"],
            startDate: "2026-09-12",
            dueDate: "2026-09-14",
          }),
          task("un-17", "Staff coupon desk matching Nelly sheet columns", "done", { owner: "C", startDate: "2026-09-13", dueDate: "2026-09-15" }),
          task("un-18", "Hydrate student fields from registration number", "done", {
            owner: "A",
            dependsOn: ["un-13"],
            startDate: "2026-09-13",
            dueDate: "2026-09-15",
          }),
        ],
      },
      {
        key: "un-s4",
        number: 4,
        name: "Distribution",
        phase: "Phase 2 — Demand & issue",
        status: "done",
        startDate: "2026-09-16",
        dueDate: "2026-09-22",
        tasks: [
          task("un-19", "CampusRequest model + role rules", "done", { owner: "A", startDate: "2026-09-16", dueDate: "2026-09-18" }),
          task("un-20", "Campus request form", "done", { owner: "B", dependsOn: ["un-19"], startDate: "2026-09-17", dueDate: "2026-09-19" }),
          task("un-21", "Imani distribution desk + delivery note", "done", {
            owner: "B",
            dependsOn: ["un-19"],
            startDate: "2026-09-18",
            dueDate: "2026-09-21",
          }),
          task("un-22", "Parent issue: Received all / Received few", "done", { owner: "C", startDate: "2026-09-19", dueDate: "2026-09-21" }),
          task("un-23", "Campus incoming DN list", "done", { owner: "C", startDate: "2026-09-20", dueDate: "2026-09-22" }),
          task("un-24", "Block distribution without stock", "done", { owner: "A", startDate: "2026-09-20", dueDate: "2026-09-22" }),
        ],
      },
      {
        key: "un-s5",
        number: 5,
        name: "Purchase orders",
        phase: "Phase 3 — Money & supply",
        status: "done",
        startDate: "2026-09-23",
        dueDate: "2026-09-29",
        tasks: [
          task("un-25", "Supplier + PurchaseOrder schema", "done", { owner: "A", startDate: "2026-09-23", dueDate: "2026-09-25" }),
          task("un-26", "Raise PO UI", "done", { owner: "B", dependsOn: ["un-25"], startDate: "2026-09-24", dueDate: "2026-09-26" }),
          task("un-27", "Goods receipt into MAIN only", "done", { owner: "B", dependsOn: ["un-25"], startDate: "2026-09-25", dueDate: "2026-09-27" }),
          task("un-28", "Transfer MAIN → SHOP_USA", "done", { owner: "C", startDate: "2026-09-26", dueDate: "2026-09-28" }),
          task("un-29", "Unit cost captured on receive", "done", { owner: "C", startDate: "2026-09-26", dueDate: "2026-09-28" }),
          task("un-30", "PO status: DRAFT → SENT → PARTIAL → CLOSED", "done", { owner: "A", startDate: "2026-09-27", dueDate: "2026-09-29" }),
        ],
      },
      {
        key: "un-s6",
        number: 6,
        name: "Budget & sizes",
        phase: "Phase 3 — Money & supply",
        status: "done",
        startDate: "2026-09-30",
        dueDate: "2026-10-06",
        tasks: [
          task("un-31", "Buy vs sell vs margin report", "done", { owner: "C", startDate: "2026-09-30", dueDate: "2026-10-02" }),
          task("un-32", "Hottest sizes dashboard", "done", { owner: "B", startDate: "2026-10-01", dueDate: "2026-10-03" }),
          task("un-33", "Demand plan: enrolment × pack − on-hand", "done", { owner: "A", startDate: "2026-10-02", dueDate: "2026-10-04" }),
          task("un-34", "Budget vs committed PO vs received", "done", { owner: "C", startDate: "2026-10-03", dueDate: "2026-10-05" }),
          task("un-35", "Dead-size warning (no issues in 90 days with stock)", "done", { owner: "B", startDate: "2026-10-04", dueDate: "2026-10-06" }),
          task("un-36", "Export size velocity CSV", "done", { owner: "A", startDate: "2026-10-04", dueDate: "2026-10-06" }),
        ],
      },
      {
        key: "un-s7",
        number: 7,
        name: "Sewing",
        phase: "Phase 4 — Production & go-live",
        status: "done",
        startDate: "2026-10-07",
        dueDate: "2026-10-13",
        tasks: [
          task("un-37", "SewingJob model", "done", { owner: "A", startDate: "2026-10-07", dueDate: "2026-10-08" }),
          task("un-38", "Daily sewing tracker UI (Loveness)", "done", { owner: "B", startDate: "2026-10-08", dueDate: "2026-10-10" }),
          task("un-39", "Complete job → stock in", "done", { owner: "B", startDate: "2026-10-09", dueDate: "2026-10-11" }),
          task("un-40", "Jora / materials expense on sewing batch", "done", { owner: "C", startDate: "2026-10-10", dueDate: "2026-10-12" }),
          task("un-41", "Labour expense (tailor costs)", "done", { owner: "C", startDate: "2026-10-11", dueDate: "2026-10-13" }),
          task("un-42", "Sewing vs issued reconciliation", "done", { owner: "A", startDate: "2026-10-11", dueDate: "2026-10-13" }),
        ],
      },
      {
        key: "un-s8",
        number: 8,
        name: "Harden",
        phase: "Phase 4 — Production & go-live",
        status: "done",
        startDate: "2026-10-14",
        dueDate: "2026-10-21",
        tasks: [
          task("un-43", "Print coupon / parent order form", "done", { owner: "B", startDate: "2026-10-14", dueDate: "2026-10-16" }),
          task("un-44", "Print delivery note", "done", { owner: "B", startDate: "2026-10-15", dueDate: "2026-10-17" }),
          task("un-45", "Document Excel import snapshot process", "done", { owner: "A", startDate: "2026-10-16", dueDate: "2026-10-18" }),
          task("un-46", "Role smoke script for all desks", "done", { owner: "C", startDate: "2026-10-17", dueDate: "2026-10-19" }),
          task("un-47", "Backup / Postgres note in ROADMAP", "done", { owner: "A", startDate: "2026-10-18", dueDate: "2026-10-20" }),
          task("un-48", "CURRENT.md complete + handoff to Imani/Loveness", "done", { owner: "C", startDate: "2026-10-19", dueDate: "2026-10-21" }),
        ],
      },
      {
        key: "un-s9",
        number: 9,
        name: "After go-live",
        phase: "Phase 5 — Next",
        status: "in_progress",
        startDate: "2026-10-22",
        dueDate: "2026-11-05",
        tasks: [
          task("un-49", "Live Lipa / mobile-money API (record channel + ref in v1)", "backlog", {
            owner: "C",
            priority: "low",
            startDate: "2026-10-22",
            dueDate: "2026-11-05",
          }),
          task("un-50", "Barcodes / scanners at the shop window", "backlog", {
            owner: "B",
            priority: "low",
            startDate: "2026-10-22",
            dueDate: "2026-11-05",
          }),
          task("un-51", "Kilizona as a sixth campus — only if the five-campus map changes", "backlog", {
            owner: "A",
            priority: "low",
          }),
          task("un-52", "Production deploy (Postgres + hosting — still localhost/SQLite)", "in_progress", {
            owner: "A",
            priority: "high",
            startDate: "2026-09-10",
            dueDate: "2026-09-30",
            comment: "App is feature-complete locally. No live URL yet.",
          }),
        ],
      },
    ],
    tickets: [
      {
        issue: "Usa River shop shows size 28 shirt on hand but Imani cannot issue it on a delivery note — MAIN and shop balances disagree.",
        submitterName: "Imani",
        submitterEmail: "imani@silverleaf.local",
        campus: "Usa River",
        category: "software",
        impact: "campus",
        source: "internal",
        priority: "high",
        phase: "in_progress",
        linkTaskKey: "un-8",
        department: "Operations",
        owner: "A",
        internalNotes:
          "Test case — Mourine / TASK-008 StockBalance ledger.\nGiven size 28 shirt is on hand in the Usa River shop\nWhen Imani raises a delivery note\nThen MAIN and shop balances agree and the SKU can be issued.",
      },
      {
        issue: "Parent paid Lipa for a tracksuit but the FIFO queue still shows the order as UNPAID.",
        submitterName: "Nelly",
        submitterEmail: "nelly@silverleaf.local",
        campus: "Usa River",
        category: "software",
        impact: "individual",
        source: "internal",
        priority: "urgent",
        phase: "unassigned",
        linkTaskKey: "un-16",
        department: "Finance",
        owner: "C",
        internalNotes:
          "Test case — Irene / TASK-016 payment confirmation.\nGiven a parent paid Lipa for a tracksuit\nWhen the FIFO queue is opened\nThen the order is PAID and payment date does not jump the queue.",
      },
      {
        issue: "Kijenge head teacher cannot submit a campus uniform request — page says they may only request for Usa River.",
        submitterName: "Kijenge HT",
        submitterEmail: "kijenge.ht@silverleaf.local",
        campus: "Kijenge",
        category: "access",
        impact: "campus",
        source: "internal",
        priority: "high",
        phase: "complete",
        linkTaskKey: "un-19",
        department: "Operations",
        owner: "B",
        internalNotes:
          "Test case — Geoffrey / TASK-019–020 campus request form.\nGiven the Kijenge head teacher is signed in\nWhen they submit a campus uniform request\nThen the form accepts Kijenge, not only Usa River.",
      },
    ],
  },
  {
    name: "Marketing & Student Experience",
    description:
      "Live admissions funnel, campus marketing, Ed Admin handoff, and go-live. Student-experience incidents/dispensary still ship here until the SE board is staffed.",
    features: [
      "Lead funnel to Ed Admin",
      "Approve-before-send agent loop",
      "Incidents, walkthroughs, dispensary",
      "Public apply + calendar",
      "Live: https://sla-marketing-web.vercel.app",
      "Local: http://localhost:3180",
    ],
    techStack: ["React", "Express", "Supabase", "Vercel"],
    url: "https://sla-marketing-web.vercel.app",
    status: "active",
    startDate: "2026-07-01",
    targetDate: "2026-09-30",
    sprints: [
      {
        key: "mk-s1",
        number: 1,
        name: "Platform shell",
        phase: "Phase 1 — Platform",
        status: "done",
        startDate: "2026-07-01",
        dueDate: "2026-07-14",
        tasks: [
          task("mk-1", "Five campus codes and role dashboards", "done", { owner: "mkt", startDate: "2026-07-01", dueDate: "2026-07-06" }),
          task("mk-2", "JWT login, domain gate, forced password change", "done", { owner: "mkt", startDate: "2026-07-03", dueDate: "2026-07-08" }),
          task("mk-3", "Seed default accounts for all campus roles", "done", { owner: "mkt", startDate: "2026-07-06", dueDate: "2026-07-10" }),
          task("mk-4", "Supabase Realtime replacing Socket.IO", "done", { owner: "mkt", startDate: "2026-07-08", dueDate: "2026-07-14" }),
        ],
      },
      {
        key: "mk-s2",
        number: 2,
        name: "Lead desk",
        phase: "Phase 2 — Funnel",
        status: "done",
        startDate: "2026-07-15",
        dueDate: "2026-07-28",
        tasks: [
          task("mk-5", "Lead kanban and campaign CRUD", "done", { owner: "mkt", startDate: "2026-07-15", dueDate: "2026-07-20" }),
          task("mk-6", "Public /apply form with UTM + campaign slug", "done", { owner: "mkt", startDate: "2026-07-18", dueDate: "2026-07-24" }),
          task("mk-7", "Public calendar JSON + ICS for Wix embed", "done", { owner: "mkt", startDate: "2026-07-20", dueDate: "2026-07-26" }),
          task("mk-8", "Puffer social webhook", "done", { owner: "mkt", startDate: "2026-07-22", dueDate: "2026-07-28" }),
        ],
      },
      {
        key: "mk-s3",
        number: 3,
        name: "Funnel stages",
        phase: "Phase 2 — Funnel",
        status: "done",
        startDate: "2026-07-29",
        dueDate: "2026-08-11",
        tasks: [
          task("mk-9", "Auto stage from milestones — never set by hand", "done", { owner: "mkt", startDate: "2026-07-29", dueDate: "2026-08-03" }),
          task("mk-10", "Tour booked → interview pass/fail + rebook", "done", { owner: "mkt", startDate: "2026-08-01", dueDate: "2026-08-06" }),
          task("mk-11", "Dead-lead cron after 90 days dormant", "done", { owner: "mkt", startDate: "2026-08-04", dueDate: "2026-08-08" }),
          task("mk-12", "Parent SMS / email / WhatsApp notifications", "done", { owner: "mkt", startDate: "2026-08-06", dueDate: "2026-08-11" }),
        ],
      },
      {
        key: "mk-s4",
        number: 4,
        name: "Ed Admin handoff",
        phase: "Phase 2 — Funnel",
        status: "done",
        startDate: "2026-08-12",
        dueDate: "2026-08-25",
        tasks: [
          task("mk-13", "application-submitted webhook → form_filled", "done", { owner: "mkt", startDate: "2026-08-12", dueDate: "2026-08-16" }),
          task("mk-14", "enrolment-confirmed + payment-confirmed webhooks", "done", {
            owner: "mkt",
            dependsOn: ["mk-13"],
            startDate: "2026-08-15",
            dueDate: "2026-08-20",
          }),
          task("mk-15", "Manual mark enrolled / record payment fallbacks", "done", { owner: "mkt", startDate: "2026-08-18", dueDate: "2026-08-22" }),
          task("mk-16", "Idempotent webhooks + secret header", "done", {
            owner: "mkt",
            priority: "high",
            startDate: "2026-08-20",
            dueDate: "2026-08-25",
          }),
        ],
      },
      {
        key: "mk-s5",
        number: 5,
        name: "Student experience",
        phase: "Phase 3 — Student life",
        status: "done",
        startDate: "2026-08-18",
        dueDate: "2026-08-31",
        tasks: [
          task("mk-17", "Incidents with SMS on high/critical", "done", { owner: "se", startDate: "2026-08-18", dueDate: "2026-08-22" }),
          task("mk-18", "Safety walkthroughs + critical findings", "done", { owner: "se", startDate: "2026-08-20", dueDate: "2026-08-25" }),
          task("mk-19", "Behaviour escalation realtime event", "done", { owner: "se", startDate: "2026-08-24", dueDate: "2026-08-28" }),
          task("mk-20", "Event reports calendar", "done", { owner: "se", startDate: "2026-08-26", dueDate: "2026-08-31" }),
        ],
      },
      {
        key: "mk-s6",
        number: 6,
        name: "Dispensary",
        phase: "Phase 3 — Student life",
        status: "done",
        startDate: "2026-08-25",
        dueDate: "2026-09-05",
        tasks: [
          task("mk-21", "Visits + emergency chain", "done", { owner: "nurse", startDate: "2026-08-25", dueDate: "2026-08-28" }),
          task("mk-22", "Drug inventory and low-stock alerts", "done", { owner: "nurse", startDate: "2026-08-27", dueDate: "2026-09-01" }),
          task("mk-23", "Expiry cron ≤30 days", "done", { owner: "nurse", startDate: "2026-08-29", dueDate: "2026-09-03" }),
          task("mk-24", "Quotations → global SE approve/reject", "done", { owner: "se", startDate: "2026-09-01", dueDate: "2026-09-05" }),
        ],
      },
      {
        key: "mk-s7",
        number: 7,
        name: "Live gate & recommend loop",
        phase: "Phase 4 — Go-live",
        status: "in_progress",
        startDate: "2026-09-01",
        dueDate: "2026-09-14",
        tasks: [
          task("mk-25", "Public /api/health/live reports blockers without leaking secrets", "done", {
            owner: "mkt",
            startDate: "2026-09-01",
            dueDate: "2026-09-04",
          }),
          task("mk-26", "Staff /marketing/readiness lists phases and connection status", "done", {
            owner: "mkt",
            priority: "high",
            startDate: "2026-09-03",
            dueDate: "2026-09-08",
            acceptance: ["Placeholder API keys count as missing", "Phases from go-live-phases.json"],
            comment: "Readiness SQL + dashboard shipped 14 Sep. Live on sla-marketing-web.vercel.app.",
          }),
          task("mk-27", "Recommend loop: draft WhatsApp/SMS/email, send only after approve", "review", {
            owner: "mkt",
            priority: "high",
            dependsOn: ["mk-26"],
            startDate: "2026-09-08",
            dueDate: "2026-09-14",
            comment: "agent_loop.js is in the marketing repo. Not proven on live parent messages yet.",
          }),
          task("mk-28", "SIS occupancy reads from StudentClasses — no names stored", "todo", {
            owner: "mkt",
            startDate: "2026-09-10",
            dueDate: "2026-09-16",
          }),
        ],
      },
      {
        key: "mk-s8",
        number: 8,
        name: "Human cutover",
        phase: "Phase 4 — Go-live",
        status: "todo",
        startDate: "2026-09-15",
        dueDate: "2026-09-30",
        tasks: [
          task("mk-29", "npm run test:live covers login, leads, webhooks, approve, readiness", "todo", {
            owner: "mkt",
            startDate: "2026-09-15",
            dueDate: "2026-09-20",
          }),
          task("mk-30", "Paste real EDADMIN_API_KEY and prove one application-submitted", "todo", {
            owner: "ops",
            priority: "urgent",
            startDate: "2026-09-18",
            dueDate: "2026-09-24",
          }),
          task("mk-31", "SMTP + Africa's Talking for real parent messages", "todo", {
            owner: "ops",
            priority: "high",
            startDate: "2026-09-18",
            dueDate: "2026-09-26",
          }),
          task("mk-32", "CRON_SECRET + FRONTEND_URL + rotate leaked DB password", "todo", {
            owner: "ops",
            priority: "urgent",
            startDate: "2026-09-15",
            dueDate: "2026-09-22",
          }),
        ],
      },
    ],
    tickets: [
      {
        issue: "Public apply form on /apply returns 500 after a parent submits from a phone — marketing desk never sees the lead.",
        submitterName: "Campus marketing head",
        submitterEmail: "marketing@silverleaf.local",
        campus: "Arusha City",
        category: "software",
        impact: "campus",
        source: "internal",
        priority: "urgent",
        phase: "in_progress",
        linkTaskKey: "mk-6",
        department: "Data & Tech",
        owner: "A",
        internalNotes:
          "Test case — Mourine / public apply form.\nGiven a parent submits /apply from a phone at Arusha City\nWhen the form posts\nThen the marketing desk sees the lead and no 500 is returned.",
      },
      {
        issue: "Nurse at Usa River cannot open dispensary — account is campus_marketing_head and the role gate blocks it (expected), but they were told they had nurse access.",
        submitterName: "Usa River nurse",
        submitterEmail: "nurse.usr@silverleaf.local",
        campus: "Usa River",
        category: "access",
        impact: "individual",
        source: "internal",
        priority: "high",
        phase: "unassigned",
        linkTaskKey: "mk-2",
        department: "HR",
        owner: "C",
        internalNotes:
          "Test case — Irene / role nav.\nGiven a Usa River nurse account\nWhen they open dispensary\nThen nurse access is granted; campus_marketing_head stays blocked.",
      },
      {
        issue: "Ed Admin application-submitted webhook is 401 from production — WEBHOOK_SECRET not set on Vercel.",
        submitterName: "Data & Tech",
        submitterEmail: "kiki@silverleaf.local",
        campus: "Admin office",
        category: "software",
        impact: "campus",
        source: "internal",
        priority: "urgent",
        phase: "in_progress",
        linkTaskKey: "mk-16",
        department: "Data & Tech",
        owner: "N",
        internalNotes:
          "Test case — Nehemiah / webhook secrets.\nGiven production Vercel has WEBHOOK_SECRET\nWhen Ed Admin posts application-submitted\nThen the handler returns 2xx and the lead moves to form_filled.",
      },
    ],
  },
];
