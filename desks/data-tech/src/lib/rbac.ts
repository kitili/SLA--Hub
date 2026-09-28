import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasModuleAccess, type ModuleKey, type AccessLevel } from "@/lib/modules";

export type Role = "admin" | "hod" | "tech";

export async function requireSession() {
  const session = await auth();
  if (!session?.user || session.error === "SessionRevoked") {
    return { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, response: null };
}

// role === "admin" always passes, regardless of module. Everyone else needs a matching
// (or higher) access-level row for that module.
export async function requireModule(module: ModuleKey, minLevel: AccessLevel = "view") {
  const { session, response } = await requireSession();
  if (response) return { session: null, response };

  if (session.user.role === "admin") return { session, response: null };

  if (!hasModuleAccess(session.user.modules, module, minLevel)) {
    return { session: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session, response: null };
}
