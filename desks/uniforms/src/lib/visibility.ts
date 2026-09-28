import { notFound } from "next/navigation";
import type { SessionUser } from "./auth";
import type { Role } from "./constants";
import { parentCanSeeOrder } from "./family";

const NETWORK: Role[] = ["STORE", "FINANCE", "CEO"];
const CAMPUS: Role[] = ["ADMIN", "HEAD_TEACHER", "PRINCIPAL"];

export function seesNetwork(role: Role) {
  return NETWORK.includes(role);
}

export function isSchoolAdmin(user: Pick<SessionUser, "role" | "campusId">) {
  return CAMPUS.includes(user.role) && !user.campusId;
}

export function locationWhere(user: SessionUser, campusId?: string | null) {
  if (seesNetwork(user.role)) return {};
  if (user.role === "TAILOR") return { code: { in: ["MAIN", "SHOP_USA"] } };
  const id = user.campusId ?? campusId ?? null;
  if (id) return { campusId: id, kind: "CAMPUS" as const };
  if (isSchoolAdmin(user)) return { kind: "CAMPUS" as const };
  return { id: "none" };
}

export function orderWhere(user: SessionUser, campusId?: string | null) {
  if (user.role === "PARENT") return { placedById: user.id };
  if (seesNetwork(user.role)) return {};
  const id = user.campusId ?? campusId ?? null;
  if (id) return { campusId: id };
  if (isSchoolAdmin(user)) return {};
  return { id: "none" };
}

export function requestWhere(user: SessionUser, campusId?: string | null) {
  if (user.role === "STORE") return {};
  const id = user.campusId ?? campusId ?? null;
  if (id) return { campusId: id };
  if (isSchoolAdmin(user)) return {};
  return { id: "none" };
}

export function distributionWhere(user: SessionUser, campusId?: string | null) {
  if (user.role === "STORE") return {};
  const id = user.campusId ?? campusId ?? null;
  if (id) return { toCampusId: id };
  if (isSchoolAdmin(user)) return {};
  return { id: "none" };
}

export function canSeeOrder(
  user: SessionUser,
  order: { campusId: string; placedById?: string | null; studentId?: string | null },
) {
  if (user.role === "PARENT") return order.placedById === user.id;
  if (seesNetwork(user.role)) return true;
  if (CAMPUS.includes(user.role)) {
    if (!user.campusId) return true;
    return order.campusId === user.campusId;
  }
  return false;
}

export function canSeeDistribution(
  user: SessionUser,
  dn: { toCampusId: string },
) {
  if (user.role === "STORE") return true;
  if (CAMPUS.includes(user.role) && !user.campusId) return true;
  return !!user.campusId && dn.toCampusId === user.campusId;
}

export async function assertOrder(
  user: SessionUser,
  order: { campusId: string; placedById?: string | null; studentId?: string | null } | null,
) {
  if (!order) notFound();
  if (user.role === "PARENT") {
    if (!(await parentCanSeeOrder(user.id, order))) notFound();
    return;
  }
  if (!canSeeOrder(user, order)) notFound();
}

export function assertDistribution(user: SessionUser, dn: { toCampusId: string } | null) {
  if (!dn || !canSeeDistribution(user, dn)) notFound();
}

export function canWriteOrders(role: Role) {
  return role === "STORE" || role === "ADMIN" || role === "HEAD_TEACHER";
}

export function canTakePayment(role: Role) {
  return role === "STORE" || role === "FINANCE" || role === "ADMIN" || role === "HEAD_TEACHER";
}

export function canIssue(role: Role) {
  return role === "STORE" || role === "ADMIN" || role === "HEAD_TEACHER";
}

export function canIssueFromLocation(
  user: SessionUser,
  order: { campusId: string },
  loc: { kind: string; code: string; campusId: string | null },
) {
  if (user.role === "STORE") {
    return loc.code === "MAIN" || loc.code === "SHOP_USA" || (loc.kind === "CAMPUS" && loc.campusId === order.campusId);
  }
  if (CAMPUS.includes(user.role) && user.campusId) {
    return loc.kind === "CAMPUS" && loc.campusId === user.campusId && order.campusId === user.campusId;
  }
  if (CAMPUS.includes(user.role) && !user.campusId) {
    return loc.kind === "CAMPUS" && loc.campusId === order.campusId;
  }
  return false;
}
