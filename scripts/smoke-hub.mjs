#!/usr/bin/env node
/**
 * Live smoke test for Silverleaf Hub on localhost:3100.
 * Requires `npm run dev`. Covers sign-in, every desk, access log, and live Workboard.
 */

const BASE = process.env.SMOKE_BASE || "http://127.0.0.1:3100";
const WORKBOARD_LIVE = process.env.SMOKE_WORKBOARD_URL || "https://silverleaf-tasks.vercel.app";

const DESKS = [
  { id: "onboarding", name: "Onboarding", location: /^https:\/\/sla-onboarding-hub-steel\.vercel\.app/ },
  { id: "talent-academy", name: "Talent Academy", location: /^http:\/\/localhost:8765/ },
  { id: "ops", name: "Ops", location: /^https:\/\/ops-transport-system\.vercel\.app/ },
  { id: "uniforms", name: "Uniforms", location: /^https:\/\/school-uniforms-lyart\.vercel\.app/ },
  { id: "marketing", name: "Marketing", location: /^https:\/\/sla-marketing-web\.vercel\.app/ },
  { id: "data-tech", name: "Data & Tech", location: /^https:\/\/dataandtech\.silverleaf\.co\.tz/ },
  { id: "visitors", name: "Visitors", location: /^https:\/\/v-isitors\.vercel\.app/ },
  { id: "workboard-tasks", name: "Workboard Tasks", location: /^https:\/\/silverleaf-tasks\.vercel\.app/ },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cookieFrom(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  const parts = raw.length
    ? raw
    : [response.headers.get("set-cookie")].filter(Boolean);
  return parts
    .map((value) => value.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function req(path, options = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const response = await fetch(url, {
    redirect: options.redirect ?? "manual",
    headers: options.headers,
    method: options.method ?? "GET",
  });
  const text = await response.text();
  return {
    status: response.status,
    location: response.headers.get("location") || "",
    setCookie: cookieFrom(response),
    text,
  };
}

function isRedirect(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

async function main() {
  const checks = [];

  const login = await req("/login");
  assert(login.status === 200, `/login expected 200, got ${login.status}`);
  assert(/sign in|work email|Silverleaf/i.test(login.text), "/login missing sign-in copy");
  checks.push("login page");

  const gated = await req("/hub");
  assert(isRedirect(gated.status), `/hub should redirect when signed out, got ${gated.status}`);
  assert(gated.location.includes("login"), `/hub signed-out redirect was ${gated.location}`);
  checks.push("hub requires sign-in");

  const signIn = await req("/api/dev/local-login?as=admin");
  assert(isRedirect(signIn.status), `local-login expected redirect, got ${signIn.status}`);
  assert(signIn.setCookie, "local-login did not set a session cookie");
  const cookie = signIn.setCookie;
  checks.push("admin sign-in");

  const hub = await req("/hub", { headers: { cookie } });
  assert(hub.status === 200, `/hub expected 200, got ${hub.status}`);
  assert(hub.text.includes("Who entered"), "/hub missing Who entered");
  const hubText = hub.text.replaceAll("&amp;", "&");
  for (const desk of DESKS) {
    assert(hubText.includes(desk.name), `/hub missing ${desk.name}`);
  }
  checks.push("hub desks");

  const activity = await req("/activity", { headers: { cookie } });
  assert(activity.status === 200, `/activity expected 200, got ${activity.status}`);
  assert(/signed in|opened hub|entered/i.test(activity.text), "/activity has no access events");
  checks.push("activity log");

  const onboarding = await req("/en", { headers: { cookie } });
  assert(onboarding.status === 200, `/en expected 200, got ${onboarding.status}`);
  assert(/onboarding|welcome/i.test(onboarding.text), "/en missing onboarding dashboard");
  checks.push("onboarding");

  const missing = await req("/departments/not-a-desk", { headers: { cookie } });
  assert(missing.status === 404, `/departments/not-a-desk expected 404, got ${missing.status}`);
  checks.push("unknown desk 404");

  for (const desk of DESKS) {
    const opened = await req(`/departments/${desk.id}`, { headers: { cookie } });
    assert(isRedirect(opened.status), `/departments/${desk.id} expected redirect, got ${opened.status}`);
    assert(
      desk.location.test(opened.location),
      `/departments/${desk.id} redirected to ${opened.location}`,
    );
    checks.push(`${desk.name} desk`);
  }

  const afterDesk = await req("/activity", { headers: { cookie } });
  assert(/Onboarding|Visitors|Workboard|Opened hub/i.test(afterDesk.text), "activity log did not record a desk");
  assert(/Workboard/i.test(afterDesk.text), "activity log did not record Workboard Tasks");
  checks.push("desk recorded");

  const adminActivity = await req("/en/admin/activity", { headers: { cookie } });
  assert(adminActivity.status === 200, `/en/admin/activity expected 200, got ${adminActivity.status}`);
  checks.push("admin activity");

  const workboard = await req(WORKBOARD_LIVE);
  assert(workboard.status === 200, `live Workboard expected 200, got ${workboard.status}`);
  assert(
    /Silverleaf Tasks|work email|Staff ID|sign in/i.test(workboard.text),
    "live Workboard missing Silverleaf Tasks sign-in",
  );
  checks.push("live workboard");

  const workboardLogin = await req(`${WORKBOARD_LIVE.replace(/\/$/, "")}/login`);
  assert(workboardLogin.status === 200, `live Workboard /login expected 200, got ${workboardLogin.status}`);
  checks.push("live workboard login");

  console.log(`smoke ok  ${BASE}`);
  for (const name of checks) console.log(`  pass  ${name}`);
}

main().catch((error) => {
  console.error(`smoke failed: ${error.message}`);
  process.exit(1);
});
