/**
 * Unit tests for the upload allowlist — the security-relevant gate shared by the
 * admin materials uploader and the member bio-document uploader.
 *
 * Invariants under test:
 *   - the bio (documents & images) allowlist accepts pdf/png/docx,
 *   - it rejects audio/video and unknown extensions,
 *   - svg/html are rejected even when the extension or MIME looks benign,
 *   - the wider material allowlist still accepts audio/video,
 *   - extension matching is case-insensitive.
 */
import { describe, it, expect } from "vitest";

import {
  BIO_DOCUMENT_EXTENSIONS,
  MATERIAL_UPLOAD_EXTENSIONS,
  rejectionReason,
  sanitizeUploadName,
} from "./upload-validation";

function file(name: string, type = "application/octet-stream"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

describe("rejectionReason — bio documents & images", () => {
  it.each(["cert.pdf", "scan.png", "photo.jpg", "diploma.docx", "sheet.xlsx"])(
    "accepts %s",
    (name) => {
      expect(rejectionReason(file(name), BIO_DOCUMENT_EXTENSIONS)).toBeNull();
    },
  );

  it.each(["clip.mp4", "audio.mp3", "movie.webm", "notes.txt"])(
    "rejects %s (not a document or image)",
    (name) => {
      expect(rejectionReason(file(name), BIO_DOCUMENT_EXTENSIONS)).toBe(
        "unsupportedType",
      );
    },
  );

  it("rejects an unknown extension", () => {
    expect(rejectionReason(file("malware.exe"), BIO_DOCUMENT_EXTENSIONS)).toBe(
      "unsupportedType",
    );
  });

  it("rejects .svg (active content, stored-XSS risk)", () => {
    expect(
      rejectionReason(file("logo.svg", "image/svg+xml"), BIO_DOCUMENT_EXTENSIONS),
    ).toBe("unsupportedType");
  });

  it("rejects a benign extension paired with a forbidden MIME", () => {
    // Extension is allowed, but the MIME says text/html — reject.
    expect(
      rejectionReason(file("cert.pdf", "text/html"), BIO_DOCUMENT_EXTENSIONS),
    ).toBe("unsupportedType");
  });

  it("rejects files over the size cap", () => {
    const huge = new File([new Uint8Array(8)], "cert.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(huge, "size", { value: 11 * 1024 * 1024 });
    expect(
      rejectionReason(huge, BIO_DOCUMENT_EXTENSIONS, 10 * 1024 * 1024),
    ).toBe("tooLarge");
  });

  it("matches extensions case-insensitively", () => {
    expect(
      rejectionReason(file("CERT.PDF", "application/pdf"), BIO_DOCUMENT_EXTENSIONS),
    ).toBeNull();
  });
});

describe("sanitizeUploadName", () => {
  it("strips path segments and dangerous characters", () => {
    expect(sanitizeUploadName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeUploadName("a<b>.pdf")).toBe("a_b_.pdf");
  });
});

describe("rejectionReason — material allowlist is wider", () => {
  it("accepts audio/video that the bio allowlist rejects", () => {
    expect(rejectionReason(file("clip.mp4"), MATERIAL_UPLOAD_EXTENSIONS)).toBeNull();
    expect(rejectionReason(file("clip.mp4"), BIO_DOCUMENT_EXTENSIONS)).toBe(
      "unsupportedType",
    );
  });
});
