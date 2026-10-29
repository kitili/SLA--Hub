import { beforeEach, describe, expect, it, vi } from "vitest";

import { samplePayload } from "./fixtures";

const KEY = "s".repeat(40);

const state = vi.hoisted(() => ({
  user: null as null | { isAdmin: boolean; roles: string[] },
  stored: null as null | unknown,
  sqlConfigured: true,
  replaceCalls: 0,
  failReplace: false,
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => state.user }));
vi.mock("@/lib/env", () => ({ env: { ILD_INGEST_KEY: "s".repeat(40) } }));
vi.mock("./store", () => ({
  loadLeadershipSnapshot: async () => (state.stored ? { data: state.stored, source: "live" } : null),
  leadershipSql: () => (state.sqlConfigured ? ({} as never) : null),
  replaceLeadershipSnapshot: async (_sql: unknown, payload: { walkthroughs: unknown[]; observations: unknown[] }) => {
    if (state.failReplace) throw new Error("neon down");
    state.replaceCalls += 1;
    return { walkthroughs: payload.walkthroughs.length, observations: payload.observations.length };
  },
}));

import { GET as page } from "@/app/[locale]/leadership/route";
import { GET as data } from "@/app/api/leadership/data/route";
import { POST as ingest } from "@/app/api/leadership/ingest/route";

const ctx = (locale = "en") => ({ params: Promise.resolve({ locale }) });
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/leadership/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const auth = { authorization: `Bearer ${KEY}` };

beforeEach(() => {
  state.user = null;
  state.stored = null;
  state.sqlConfigured = true;
  state.replaceCalls = 0;
  state.failReplace = false;
});

describe("GET /[locale]/leadership", () => {
  it("sends signed-out visitors to sign-in and other staff to unauthorized", async () => {
    let res = await page(new Request("http://localhost/en/leadership"), ctx());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/en/sign-in");

    state.user = { isAdmin: false, roles: [] };
    res = await page(new Request("http://localhost/sw/leadership"), ctx("sw"));
    expect(res.headers.get("location")).toBe("http://localhost/sw/unauthorized");
  });

  it("ignores a locale it does not serve (no open redirect through the path)", async () => {
    const res = await page(new Request("http://localhost/x"), ctx("//evil.example"));
    expect(res.headers.get("location")).toBe("http://localhost/en/sign-in");
  });

  it("serves the dashboard to admins, uncached and noindex", async () => {
    state.user = { isAdmin: true, roles: ["admin"] };
    const res = await page(new Request("http://localhost/en/leadership"), ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.text()).toContain("Instructional Leadership Dashboard");
  });
});

describe("GET /api/leadership/data", () => {
  it("401 signed out, 403 for non-leaders, never the figures", async () => {
    state.stored = samplePayload();
    let res = await data();
    expect(res.status).toBe(401);
    state.user = { isAdmin: false, roles: ["campus-lead"] };
    res = await data();
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain("Grace");
  });

  it("returns the snapshot to an admin, marked as a snapshot", async () => {
    state.user = { isAdmin: true, roles: [] };
    state.stored = samplePayload();
    const res = await data();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const body = await res.json();
    expect(body.snapshot).toBe(true);
    expect(body.walkthroughs).toHaveLength(2);
  });

  it("says empty before the first push", async () => {
    state.user = { isAdmin: true, roles: [] };
    expect(await (await data()).json()).toEqual({ empty: true });
  });
});

describe("POST /api/leadership/ingest", () => {
  it("rejects a missing or wrong key before touching the body or database", async () => {
    for (const headers of [{}, { authorization: "Bearer nope" }, { authorization: `Bearer ${KEY}x` }] as Record<string, string>[]) {
      const res = await ingest(post(samplePayload(), headers));
      expect(res.status).toBe(401);
    }
    expect(state.replaceCalls).toBe(0);
  });

  it("is not usable with a signed-in admin cookie alone", async () => {
    state.user = { isAdmin: true, roles: ["admin"] };
    expect((await ingest(post(samplePayload()))).status).toBe(401);
  });

  it("stores a valid push", async () => {
    const res = await ingest(post(samplePayload(), auth));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, walkthroughs: 2, observations: 1 });
    expect(state.replaceCalls).toBe(1);
  });

  it("answers 400 for bad JSON and 422 for a payload that breaks the schema", async () => {
    expect((await ingest(post("{not json", auth))).status).toBe(400);
    const bad = samplePayload();
    bad.sources[0]!.url = "javascript:alert(1)";
    const res = await ingest(post(bad, auth));
    expect(res.status).toBe(422);
    expect(state.replaceCalls).toBe(0);
  });

  it("answers 413 for an oversized body", async () => {
    const res = await ingest(post("x".repeat(4_000_001), auth));
    expect(res.status).toBe(413);
  });

  it("answers 503 without a database and 502 (no internals) when the database fails", async () => {
    state.sqlConfigured = false;
    expect((await ingest(post(samplePayload(), auth))).status).toBe(503);
    state.sqlConfigured = true;
    state.failReplace = true;
    const res = await ingest(post(samplePayload(), auth));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("neon down");
  });
});
