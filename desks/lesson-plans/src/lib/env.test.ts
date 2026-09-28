/**
 * env.ts boolean opt-in flags — ALLOW_DEMO_AUTH / SEARCH_TRIGRAM are STRICT:
 * only "1"/"true" (trimmed, case-insensitive) enable them.
 *
 * The regression this pins: ALLOW_DEMO_AUTH was a plain optional string and
 * consumers used `Boolean(env.ALLOW_DEMO_AUTH)`, so an operator writing
 * ALLOW_DEMO_AUTH=false (or 0) to explicitly DISABLE the demo fallback
 * instead ENABLED unverified email-only sign-in in production.
 *
 * env.ts parses process.env at module-load time, so each case re-imports the
 * module with `vi.resetModules()` after stubbing the variable.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Env } from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Re-import env.ts with `name` stubbed to `value` (or removed). */
async function loadEnvWith(
  name: "ALLOW_DEMO_AUTH" | "SEARCH_TRIGRAM",
  value: string | undefined,
): Promise<Env> {
  vi.resetModules();
  if (value === undefined) {
    delete process.env[name];
  } else {
    vi.stubEnv(name, value);
  }
  const mod = await import("./env");
  return mod.env;
}

describe("ALLOW_DEMO_AUTH strict opt-in", () => {
  it.each(["1", "true", "TRUE", " true "])(
    "%j enables the demo-auth opt-in",
    async (value) => {
      const env = await loadEnvWith("ALLOW_DEMO_AUTH", value);
      expect(env.ALLOW_DEMO_AUTH).toBe(true);
    },
  );

  it.each(["false", "0", "no", "off", "", "yes"])(
    "%j leaves the demo-auth fallback DISABLED (fail-safe)",
    async (value) => {
      const env = await loadEnvWith("ALLOW_DEMO_AUTH", value);
      expect(env.ALLOW_DEMO_AUTH).toBe(false);
    },
  );

  it("is disabled when the variable is absent", async () => {
    const env = await loadEnvWith("ALLOW_DEMO_AUTH", undefined);
    expect(env.ALLOW_DEMO_AUTH).toBe(false);
  });
});

describe("SEARCH_TRIGRAM strict opt-in", () => {
  it("enables only on 1/true", async () => {
    expect((await loadEnvWith("SEARCH_TRIGRAM", "1")).SEARCH_TRIGRAM).toBe(true);
    expect((await loadEnvWith("SEARCH_TRIGRAM", "true")).SEARCH_TRIGRAM).toBe(true);
  });

  it("stays disabled on false/0/absent", async () => {
    expect((await loadEnvWith("SEARCH_TRIGRAM", "false")).SEARCH_TRIGRAM).toBe(false);
    expect((await loadEnvWith("SEARCH_TRIGRAM", "0")).SEARCH_TRIGRAM).toBe(false);
    expect((await loadEnvWith("SEARCH_TRIGRAM", undefined)).SEARCH_TRIGRAM).toBe(false);
  });
});
