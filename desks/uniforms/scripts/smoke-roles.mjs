#!/usr/bin/env node
/**
 * Login every demo desk and open the pages that desk actually uses.
 * Start the app first: npm run dev
 * Usage: node scripts/smoke-roles.mjs [http://localhost:3000]
 */
const base = process.argv[2] ?? "http://localhost:3000";
const password = "Silverleaf@2026";

const desks = [
  ["ceo@silverleaf.ac.tz", ["/reports", "/reports?campus=USA", "/briefing", "/finance", "/orders", "/analytics", "/sizes", "/audit"]],
  ["imani@silverleaf.ac.tz", ["/desk", "/stock", "/orders", "/orders?q=Amina", "/distribution", "/purchase-orders", "/requests", "/sewing", "/finance", "/sizes", "/analytics", "/alerts", "/audit", "/train", "/size-chart", "/reports"]],
  ["loveness@silverleaf.ac.tz", ["/desk", "/sewing", "/stock", "/slm", "/alerts"]],
  ["usa.admin@silverleaf.ac.tz", ["/desk", "/stock", "/requests", "/orders", "/distribution", "/reports"]],
  ["am.admin@silverleaf.ac.tz", ["/desk", "/stock", "/requests"]],
  ["kijenge.ht@silverleaf.ac.tz", ["/desk", "/stock", "/requests", "/orders", "/reports"]],
  ["boma.ht@silverleaf.ac.tz", ["/desk", "/stock"]],
  ["ilboru.ht@silverleaf.ac.tz", ["/desk", "/stock"]],
  ["parent@silverleaf.ac.tz", ["/parent", "/api/parent/snapshot"]],
];

let failed = 0;

async function login(email) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  if (!res.ok) return { cookie: "", error: `${res.status}` };
  const cookie = res.headers.getSetCookie?.().join("; ") || res.headers.get("set-cookie") || "";
  return { cookie };
}

