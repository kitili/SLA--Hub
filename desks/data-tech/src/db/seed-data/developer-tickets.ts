import type { SeedTicket } from "./project-boards";

/** Named Silverleaf developers and the live work they own — used as ticket test cases. */
export const DEVELOPER_TEST_TICKETS: SeedTicket[] = [
  {
    issue:
      "Uniform tracker schema is blocking Geoffrey’s home desk — Prisma Campus, Location, and User models need to land so the Tailoring → Campuses map can render.",
    submitterName: "Geoffrey",
    submitterEmail: "geoffrey@silverleaf.local",
    campus: "Usa River",
    category: "software",
    impact: "campus",
    source: "internal",
    priority: "high",
    phase: "in_progress",
    linkTaskKey: "un-1",
    department: "Data & Tech",
    owner: "A",
    internalNotes:
      "Test case — Mourine / TASK-001 schema owner.\nGiven prisma generate succeeds\nWhen Geoffrey opens the home desk\nThen Campus, Location, and User models exist and the map can load.",
  },
  {
    issue:
      "New staff cannot finish Onboarding Hub until five campuses, two warehouses, and named desks are seeded (Imani, Loveness, finance, HT, parent).",
    submitterName: "HR desk",
    submitterEmail: "hr@silverleaf.local",
    campus: "Usa River",
    category: "access",
    impact: "campus",
    source: "internal",
    priority: "high",
    phase: "in_progress",
    linkTaskKey: "un-3",
    department: "Data & Tech",
    owner: "A",
    internalNotes:
      "Test case — Mourine / TASK-003 seed.\nGiven db:setup has run\nWhen a desk logs in\nThen five campuses, MAIN + SHOP_USA, and named desks exist.",
  },
  {
    issue:
      "SLA-bot on the Onboarding Hub should email Mourine and IT when a member flags a tech issue — currently the alarm never leaves the server.",
    submitterName: "New hire",
    submitterEmail: "fellow@silverleaf.local",
    campus: "Ngaramtoni",
    category: "software",
    impact: "individual",
    source: "public",
    priority: "medium",
    phase: "unassigned",
    department: "Data & Tech",
    owner: "A",
    internalNotes:
      "Test case — Mourine / SLA-bot tech route.\nGiven a signed-in member taps Tech in SLA-bot\nWhen they submit the issue\nThen Mourine and IT receive the email (not a stub).",
  },
  {
    issue:
      "Home desk after login is a blank shell — it must show the Tailoring (Loveness) → central inventory (Imani) → five campuses map from the 26 Aug process meeting.",
    submitterName: "Imani",
    submitterEmail: "imani@silverleaf.local",
    campus: "Usa River",
    category: "software",
    impact: "campus",
    source: "internal",
    priority: "high",
    phase: "in_progress",
    linkTaskKey: "un-4",
    department: "Operations",
    owner: "B",
    internalNotes:
      "Test case — Geoffrey / TASK-004 system-map home desk.\nGiven Imani is signed in\nWhen the home desk loads\nThen Tailoring, MAIN, SHOP_USA, and five campus stores are on the map.",
  },
  {
    issue:
      "Finance and campus landings are missing — after login, finance should land on buy/sell/margin and a campus admin should land on their store, not the warehouse desk.",
    submitterName: "Finance",
    submitterEmail: "finance@silverleaf.local",
    campus: "Usa River",
    category: "software",
    impact: "classroom",
    source: "internal",
    priority: "high",
    phase: "in_progress",
    linkTaskKey: "un-5",
    department: "Finance",
    owner: "B",
    internalNotes:
      "Test case — Geoffrey / TASK-005 finance vs campus landings.\nGiven finance vs campus-admin roles\nWhen each signs in\nThen they land on their own desk, not Imani’s warehouse.",
  },
  {
    issue:
      "Stock table cannot filter MAIN vs Usa River shop vs a campus store — Imani is counting shirts by opening three spreadsheets.",
    submitterName: "Imani",
    submitterEmail: "imani@silverleaf.local",
    campus: "Usa River",
    category: "software",
    impact: "campus",
    source: "internal",
    priority: "medium",
    phase: "unassigned",
    linkTaskKey: "un-9",
    department: "Operations",
    owner: "B",
    internalNotes:
      "Test case — Geoffrey / TASK-009 stock table UI.\nGiven stock exists at MAIN, SHOP_USA, and Kijenge\nWhen Imani filters the stock table\nThen only that location’s balances show, with low-stock highlighted.",
  },
  {
    issue:
      "Loveness needs the daily sewing tracker on the uniforms desk — sewing jobs still live in the 2026 analysis spreadsheet.",
    submitterName: "Loveness",
    submitterEmail: "loveness@silverleaf.local",
    campus: "Usa River",
    category: "software",
    impact: "classroom",
    source: "internal",
    priority: "medium",
    phase: "unassigned",
    linkTaskKey: "un-38",
    department: "Operations",
    owner: "B",
    internalNotes:
      "Test case — Geoffrey / TASK-038 daily sewing tracker.\nGiven a SewingJob for today\nWhen Loveness completes it\nThen stock in MAIN increases and the tracker shows the batch.",
  },
  {
    issue:
      "Irene cannot run db:setup from the uniforms README — smoke script fails before opening balances can be loaded from the 2026 size sheet.",
    submitterName: "Irene",
    submitterEmail: "irene@silverleaf.local",
    campus: "Admin office",
    category: "software",
    impact: "individual",
    source: "internal",
    priority: "high",
    phase: "in_progress",
    linkTaskKey: "un-6",
    department: "Finance",
    owner: "C",
    internalNotes:
      "Test case — Irene / TASK-006 README + db:setup smoke.\nGiven a clean clone\nWhen she runs the README setup\nThen the database is up and the smoke script passes.",
  },
  {
    issue:
      "Opening balances from the 2026 size sheet never landed — finance cannot trust MAIN on-hand before the first parent order.",
    submitterName: "Nelly",
    submitterEmail: "nelly@silverleaf.local",
    campus: "Usa River",
    category: "software",
    impact: "campus",
    source: "internal",
    priority: "medium",
    phase: "unassigned",
    linkTaskKey: "un-11",
    department: "Finance",
    owner: "C",
    internalNotes:
      "Test case — Irene / TASK-011 opening balances.\nGiven the 2026 size sheet snapshot\nWhen seed/import runs\nThen MAIN on-hand matches the sheet for each SKU + size.",
  },
  {
    issue:
      "Facilities desk on the Ops hub is empty — Irene’s facilities board (maintenance, assets) does not show campus work orders after the irene/facilities branch.",
    submitterName: "Campus admin",
    submitterEmail: "admin.usr@silverleaf.local",
    campus: "Usa River",
    category: "facilities",
    impact: "campus",
    source: "internal",
    priority: "high",
    phase: "in_progress",
    department: "Facilities",
    owner: "C",
    internalNotes:
      "Test case — Irene / facilities desk.\nGiven a Usa River maintenance work order\nWhen Irene opens Facilities on the Ops hub\nThen the asset and the open job are listed.",
  },
  {
    issue:
      "Staff coupon desk does not match Nelly’s sheet columns — finance cannot issue a staff uniform coupon from the new system.",
    submitterName: "Nelly",
    submitterEmail: "nelly@silverleaf.local",
    campus: "Usa River",
    category: "software",
    impact: "classroom",
    source: "internal",
    priority: "medium",
    phase: "unassigned",
    linkTaskKey: "un-17",
    department: "Finance",
    owner: "C",
    internalNotes:
      "Test case — Irene / TASK-017 staff coupon desk.\nGiven Nelly’s coupon columns\nWhen finance issues a staff coupon\nThen the row matches the sheet and stock is reserved.",
  },
  {
    issue:
      "Bus QR scans from Nehemiah’s PHP attendance.php never reach Operations — live attendance stays empty after morning pickup.",
    submitterName: "Transport",
    submitterEmail: "shikunzi@silverleaf.local",
    campus: "Usa River",
    category: "software",
    impact: "campus",
    source: "internal",
    priority: "urgent",
    phase: "in_progress",
    department: "Operations",
    owner: "N",
    internalNotes:
      "Test case — Nehemiah / PHP attendance webhook.\nGiven a scan on attendance.php\nWhen ops_webhook.php posts to /api/webhooks/attendance\nThen attendance-events.json has source nehemiah_php and the live desk updates.",
  },
  {
    issue:
      "Ops hub still reads student balances from the sheet fallback — Nehemiah MySQL is not linked, so parent phones and QR history are stale.",
    submitterName: "Finance",
    submitterEmail: "finance@silverleaf.local",
    campus: "Admin office",
    category: "software",
    impact: "campus",
    source: "internal",
    priority: "high",
    phase: "unassigned",
    department: "Data & Tech",
    owner: "N",
    internalNotes:
      "Test case — Nehemiah / MySQL link.\nGiven NEHEMIAH_DB_ENABLED=true and Settings test-db succeeds\nWhen finance opens a student\nThen live balance and parent phone come from MySQL, not the monthly sheet.",
  },
  {
    issue:
      "QR SSO from the Ops hub to finance/qrcodes.php fails — staff are asked to sign in twice and the JWT returnTo is dropped.",
    submitterName: "Go-live ops",
    submitterEmail: "ops.board@silverleaf.local",
    campus: "Admin office",
    category: "access",
    impact: "classroom",
    source: "internal",
    priority: "high",
    phase: "unassigned",
    department: "Data & Tech",
    owner: "N",
    internalNotes:
      "Test case — Nehemiah / QR SSO.\nGiven a signed-in ops user\nWhen they open /api/nehemiah/sso-url?returnTo=finance/qrcodes.php\nThen PHP accepts the JWT and they land on the QR desk without a second login.",
  },
];
