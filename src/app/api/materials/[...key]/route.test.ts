/**
 * Route tests for GET /api/materials/[...key].
 *
 * Security invariant: this route streams members-only onboarding files, but
 * `src/middleware.ts` excludes `/api`, so the handler must enforce auth itself.
 * Anonymous callers get a 404 (not 401) so we never confirm key existence — and
 * crucially the storage layer must NOT be touched for an unauthenticated caller.
 *
 * `@/lib/auth` and `@/lib/storage` are fully mocked so no cookies/DB/filesystem
 * are involved; we drive `getCurrentUser` and `getStorage().read` per test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import type { CurrentUser } from "@/lib/contracts/user";

const { getCurrentUserMock, readMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  readMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ read: readMock }),
}));

// Import after the mocks are registered so the handler picks up the stubs.
import { GET } from "./route";

const MEMBER: CurrentUser = {
  id: "staff-1",
  email: "member@silverleaf.co.tz",
  fullName: "Test Member",
  isAdmin: false,
  roles: [],
  campus: null,
  jobTitle: null,
};

function req(): NextRequest {
  return new NextRequest("http://localhost/api/materials/test.pdf");
}

function ctx(key: string[]): { params: Promise<{ key: string[] }> } {
  return { params: Promise.resolve({ key }) };
}

beforeEach(() => {
  getCurrentUserMock.mockReset();
  readMock.mockReset();
});

describe("GET /api/materials/[...key]", () => {
  it("returns 404 for an anonymous caller without touching storage", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    // Even if a real file exists for this key, an anonymous caller must not get it.
    readMock.mockResolvedValue(Buffer.from("secret onboarding doc"));

    const res = await GET(req(), ctx(["test.pdf"]));

    expect(res.status).toBe(404);
    expect(readMock).not.toHaveBeenCalled();
  });

  it("streams the file for an authenticated member", async () => {
    getCurrentUserMock.mockResolvedValue(MEMBER);
    const body = Buffer.from("hello pdf");
    readMock.mockResolvedValue(body);

    const res = await GET(req(), ctx(["test.pdf"]));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const received = Buffer.from(await res.arrayBuffer());
    expect(received.equals(body)).toBe(true);
  });

  it("returns 404 when an authenticated member requests a missing key", async () => {
    getCurrentUserMock.mockResolvedValue(MEMBER);
    readMock.mockResolvedValue(null);

    const res = await GET(req(), ctx(["missing.pdf"]));

    expect(res.status).toBe(404);
  });
});