async function openPage(cookie, path) {
  const page = await fetch(`${base}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  return page.status < 400 && page.status !== 403;
}

for (const [email, paths] of desks) {
  const { cookie, error } = await login(email);
  if (error) {
    console.error(`LOGIN FAIL ${email} ${error}`);
    failed += 1;
    continue;
  }
  for (const path of paths) {
    const ok = await openPage(cookie, path);
    console.log(`${ok ? "OK" : "FAIL"} ${email} → ${path}`);
    if (!ok) failed += 1;
  }
}

async function blocked(email, path) {
  const { cookie, error } = await login(email);
  if (error) {
    console.error(`LOGIN FAIL ${email} ${error}`);
    failed += 1;
    return;
  }
  const page = await fetch(`${base}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  const ok = page.status === 303 || page.status === 302 || page.status === 307;
  console.log(`${ok ? "OK" : "FAIL"} ${email} blocked from ${path} (${page.status})`);
  if (!ok) failed += 1;
}

await blocked("loveness@silverleaf.ac.tz", "/briefing");
await blocked("ceo@silverleaf.ac.tz", "/sewing");
await blocked("ceo@silverleaf.ac.tz", "/purchase-orders");
await blocked("ceo@silverleaf.ac.tz", "/requests");
await blocked("ceo@silverleaf.ac.tz", "/stock");
await blocked("loveness@silverleaf.ac.tz", "/reports");
await blocked("loveness@silverleaf.ac.tz", "/orders");
await blocked("loveness@silverleaf.ac.tz", "/finance");
await blocked("loveness@silverleaf.ac.tz", "/distribution");
await blocked("parent@silverleaf.ac.tz", "/desk");
await blocked("kijenge.ht@silverleaf.ac.tz", "/finance");
await blocked("kijenge.ht@silverleaf.ac.tz", "/sewing");

const closed = await fetch(`${base}/finance`, { redirect: "manual" });
const gated = closed.status === 303 || closed.status === 302 || closed.status === 307;
console.log(`${gated ? "OK" : "FAIL"} guest blocked from /finance (${closed.status})`);
if (!gated) failed += 1;

async function bodyOf(email, path) {
  const { cookie, error } = await login(email);
  if (error) return { error: `login ${error}`, text: "" };
  const page = await fetch(`${base}${path}`, { headers: { cookie } });
  return { text: await page.text(), status: page.status };
}

function assertHas(label, text, needle) {
  const ok = text.includes(needle);
  console.log(`${ok ? "OK" : "FAIL"} ${label} contains “${needle}”`);
  if (!ok) failed += 1;
}

function assertLacks(label, text, needle) {
  const ok = !text.includes(needle);
  console.log(`${ok ? "OK" : "FAIL"} ${label} hides “${needle}”`);
  if (!ok) failed += 1;
}

const lovenessDesk = await bodyOf("loveness@silverleaf.ac.tz", "/desk");
assertHas("loveness /desk", lovenessDesk.text, "Usa River shop only");
assertLacks("loveness /desk", lovenessDesk.text, "Imani only");
assertLacks("loveness /desk", lovenessDesk.text, "Five campuses");

const lovenessStock = await bodyOf("loveness@silverleaf.ac.tz", "/stock");
assertLacks("loveness /stock", lovenessStock.text, "Kijenge store");
assertLacks("loveness /stock", lovenessStock.text, "Boma store");

const usaOrders = await bodyOf("usa.admin@silverleaf.ac.tz", "/orders");
assertHas("usa.admin /orders", usaOrders.text, "Amina Juma");
assertLacks("usa.admin /orders", usaOrders.text, "Daniel Mushi");
assertLacks("usa.admin /orders", usaOrders.text, "Kijenge");

const usaStock = await bodyOf("usa.admin@silverleaf.ac.tz", "/stock");
assertHas("usa.admin /stock", usaStock.text, "Usa River store");
assertLacks("usa.admin /stock", usaStock.text, "Main warehouse");
assertLacks("usa.admin /stock", usaStock.text, "Kijenge store");

const kijengeOrders = await bodyOf("kijenge.ht@silverleaf.ac.tz", "/orders");
assertHas("kijenge.ht /orders", kijengeOrders.text, "Daniel Mushi");
assertLacks("kijenge.ht /orders", kijengeOrders.text, "Amina Juma");

const parentHome = await bodyOf("parent@silverleaf.ac.tz", "/parent");
assertHas("parent /parent", parentHome.text, "ORD-1001");
assertHas("parent /parent", parentHome.text, "Amina Juma");
assertHas("parent /parent", parentHome.text, "Baraka Ally");

const parentByReg = await fetch(`${base}/api/auth/parent`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ regNo: "SLA/AM/2024/101" }),
});
const parentCookie = parentByReg.headers.getSetCookie?.().join("; ") || parentByReg.headers.get("set-cookie") || "";
const neemaOk = parentByReg.ok;
console.log(`${neemaOk ? "OK" : "FAIL"} parent login by Neema reg`);
if (!neemaOk) failed += 1;
const snap1 = await fetch(`${base}/api/parent/snapshot`, { headers: { cookie: parentCookie } });
const snap1Json = await snap1.json().catch(() => ({}));
assertHas("new parent snapshot child", JSON.stringify(snap1Json.children ?? []), "Neema Paul");
assertHas("new parent snapshot queue", JSON.stringify(snap1Json.queue ?? []), "Amina Juma");

const addSib = await fetch(`${base}/api/parent/siblings`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: parentCookie },
  body: JSON.stringify({ regNo: "SLA/KJ/2024/055" }),
});
console.log(`${addSib.ok ? "OK" : "FAIL"} add Kijenge sibling to AM parent`);
if (!addSib.ok) failed += 1;
const snap2 = await fetch(`${base}/api/parent/snapshot`, { headers: { cookie: parentCookie } });
const snap2Json = await snap2.json().catch(() => ({}));
assertHas("cross-campus family", JSON.stringify(snap2Json.children ?? []), "Daniel Mushi");
assertHas("cross-campus family keeps Neema", JSON.stringify(snap2Json.children ?? []), "Neema Paul");

const imaniNav = await bodyOf("imani@silverleaf.ac.tz", "/desk");
assertHas("imani nav", imaniNav.text, ">Ask<");
assertHas("imani nav", imaniNav.text, ">DNs<");
assertHas("imani nav", imaniNav.text, ">Sew<");
assertHas("imani nav", imaniNav.text, ">Finance<");
assertHas("imani desk", imaniNav.text, "Store &amp; finance");
// Not "Budget 2026" as one string — Next.js's RSC payload splits the label
// text and the {year} expression into separate JSON string values, so they
// never appear concatenated in the raw fetched response text.
assertHas("imani desk", imaniNav.text, "Budget");
assertHas("imani desk", imaniNav.text, String(new Date().getFullYear()));

