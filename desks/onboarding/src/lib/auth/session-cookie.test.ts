/**
 * Unit tests for session cookie encoding, expiry, and sliding idle timeout.
 *
 * Crypto is real (Web Crypto HMAC); no Next cookies/DB involved.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import {
  SESSION_SLIDE_AFTER_MS,
  SESSION_TTL_MS,
  applySessionSliding,
  buildSessionPayload,
  decodeSession,
  encodeSession,
  expiredSessionCookieOptions,
  getSessionCookieName,
  sessionCookieOptions,
  shouldSlideSession,
} from "./session-cookie";

const TEST_SECRET = "test-session-secret-at-least-32-chars!";

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", TEST_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("encodeSession / decodeSession", () => {
  it("round-trips a valid payload", async () => {
    const payload = buildSessionPayload("staff-1", Date.now(), true);
    const raw = await encodeSession(payload);
    const decoded = await decodeSession(raw);
    expect(decoded).toEqual(payload);
    expect(decoded?.isAdmin).toBe(true);
  });

  it("rejects a tampered payload", async () => {
    const raw = await encodeSession(buildSessionPayload("staff-1"));
    const [json, sig] = raw.split(".");
    const tamperedJson = Buffer.from(
      JSON.stringify({ staffId: "attacker", iat: 1, exp: Date.now() + 60_000 }),
    ).toString("base64url");
    expect(await decodeSession(`${tamperedJson}.${sig}`)).toBeNull();
    expect(await decodeSession(`${json}.not-a-real-signature`)).toBeNull();
  });

  it("rejects an expired payload", async () => {
    const raw = await encodeSession({
      staffId: "staff-1",
      iat: 1,
      exp: Date.now() - 1000,
    });
    expect(await decodeSession(raw)).toBeNull();
  });

  it("rejects a malformed cookie", async () => {
    expect(await decodeSession("")).toBeNull();
    expect(await decodeSession("no-dot")).toBeNull();
  });
});

describe("expiredSessionCookieOptions", () => {
  it("clears the cookie with the same attributes used to set it", () => {
    const live = sessionCookieOptions();
    const expired = expiredSessionCookieOptions();
    expect(expired).toEqual({ ...live, maxAge: 0 });
    expect(expired.path).toBe("/");
    expect(expired.httpOnly).toBe(true);
    expect(expired.sameSite).toBe("lax");
  });
});

describe("shouldSlideSession", () => {
  it("does not slide a freshly issued session", () => {
    const now = 1_000_000;
    const session = buildSessionPayload("staff-1", now);
    expect(shouldSlideSession(session, now)).toBe(false);
    expect(shouldSlideSession(session, now + SESSION_SLIDE_AFTER_MS - 1)).toBe(
      false,
    );
  });

  it("slides once the idle cookie is a minute old", () => {
    const now = 1_000_000;
    const session = buildSessionPayload("staff-1", now);
    expect(shouldSlideSession(session, now + SESSION_SLIDE_AFTER_MS)).toBe(true);
  });
});

describe("applySessionSliding", () => {
  function requestWithCookie(value: string): NextRequest {
    return new NextRequest("http://localhost/en", {
      headers: { cookie: `${getSessionCookieName()}=${value}` },
    });
  }

  it("leaves a fresh session cookie untouched", async () => {
    const value = await encodeSession(buildSessionPayload("staff-1"));
    const response = await applySessionSliding(
      requestWithCookie(value),
      NextResponse.next(),
    );
    expect(response.cookies.get(getSessionCookieName())).toBeUndefined();
  });

  it("rewrites a session older than the slide interval", async () => {
    const issued = Date.now() - SESSION_SLIDE_AFTER_MS - 5_000;
    const value = await encodeSession({
      staffId: "staff-1",
      isAdmin: true,
      iat: issued,
      exp: issued + SESSION_TTL_MS,
    });
    const response = await applySessionSliding(
      requestWithCookie(value),
      NextResponse.next(),
    );
    const slid = response.cookies.get(getSessionCookieName())?.value;
    expect(slid).toBeTruthy();
    expect(slid).not.toBe(value);
    const decoded = await decodeSession(slid!);
    expect(decoded?.staffId).toBe("staff-1");
    expect(decoded?.isAdmin).toBe(true);
    expect(decoded!.exp).toBeGreaterThan(Date.now() + SESSION_TTL_MS - 5_000);
  });

  it("clears an expired session cookie", async () => {
    const value = await encodeSession({
      staffId: "staff-1",
      iat: 1,
      exp: Date.now() - 1000,
    });
    const response = await applySessionSliding(
      requestWithCookie(value),
      NextResponse.next(),
    );
    const cleared = response.cookies.get(getSessionCookieName());
    expect(cleared?.value).toBe("");
  });

  it("does nothing when no session cookie is present", async () => {
    const response = await applySessionSliding(
      new NextRequest("http://localhost/en"),
      NextResponse.next(),
    );
    expect(response.cookies.get(getSessionCookieName())).toBeUndefined();
  });
});
