import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccessOpsCommandCenter } from "@/lib/dashboard/overview-scopes";
import { resolveRole, ROLE_HOME, type Role } from "@/lib/roles";

const PUBLIC_PATHS = ["/", "/login", "/auth/callback"];

function isPublicPath(path: string) {
  if (PUBLIC_PATHS.includes(path)) return true;
  // Migrated Netlify desk — own PIN/dept login; assets must not HTML-redirect
  if (path === "/ticketing" || path.startsWith("/ticketing/")) return true;
  if (path === "/transport") return true;
  if (path === "/farm") return true;
  // APK + other static installers (must be downloadable without login)
  if (path === "/downloads" || path.startsWith("/downloads/")) return true;
  if (path === "/get-driver") return true;
  // Driver / Matron PWA manifests must stay public (middleware runs before static files).
  if (path === "/driver-manifest.webmanifest") return true;
  if (path === "/matron-manifest.webmanifest") return true;
  return false;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isCron = path.startsWith("/api/cron");
  const isApi = path.startsWith("/api/");
  const isAuthCallback = path.startsWith("/auth/callback");
  const isPublic = isPublicPath(path) || isCron || isAuthCallback;

  // APIs use requireUser() and return JSON 401 — don't HTML-redirect them.
  if (!user && isApi && !isCron) {
    return response;
  }

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/";
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  if (!user) return response;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = resolveRole(profile?.role, user.user_metadata?.role);

  if (path === "/" || path === "/login") {
    if (role) {
      return NextResponse.redirect(new URL(ROLE_HOME[role as Role], request.url));
    }
    if (path === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  const home = role ? ROLE_HOME[role as Role] : "/?error=role";

  // Role workspaces: admin ↔ all; transport ↔ /admin (not farm); ops_manager
  // ↔ kitchen/facilities/farm; matron ↔ /matron; farm ↔ /admin/farm.
  // /ticketing is public (desk has its own auth).
  //
  // Director is read-only oversight — enforced at the RLS/API layer, not
  // by hiding this route (see schema_directors.sql for what's opened up) —
  // but scoped to /admin only, not the wider /ops surface.
  if (path.startsWith("/admin")) {
    const onFarm = path.startsWith("/admin/farm");
    const allowed =
      role === "admin" ||
      role === "finance" ||
      role === "director" ||
      (role === "transport" && !onFarm) ||
      (role === "farm" && onFarm) ||
      (role === "ops_manager" && onFarm);
    if (!allowed) {
      return NextResponse.redirect(new URL(home, request.url));
    }
  } else if (path.startsWith("/ops")) {
    // Must match roleCanAccess / (ops)/layout.
    const opsOk =
      role === "admin" ||
      role === "finance" ||
      role === "ops_manager" ||
      role === "finance_manager" ||
      role === "cfo";
    if (!opsOk) {
      return NextResponse.redirect(new URL(home, request.url));
    }
    if (
      path.startsWith("/ops/admin") &&
      (!role || !canAccessOpsCommandCenter(role))
    ) {
      return NextResponse.redirect(new URL(home, request.url));
    }
    // Kusaduka (ops_manager): kitchen, facilities, farm, ticketing — not transport.
    if (
      role === "ops_manager" &&
      (path.startsWith("/ops/transport") || path === "/ops/transport")
    ) {
      return NextResponse.redirect(new URL(home, request.url));
    }
  }

  if (path.startsWith("/matron")) {
    if (role !== "matron" && role !== "admin" && role !== "driver") {
      return NextResponse.redirect(new URL(home, request.url));
    }
  }

  if (path.startsWith("/driver")) {
    // Driver field app is gone — every URL lands on the matron loop.
    const matronUrl = request.nextUrl.clone();
    if (path === "/driver/navigate" || path.startsWith("/driver/navigate/")) {
      matronUrl.pathname = "/matron/path";
    } else {
      matronUrl.pathname = path.replace(/^\/driver/, "/matron") || "/matron";
    }
    return NextResponse.redirect(matronUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static assets + APK downloads (must never hit auth redirect).
    "/((?!_next/static|_next/image|favicon.ico|assets|downloads/|driver-manifest\\.webmanifest|matron-manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|apk|webmanifest)$).*)",
  ],
};
