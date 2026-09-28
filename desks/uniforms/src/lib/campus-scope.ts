import { cookies } from "next/headers";
import type { SessionUser } from "./auth";
import { CAMPUS_CODES, SCHOOL_COOKIE, SESSION_MAX_AGE, type CampusCode } from "./constants";
import { campusIdForCode } from "./kpis";
import { isSchoolAdmin } from "./visibility";

export { isSchoolAdmin } from "./visibility";

function cleanCampusCode(value?: string | null): CampusCode | null {
  const code = String(value ?? "").trim().toUpperCase();
  return (CAMPUS_CODES as readonly string[]).includes(code) ? (code as CampusCode) : null;
}

export async function schoolScope(user: SessionUser, queryCampus?: string | null) {
  if (user.campusId) {
    return user.campusCode
      ? { id: user.campusId, code: user.campusCode, name: user.campusName ?? user.campusCode }
      : null;
  }
  if (!isSchoolAdmin(user)) return null;
  const jar = await cookies();
  const code = cleanCampusCode(queryCampus) ?? cleanCampusCode(jar.get(SCHOOL_COOKIE)?.value);
  if (!code) return null;
  return campusIdForCode(code);
}

export async function writeSchoolCookie(code: string | null) {
  const jar = await cookies();
  const campus = cleanCampusCode(code);
  if (!campus) {
    jar.set(SCHOOL_COOKIE, "", { path: "/", maxAge: 0 });
    return;
  }
  jar.set(SCHOOL_COOKIE, campus, {
    path: "/",
    maxAge: SESSION_MAX_AGE,
    sameSite: "lax",
  });
}
