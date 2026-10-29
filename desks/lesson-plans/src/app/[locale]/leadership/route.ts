/**
 * GET /[locale]/leadership
 *
 * The Instructional Leadership Dashboard (walkthroughs and teacher
 * observations). Served as its own document because the page was written as
 * standalone HTML; it reads its figures from /api/leadership/data.
 * Admin-only: signed-out visitors go to sign-in, other staff to unauthorized.
 */
import { NextResponse } from "next/server";

import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { canViewLeadership } from "@/lib/leadership/access";
import { renderLeadershipHtml } from "@/lib/leadership/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
): Promise<Response> {
  const { locale: raw } = await params;
  const locale = (routing.locales as readonly string[]).includes(raw) ? raw : routing.defaultLocale;

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/${locale}/sign-in`, request.url));
  if (!canViewLeadership(user)) {
    return NextResponse.redirect(new URL(`/${locale}/unauthorized`, request.url));
  }

  return new Response(renderLeadershipHtml(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
