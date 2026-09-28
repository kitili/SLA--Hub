/**
 * Tests for the session-cookie codec — the HMAC-SHA256 sign/verify and
 * base64url framing that every auth decision rests on, plus the
 * SESSION_SECRET resolution rules (prod hard-error vs. insecure dev
 * fallback).
 *
 * The codec is pure (the secret is a parameter), so no env stubbing is
 * needed; `server-only` is shimmed by the Vitest config. One test forges a
 * cookie with `node:crypto` the way e2e/auth-helpers.ts does, pinning the
 * cross-implementation compatibility the e2e suite depends on.
 */
import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEV_FALLBACK_SECRET,
  decodeSession,
  encodeSession,
  resolveSessionSecret,
} from "./session-codec";

const SECRET = "unit-test-secret";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("encodeSession / decodeSession", () => {
  it("round-trips a payload", async () => {
    const cookie = await encodeSession(
      { staffId: "staff-1", adminElevated: true },
      SECRET,
    );
    // `<base64url(JSON)>.<base64url(signature)>`
    expect(cookie).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    await expect(decodeSession(cookie, SECRET)).resolves.toEqual({
      staffId: "staff-1",
      adminElevated: true,
    });
  });

  it("rejects a tampered payload (valid signature over different data)", async () => {
    const cookie = await encodeSession({ staffId: "staff-1" }, SECRET);
    const sig = cookie.slice(cookie.lastIndexOf(".") + 1);
    const forged = Buffer.from(JSON.stringify({ staffId: "staff-2" })).toString(
      "base64url",
    );
    await expect(decodeSession(`${forged}.${sig}`, SECRET)).resolves.toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const cookie = await encodeSession({ staffId: "staff-1" }, SECRET);
    const dot = cookie.lastIndexOf(".");
    const sig = cookie.slice(dot + 1);
    // Swap the last signature character for a different base64url character.
    const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    await expect(
      decodeSession(`${cookie.slice(0, dot)}.${flipped}`, SECRET),
    ).resolves.toBeNull();
  });

  it("rejects a cookie signed with a different secret", async () => {
    const cookie = await encodeSession({ staffId: "staff-1" }, SECRET);
    await expect(decodeSession(cookie, "some-other-secret")).resolves.toBeNull();
  });

  it("returns null for malformed cookie values", async () => {
    await expect(decodeSession("", SECRET)).resolves.toBeNull();
    await expect(decodeSession("no-dot-at-all", SECRET)).resolves.toBeNull();
    await expect(decodeSession("payload.", SECRET)).resolves.toBeNull();
  });

  it("returns null when a validly-signed payload is not JSON", async () => {
    const notJson = Buffer.from("not json").toString("base64url");
    const sig = createHmac("sha256", SECRET).update(notJson).digest("base64url");
    await expect(decodeSession(`${notJson}.${sig}`, SECRET)).resolves.toBeNull();
  });

  it("accepts a cookie forged with node:crypto (e2e helper compatibility)", async () => {
    // Mirrors mintSessionCookie in e2e/auth-helpers.ts — if this breaks, the
    // e2e suite's forged sessions break too.
    const json = Buffer.from(JSON.stringify({ staffId: "staff-e2e" })).toString(
      "base64url",
    );
    const sig = createHmac("sha256", SECRET).update(json).digest("base64url");
    await expect(decodeSession(`${json}.${sig}`, SECRET)).resolves.toEqual({
      staffId: "staff-e2e",
    });
  });
});

describe("resolveSessionSecret", () => {
  it("returns the configured secret unchanged", () => {
    expect(resolveSessionSecret(SECRET, "production")).toBe(SECRET);
    expect(resolveSessionSecret(SECRET, "development")).toBe(SECRET);
  });

  it("throws outside development when the secret is missing", () => {
    expect(() => resolveSessionSecret(undefined, "production")).toThrow(
      /SESSION_SECRET is not set/,
    );
    expect(() => resolveSessionSecret(undefined, "test")).toThrow(
      /SESSION_SECRET is not set/,
    );
    // An empty string is as good as unset.
    expect(() => resolveSessionSecret("", "production")).toThrow(
      /SESSION_SECRET is not set/,
    );
  });

  it("falls back to the insecure dev constant (with a warning) in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveSessionSecret(undefined, "development")).toBe(
      DEV_FALLBACK_SECRET,
    );
    expect(warn).toHaveBeenCalledOnce();
  });
});
