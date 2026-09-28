import { type SeedProject, task } from "./project-boards";

export { task };

export const EXTRA_BOARDS: SeedProject[] = [
  {
    name: "Operations Hub",
    description:
      "Live transport is OPS_SYSTEM (matron QR, map, boarding). Kitchen/facilities/farm still sit on the older Operations_system repo.",
    features: [
      "Transport master-sheet dashboards",
      "Kitchen / farm / facilities modules",
      "Attendance webhook from PHP QR",
      "Optional Nehemiah MySQL",
      "Live: https://ops-transport-system.vercel.app",
      "Local: http://localhost:3020",
    ],
    techStack: ["Node API", "React", "PHP (legacy QR)", "Google Sheets"],
    url: "https://ops-transport-system.vercel.app",
    status: "active",
    startDate: "2026-07-01",
    targetDate: "2026-09-30",
    tickets: [],
    sprints: [
      {
        key: "op-s1",
        number: 1,
        name: "Platform shell",
        phase: "Phase 1 — Platform",
        status: "done",
        startDate: "2026-07-01",
        dueDate: "2026-07-21",
        tasks: [
          task("op-1", "JWT auth, admin-only edits, role nav", "done", {
            owner: "N",
            startDate: "2026-07-01",
            dueDate: "2026-07-08",
          }),
          task("op-2", "Group vs campus school views from the master sheet", "done", {
            owner: "A",
            startDate: "2026-07-06",
            dueDate: "2026-07-14",
          }),
          task("op-3", "Docker compose for web + API", "done", {
            owner: "N",
            startDate: "2026-07-10",
            dueDate: "2026-07-21",
          }),
        ],
      },
      {
        key: "op-s2",
        number: 2,
        name: "Desks",
        phase: "Phase 2 — Modules",
        status: "done",
        startDate: "2026-07-15",
        dueDate: "2026-08-20",
        tasks: [
          task("op-4", "Transport dashboards: fleet, GPS, buses, budget, QR", "done", {
            owner: "B",
            startDate: "2026-07-15",
            dueDate: "2026-08-01",
            comment: "Jfree / Geoffrey — transport + kitchen desks.",
          }),
          task("op-5", "Kitchen module + seed dashboards", "done", {
            owner: "B",
            startDate: "2026-07-22",
            dueDate: "2026-08-08",
          }),
          task("op-6", "Facilities assets, maintenance, QR", "done", {
            owner: "C",
            startDate: "2026-07-22",
            dueDate: "2026-08-12",
            comment: "Irene — irene/facilities.",
          }),
          task("op-7", "Farm module + seed dashboards", "done", {
            owner: "amos",
            startDate: "2026-07-22",
            dueDate: "2026-08-12",
            comment: "Amos — farms.",
          }),
          task("op-8", "PDF export for transport and operations", "done", {
            owner: "B",
            startDate: "2026-08-08",
            dueDate: "2026-08-20",
          }),
        ],
      },
      {
        key: "op-s3",
        number: 3,
        name: "Integrations",
        phase: "Phase 3 — Live links",
        status: "in_progress",
        startDate: "2026-08-18",
        dueDate: "2026-09-20",
        tasks: [
          task("op-9", "Attendance webhook PHP → /api/webhooks/attendance", "done", {
            owner: "N",
            startDate: "2026-08-18",
            dueDate: "2026-08-28",
          }),
          task("op-10", "Configure webhook secret on the PHP host", "backlog", {
            owner: "N",
            priority: "high",
            startDate: "2026-09-01",
            dueDate: "2026-09-12",
            comment: "Superseded for transport by OPS_SYSTEM. Keep only if kitchen/farm still use PHP QR.",
          }),
          task("op-11", "Link Nehemiah MySQL for live balances and parent phones", "backlog", {
            owner: "N",
            priority: "high",
            startDate: "2026-09-08",
            dueDate: "2026-09-20",
            comment: "Transport now uses Supabase on OPS_SYSTEM.",
          }),
          task("op-12", "QR SSO from ops hub to finance/qrcodes.php", "backlog", {
            owner: "N",
            startDate: "2026-09-08",
            dueDate: "2026-09-18",
          }),
          task("op-13", "Production SMTP / SMS readiness in Settings", "in_progress", {
            owner: "A",
            startDate: "2026-09-01",
            dueDate: "2026-09-16",
          }),
        ],
      },
      {
        key: "op-s4",
        number: 4,
        name: "Cutover",
        phase: "Phase 4 — Run",
        status: "in_progress",
        startDate: "2026-09-15",
        dueDate: "2026-09-30",
        tasks: [
          task("op-14", "Deploy / backup runbook (`npm run backup:data`)", "done", {
            owner: "N",
            startDate: "2026-09-01",
            dueDate: "2026-09-10",
            comment: "ops-transport-system.vercel.app is live.",
          }),
          task("op-15", "Regional school xlsx imports", "todo", {
            owner: "A",
            startDate: "2026-09-15",
            dueDate: "2026-09-28",
          }),
          task("op-16", "Module workbook templates (`npm run templates:modules`)", "done", {
            owner: "A",
            startDate: "2026-08-20",
            dueDate: "2026-09-01",
          }),
          task("op-17", "Field soft-launch: boarding scans, live GPS, parent messages", "in_progress", {
            owner: "N",
            priority: "high",
            startDate: "2026-09-14",
            dueDate: "2026-09-30",
            comment: "Pilot feedback closed after prod deploy 14 Sep. DEMO.md field walkthrough still open.",
          }),
        ],
      },
    ],
  },
  {
    name: "Student Experience",
    description:
      "Incidents, safety walkthroughs, and dispensary already ship inside Marketing. This board is the split-out — not staffed yet.",
    features: ["Incidents + SMS", "Safety walkthroughs", "Dispensary visits and stock", "Behaviour escalation"],
    techStack: ["React", "Express", "Supabase"],
    status: "in_development",
    startDate: "2026-09-15",
    targetDate: "2026-10-31",
    tickets: [],
    sprints: [
      {
        key: "se-s1",
        number: 1,
        name: "Stand-up",
        phase: "Phase 1 — Start soon",
        status: "backlog",
        startDate: "2026-09-15",
        dueDate: "2026-10-15",
        tasks: [
          task("se-1", "Incidents with SMS on high/critical", "backlog", { priority: "high" }),
          task("se-2", "Safety walkthroughs + critical findings", "backlog"),
          task("se-3", "Behaviour escalation realtime event", "backlog"),
          task("se-4", "Event reports calendar", "backlog"),
          task("se-5", "Dispensary visits + emergency chain", "backlog"),
          task("se-6", "Drug inventory, low-stock, and expiry ≤30 days", "backlog"),
        ],
      },
    ],
  },
  {
    name: "Expansion",
    description: "New campuses and regional roll-out after the five-campus core is stable.",
    features: ["Sixth-campus map", "Regional ops imports", "Onboarding pack for a new site"],
    techStack: ["Next.js", "Ops Hub"],
    status: "in_development",
    startDate: "2026-10-01",
    targetDate: "2026-12-15",
    tickets: [],
    sprints: [
      {
        key: "ex-s1",
        number: 1,
        name: "Scope the next site",
        phase: "Phase 1 — Plan",
        status: "todo",
        startDate: "2026-10-01",
        dueDate: "2026-10-31",
        tasks: [
          task("ex-1", "Decide whether Kilizona joins the five-campus map", "backlog", {
            owners: ["A", "N"],
            priority: "low",
          }),
          task("ex-2", "Regional ops workbook import for a non-Silverleaf school", "todo", {
            owners: ["A", "N"],
          }),
          task("ex-3", "New-campus onboarding pack (accounts, desks, uniforms, hub)", "todo", {
            owners: ["A", "N"],
            priority: "high",
          }),
          task("ex-4", "Network and Google Workspace for a new site", "todo", {
            owners: ["A", "N"],
          }),
        ],
      },
    ],
  },
  {
    name: "Agentic",
    description:
      "Subsidiary of Marketing — Cowork agent over the Marketing & Partnerships process map (3-week SOW). Requirements on Mourine; coding on Amos. CRM / WhatsApp Business API / website rebuild are out of scope.",
    features: [
      "Repository + Cowork sync",
      "Nine of ten process-map workflows",
      "Approval-gated campaign briefs",
      "Brand, metrics ledger, 30/60/90",
    ],
    techStack: ["Git repo", "Cowork", "AGENTS.md / CLAUDE.md"],
    status: "in_development",
    startDate: "2026-09-08",
    targetDate: "2026-09-28",
    tickets: [],
    sprints: [
      {
        key: "ag-s1",
        number: 1,
        name: "Foundation",
        phase: "Stage 1 — Requirements",
        status: "todo",
        startDate: "2026-09-08",
        dueDate: "2026-09-14",
        tasks: [
          task("ag-1", "Kickoff: walk the process map and confirm the accountability map", "todo", {
            owner: "A",
            priority: "high",
            acceptance: ["Erick and Mariam walkthrough", "Named decision-maker per approval gate"],
          }),
          task("ag-2", "Performance baseline from the last three campaigns", "todo", {
            owner: "A",
            priority: "high",
          }),
          task("ag-3", "Brand starter, tone of voice, audience segments, campus context library", "todo", {
            owner: "A",
          }),
          task("ag-4", "Write requirements: 10 process-map coverages and named exclusions", "todo", {
            owner: "A",
            priority: "high",
            acceptance: [
              "Full content/workflow for 8 processes",
              "Lead CRM is interface-only",
              "No WhatsApp Business API, no Wix rebuild",
            ],
          }),
          task("ag-5", "Approval-chain requirements (brief → gate → publish)", "todo", {
            owner: "A",
            priority: "high",
          }),
        ],
      },
      {
        key: "ag-s2",
        number: 2,
        name: "Build",
        phase: "Stage 2 — Coding",
        status: "todo",
        startDate: "2026-09-15",
        dueDate: "2026-09-21",
        tasks: [
          task("ag-6", "Private git repo with folder architecture, sync, and merge rules", "todo", {
            owner: "amos",
            priority: "high",
            dependsOn: ["ag-4"],
          }),
          task("ag-7", "Cowork on team machines — full sync cycle proven", "todo", {
            owner: "amos",
            priority: "high",
            dependsOn: ["ag-6"],
          }),
          task("ag-8", "AGENTS.md / CLAUDE.md / README for capture, approval, folder semantics", "todo", {
            owner: "amos",
            dependsOn: ["ag-6"],
          }),
          task("ag-9", "Ten workflow skills covering nine Process Map processes", "todo", {
            owner: "amos",
            priority: "high",
            dependsOn: ["ag-4", "ag-6"],
          }),
          task("ag-10", "Brief and campaign templates across eight channels", "todo", {
            owner: "amos",
            dependsOn: ["ag-9"],
          }),
          task("ag-11", "Approval schema, restricted content rules, consent register", "todo", {
            owner: "amos",
            priority: "high",
            dependsOn: ["ag-5", "ag-6"],
          }),
          task("ag-12", "Partnership pipeline + event workflow + metrics ledger", "todo", {
            owner: "amos",
            dependsOn: ["ag-9"],
          }),
        ],
      },
      {
        key: "ag-s3",
        number: 3,
        name: "Adoption",
        phase: "Stage 3 — Handoff",
        status: "todo",
        startDate: "2026-09-22",
        dueDate: "2026-09-28",
        tasks: [
          task("ag-13", "Hands-on session with Erick and Mariam, recorded", "todo", {
            owner: "A",
            dependsOn: ["ag-9"],
          }),
          task("ag-14", "Plain-language runbook + 30/60/90 roadmap", "todo", {
            owner: "A",
            dependsOn: ["ag-9"],
          }),
          task("ag-15", "Portability test against a second AI vendor", "todo", {
            owner: "amos",
            dependsOn: ["ag-6"],
          }),
          task("ag-16", "Team runs one full campaign without the consultant", "todo", {
            owner: "A",
            priority: "high",
            dependsOn: ["ag-13"],
          }),
        ],
      },
    ],
  },
];
