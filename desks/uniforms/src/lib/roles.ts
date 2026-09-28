import type { Role } from "./constants";
import { ADMIN_CAMPUSES, CAMPUS_CODES, HT_CAMPUSES } from "./constants";

export type NavItem = {
  href: string;
  label: string;
  roles: Role[];
  /** Who sees this in the top bar. `false` = route stays open, no pill. */
  bar?: Role[] | false;
};

export const NAV: NavItem[] = [
  { href: "/desk", label: "Home", roles: ["STORE", "TAILOR", "FINANCE", "CEO", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"], bar: ["STORE", "TAILOR", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"] },
  { href: "/stock", label: "Stock", roles: ["STORE", "TAILOR", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"] },
  { href: "/orders", label: "Orders", roles: ["STORE", "FINANCE", "CEO", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"], bar: ["STORE", "FINANCE", "CEO", "ADMIN", "HEAD_TEACHER"] },
  { href: "/requests", label: "Ask", roles: ["STORE", "ADMIN", "HEAD_TEACHER"], bar: ["STORE", "ADMIN", "HEAD_TEACHER"] },
  { href: "/distribution", label: "DNs", roles: ["STORE", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"], bar: ["STORE", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"] },
  { href: "/purchase-orders", label: "Buy", roles: ["STORE", "FINANCE"] },
  { href: "/sewing", label: "Sew", roles: ["TAILOR", "STORE"], bar: ["TAILOR", "STORE"] },
  { href: "/slm", label: "Cloth", roles: ["TAILOR", "STORE"], bar: ["TAILOR", "STORE"] },
  { href: "/finance", label: "Finance", roles: ["FINANCE", "STORE", "CEO"], bar: ["CEO", "STORE"] },
  { href: "/sizes", label: "Plan", roles: ["STORE", "FINANCE", "CEO"], bar: ["FINANCE", "CEO", "STORE"] },
  { href: "/catalog", label: "Catalog", roles: ["STORE", "FINANCE", "CEO"], bar: ["FINANCE", "CEO", "STORE"] },
  { href: "/analytics", label: "Year", roles: ["STORE", "FINANCE", "CEO"], bar: ["FINANCE", "CEO", "STORE"] },
  { href: "/reports", label: "Briefing", roles: ["STORE", "FINANCE", "CEO", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"], bar: ["STORE", "FINANCE", "CEO", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"] },
  { href: "/alerts", label: "Alerts", roles: ["STORE", "TAILOR", "FINANCE", "CEO", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"], bar: ["STORE", "ADMIN", "HEAD_TEACHER"] },
  { href: "/audit", label: "Log", roles: ["STORE", "FINANCE", "CEO"], bar: ["STORE", "FINANCE", "CEO"] },
  { href: "/train", label: "Train", roles: ["STORE", "TAILOR", "FINANCE", "CEO", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"], bar: false },
];

export function navFor(role: Role): NavItem[] {
  return NAV.filter((item) => {
    if (!item.roles.includes(role)) return false;
    if (item.bar === false) return false;
    if (Array.isArray(item.bar)) return item.bar.includes(role);
    return true;
  });
}

export function canOpenPath(role: Role, pathname: string): boolean {
  if (pathname.startsWith("/login") || pathname === "/") return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/students")) return true;
  if (pathname.startsWith("/api/sizes")) {
    return role === "STORE" || role === "FINANCE" || role === "CEO";
  }
  if (pathname.startsWith("/api/parent")) return role === "PARENT";
  if (pathname.startsWith("/parent")) return role === "PARENT";
  if (pathname.startsWith("/coupon")) return true;
  if (pathname.startsWith("/size-chart")) return role !== "PARENT";
  if (pathname.startsWith("/briefing")) {
    return role === "CEO" || role === "STORE" || role === "FINANCE" || role === "ADMIN" || role === "HEAD_TEACHER" || role === "PRINCIPAL";
  }
  if (pathname.startsWith("/stock/value")) {
    return role === "CEO" || role === "STORE" || role === "FINANCE";
  }
  if (pathname.startsWith("/delivery-note")) return role !== "PARENT";
  if (role === "PARENT") return false;

  const match = NAV.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  if (!match) return false;
  return match.roles.includes(role);
}

export function homeFor(role: Role): string {
  if (role === "PARENT") return "/parent";
  if (role === "CEO") return "/reports";
  return "/desk";
}

export function isExecutive(role: Role) {
  return role === "CEO";
}

export function canRequestForCampus(role: Role, campusCode: string): boolean {
  if (role === "ADMIN") return (ADMIN_CAMPUSES as readonly string[]).includes(campusCode);
  if (role === "HEAD_TEACHER") return (HT_CAMPUSES as readonly string[]).includes(campusCode);
  return false;
}

export function canActForCampus(
  user: { role: Role; campusId: string | null; campusCode: string | null },
  campusCode: string,
): boolean {
  if (!user.campusId) {
    return (
      (user.role === "ADMIN" || user.role === "HEAD_TEACHER" || user.role === "PRINCIPAL") &&
      (CAMPUS_CODES as readonly string[]).includes(campusCode)
    );
  }
  if (user.campusCode !== campusCode) return false;
  return canRequestForCampus(user.role, campusCode);
}

export function isStaff(role: Role): boolean {
  return role !== "PARENT";
}
