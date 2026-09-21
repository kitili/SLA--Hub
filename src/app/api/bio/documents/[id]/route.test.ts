/**
 * Route tests for GET /api/bio/documents/[id].
 *
 * Security invariant: a member-uploaded certificate is PII and may be fetched
 * ONLY by its owner or an admin. Everyone else — anonymous, or a different
 * signed-in member — gets a 404 (never 401/403), and the storage layer must NOT
 * be touched for them, so the endpoint never confirms a document id exists.
 *
 * `@/lib/auth`, `@/lib/storage`, and the bio-documents query are mocked so no
 * cookies/DB/filesystem are involved.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import type { CurrentUser } from "@/lib/contracts/user";

const { getCurrentUserMock, readMock, getDocMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  readMock: vi.fn(),
  getDocMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ read: readMock }),
}));

vi.mock("@/lib/db/queries/bio-documents", () => ({
  getMemberDocumentWithOwner: getDocMock,
}));

// Import after the mocks are registered so the handler picks up the stubs.
import { GET } from "./route";

function user(id: string, isAdmin = false): CurrentUser {
  return {
    id,
    email: `${id}@silverleaf.co.tz`,
    fullName: id,
    isAdmin,
    roles: isAdmin ? ["admin"] : [],
    campus: null,
    jobTitle: null,
  };
}

function req(): NextRequest {
  return new NextRequest("http://localhost/api/bio/documents/doc-1");
}

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

/** A document owned by staff "owner-1". */
function ownedDoc() {
  return {
    document: {
      id: "doc-1",
      memberProfileId: "profile-1",
      documentType: "Qualification Certificate",
      filePath: "blob-key-1",
      originalName: "cert.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 9,
      uploadedAt: new Date(0),
    },
    ownerMemberId: "owner-1",
  };
}

beforeEach(() => {
  getCurrentUserMock.mockReset();
  readMock.mockReset();
  getDocMock.mockReset();
});

describe("GET /api/bio/documents/[id]", () => {
  it("returns 404 for an anonymous caller without touching storage", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    getDocMock.mockResolvedValue(ownedDoc());
    readMock.mockResolvedValue(Buffer.from("secret"));

    const res = await GET(req(), ctx("doc-1"));

    expect(res.status).toBe(404);
    expect(readMock).not.toHaveBeenCalled();
  });

  it("returns 404 for a different member (not the owner)", async () => {
    getCurrentUserMock.mockResolvedValue(user("intruder-2"));
    getDocMock.mockResolvedValue(ownedDoc());
    readMock.mockResolvedValue(Buffer.from("secret"));

    const res = await GET(req(), ctx("doc-1"));

    expect(res.status).toBe(404);
    expect(readMock).not.toHaveBeenCalled();
  });

  it("streams the file for the owner", async () => {
    getCurrentUserMock.mockResolvedValue(user("owner-1"));
    getDocMock.mockResolvedValue(ownedDoc());
    const body = Buffer.from("hello pdf");
    readMock.mockResolvedValue(body);

    const res = await GET(req(), ctx("doc-1"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe("inline");
    const received = Buffer.from(await res.arrayBuffer());
    expect(received.equals(body)).toBe(true);
  });

  it("streams the file for an admin who is not the owner", async () => {
    getCurrentUserMock.mockResolvedValue(user("hr-9", true));
    getDocMock.mockResolvedValue(ownedDoc());
    readMock.mockResolvedValue(Buffer.from("hello pdf"));

    const res = await GET(req(), ctx("doc-1"));

    expect(res.status).toBe(200);
  });

  it("returns 404 when the document does not exist", async () => {
    getCurrentUserMock.mockResolvedValue(user("owner-1"));
    getDocMock.mockResolvedValue(null);

    const res = await GET(req(), ctx("missing"));

    expect(res.status).toBe(404);
    expect(readMock).not.toHaveBeenCalled();
  });
});
