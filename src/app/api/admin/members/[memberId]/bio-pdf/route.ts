/**
 * GET /api/admin/members/[memberId]/bio-pdf
 *
 * Admin-only: stream a member's full bio-data profile as a PDF attachment.
 *
 * Gate: this route lives OUTSIDE the `/[locale]/admin/**` subtree (which is
 * protected by the admin layout), so it enforces the admin check itself.
 * Returns JSON 401/403/404 rather than redirecting, since it's a data endpoint.
 *
 * The PDF embeds highly sensitive PII (banking, ID numbers, legal records);
 * `Cache-Control: no-store` keeps it out of any shared/browser cache.
 */
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { type NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getBioProfile } from "@/lib/db/queries/bio";
import { BioDocument } from "@/lib/pdf/BioDocument";

// PDF rendering needs the Node.js runtime (not Edge); never cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Build a filesystem-safe "surname-firstname" slug for the download name. */
function fileSlug(parts: Array<string | null>): string {
  const slug = parts
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "member";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { memberId } = await params;

  const bio = await getBioProfile(memberId);
  if (!bio) {
    return NextResponse.json(
      { error: "no-bio", message: "This member has not submitted a bio yet." },
      { status: 404 },
    );
  }

  let pdf: Buffer;
  try {
    // `renderToBuffer` is typed to accept a top-level <Document> element; our
    // component renders one, so the element is valid at runtime. The cast
    // bridges the component-props vs. DocumentProps signature mismatch.
    const element = createElement(BioDocument, {
      bio,
      generatedAt: new Date().toISOString(),
    }) as Parameters<typeof renderToBuffer>[0];
    pdf = await renderToBuffer(element);
  } catch (err) {
    // Log only the message, never the raw error — it is built from a fully
    // populated bio object and could otherwise echo PII field values into logs.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[bio-pdf] render failed for member ${memberId}: ${message}`);
    return NextResponse.json({ error: "render-failed" }, { status: 500 });
  }

  const filename = `bio-${fileSlug([bio.profile.surname, bio.profile.firstName])}.pdf`;

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "no-store",
    },
  });
}