const imaniFinanceNav = await bodyOf("imani@silverleaf.ac.tz", "/finance");
assertHas("imani finance nav", imaniFinanceNav.text, ">Orders<");
assertHas("imani finance nav", imaniFinanceNav.text, ">Year<");
assertHas("imani finance nav", imaniFinanceNav.text, ">Finance<");

const usaNav = await bodyOf("usa.admin@silverleaf.ac.tz", "/desk");
assertHas("usa nav", usaNav.text, ">DNs<");
assertHas("usa nav", usaNav.text, ">Ask<");
assertLacks("usa nav", usaNav.text, ">Finance<");

const ceoReports = await bodyOf("ceo@silverleaf.ac.tz", "/reports");
assertHas("ceo /reports", ceoReports.text, "CEO briefing");
assertHas("ceo /reports", ceoReports.text, "Campus scorecard");
assertHas("ceo /reports", ceoReports.text, "Kit coverage");
assertHas("ceo /reports", ceoReports.text, "Kijenge");
assertHas("ceo /reports", ceoReports.text, "Needs a decision");
assertHas("ceo /reports", ceoReports.text, "ORD-1001");
assertHas("ceo /reports", ceoReports.text, "weekly pack");
assertLacks("ceo /reports", ceoReports.text, "Hottest sizes");
assertLacks("ceo /reports", ceoReports.text, "Walk-in coupon");

const ceoUsa = await bodyOf("ceo@silverleaf.ac.tz", "/reports?campus=USA");
assertHas("ceo Usa drill", ceoUsa.text, "Usa River");
assertHas("ceo Usa drill", ceoUsa.text, "Kit coverage");
assertHas("ceo Usa drill", ceoUsa.text, "Leadership · Usa River");
assertLacks("ceo Usa drill", ceoUsa.text, "Daniel Mushi");
assertLacks("ceo Usa drill", ceoUsa.text, "Quiet campuses");

const ceoWeek = await bodyOf("ceo@silverleaf.ac.tz", "/briefing");
assertHas("ceo /briefing", ceoWeek.text, "Weekly pack");
assertHas("ceo /briefing", ceoWeek.text, "Kit coverage");
assertHas("ceo /briefing", ceoWeek.text, "All five campuses");

const usaSpoof = await bodyOf("usa.admin@silverleaf.ac.tz", "/reports?campus=KIJENGE");
assertHas("usa.admin ignores Kijenge query", usaSpoof.text, "Usa River");
assertLacks("usa.admin ignores Kijenge query", usaSpoof.text, "Kijenge");

const ceoNav = await bodyOf("ceo@silverleaf.ac.tz", "/reports");
assertHas("ceo nav", ceoNav.text, ">Briefing<");
assertHas("ceo nav", ceoNav.text, ">Finance<");
assertLacks("ceo nav", ceoNav.text, ">Stock<");
assertLacks("ceo nav", ceoNav.text, ">Sew<");

const imaniReports = await bodyOf("imani@silverleaf.ac.tz", "/reports");
assertHas("imani /reports", imaniReports.text, "KPI reports");
assertHas("imani /reports", imaniReports.text, "Kijenge");
assertHas("imani /reports", imaniReports.text, "ORD-1001");
assertHas("imani /reports", imaniReports.text, "By campus");

const usaReports = await bodyOf("usa.admin@silverleaf.ac.tz", "/reports");
assertHas("usa.admin /reports", usaReports.text, "Usa River");
assertHas("usa.admin /reports", usaReports.text, "ORD-1001");
assertLacks("usa.admin /reports", usaReports.text, "Kijenge");
assertLacks("usa.admin /reports", usaReports.text, "Daniel Mushi");

const kijengeReports = await bodyOf("kijenge.ht@silverleaf.ac.tz", "/reports");
assertHas("kijenge.ht /reports", kijengeReports.text, "Daniel Mushi");
assertLacks("kijenge.ht /reports", kijengeReports.text, "Amina Juma");

const imaniOrders = await bodyOf("imani@silverleaf.ac.tz", "/orders");
assertHas("imani /orders", imaniOrders.text, "Amina Juma");
assertHas("imani /orders", imaniOrders.text, "Daniel Mushi");

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log("Smoke passed.");
