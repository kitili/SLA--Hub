import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE, sessionIssuedWithinTtl, type Role } from "@/lib/constants";
import { canOpenPath, homeFor } from "@/lib/roles";

const JWT_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET ?? "silverleaf-dev-secret-change-me");

const PUBLIC = ["/login", "/api/auth/login", "/api/auth/parent", "/sw.js", "/manifest.webmanifest"];

function dropSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets/") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.svg" ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/icon")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let role: Role | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      role = sessionIssuedWithinTtl(payload.iat) ? (payload.role as Role) : null;
    } catch {
      role = null;
    }
  }

  if (PUBLIC.includes(pathname) || pathname === "/") {
    if (pathname === "/login" && role) {
      return NextResponse.redirect(new URL(homeFor(role), request.url));
    }
    if (pathname === "/login" && token && !role) {
      return dropSessionCookie(NextResponse.next());
    }
    return NextResponse.next();
  }

  if (!role) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    const response = NextResponse.redirect(login);
    if (token) dropSessionCookie(response);
    return response;
  }

  if (!canOpenPath(role, pathname)) {
    return NextResponse.redirect(new URL(homeFor(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon.svg|icon|assets/|sw.js|manifest.webmanifest).*)",
  ],
};
