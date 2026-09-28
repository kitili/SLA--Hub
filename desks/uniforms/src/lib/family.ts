import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { edadminConfigured } from "./edadmin/client";
import { syncStudentByRegNo } from "./edadmin/sync";

export function normalizeReg(raw: string) {
  return raw.trim().replace(/\s+/g, "");
}

export function familyDisplayName(children: { name: string }[]) {
  const first = children.map((c) => c.name.split(" ")[0]).filter(Boolean);
  if (first.length === 0) return "Parent";
  if (first.length === 1) return `${first[0]}'s parent`;
  if (first.length === 2) return `${first[0]} & ${first[1]}'s family`;
  return `${first[0]} + ${first.length - 1} children's family`;
}

export type FamilyScope = {
  familyId: string;
  userIds: string[];
  studentIds: string[];
};

export async function familyScopeForUser(userId: string): Promise<FamilyScope | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { familyId: true } });
  if (!user?.familyId) return { familyId: "", userIds: [userId], studentIds: [] };
  const [users, students] = await Promise.all([
    prisma.user.findMany({ where: { familyId: user.familyId, role: "PARENT" }, select: { id: true } }),
    prisma.student.findMany({ where: { familyId: user.familyId }, select: { id: true } }),
  ]);
  return {
    familyId: user.familyId,
    userIds: users.map((u) => u.id),
    studentIds: students.map((s) => s.id),
  };
}

export function familyOwnsOrder(
  scope: FamilyScope | null,
  order: { placedById?: string | null; studentId?: string | null },
) {
  if (!scope) return false;
  if (order.placedById && scope.userIds.includes(order.placedById)) return true;
  if (order.studentId && scope.studentIds.includes(order.studentId)) return true;
  return false;
}

export async function parentCanSeeOrder(
  userId: string,
  order: { placedById?: string | null; studentId?: string | null },
) {
  return familyOwnsOrder(await familyScopeForUser(userId), order);
}

async function refreshFamilyName(familyId: string) {
  const children = await prisma.student.findMany({
    where: { familyId },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  const name = familyDisplayName(children);
  await prisma.user.updateMany({ where: { familyId, role: "PARENT" }, data: { name } });
  return name;
}

async function parentOnFamily(familyId: string) {
  const existing = await prisma.user.findFirst({
    where: { familyId, role: "PARENT", active: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  const hash = await hashPassword(crypto.randomUUID());
  return prisma.user.create({
    data: {
      email: `family-${familyId.slice(-10)}@parents.silverleaf.ac.tz`,
      passwordHash: hash,
      name: "Parent",
      role: "PARENT",
      familyId,
    },
  });
}

async function findStudentByReg(regNo: string) {
  const cleaned = normalizeReg(regNo);
  let student = await prisma.student.findFirst({
    where: { OR: [{ regNo: cleaned }, { regNo: cleaned.toUpperCase() }] },
    include: { campus: true },
  });
  if (!student && edadminConfigured()) {
    const synced = await syncStudentByRegNo(cleaned);
    if (synced) {
      student = await prisma.student.findUnique({
        where: { id: synced.id },
        include: { campus: true },
      });
    }
  }
  return student;
}

export async function loginOrCreateByReg(regNo: string) {
  const cleaned = normalizeReg(regNo);
  if (!cleaned) return { error: "Enter the child registration number." };
  const student = await findStudentByReg(cleaned);
  if (!student) {
    return {
      error: edadminConfigured()
        ? "No student with that registration number in Ed-admin."
        : "No student with that registration number.",
    };
  }

  if (student.familyId) {
    const parent = await parentOnFamily(student.familyId);
    await refreshFamilyName(student.familyId);
    return { userId: parent.id };
  }

  const family = await prisma.family.create({ data: {} });
  await prisma.student.update({ where: { id: student.id }, data: { familyId: family.id } });
  const hash = await hashPassword(crypto.randomUUID());
  const parent = await prisma.user.create({
    data: {
      email: `family-${family.id.slice(-10)}@parents.silverleaf.ac.tz`,
      passwordHash: hash,
      name: familyDisplayName([student]),
      role: "PARENT",
      campusId: student.campusId,
      familyId: family.id,
    },
  });
  return { userId: parent.id };
}

export async function addSiblingByReg(parentUserId: string, regNo: string) {
  const cleaned = normalizeReg(regNo);
  if (!cleaned) return { error: "Enter the sibling’s registration number." };
  const parent = await prisma.user.findUnique({ where: { id: parentUserId } });
  if (!parent?.familyId) return { error: "Your account is not a family yet." };

  const student = await findStudentByReg(cleaned);
  if (!student) {
    return {
      error: edadminConfigured()
        ? "No student with that registration number in Ed-admin."
        : "No student with that registration number.",
    };
  }
  if (student.familyId === parent.familyId) {
    return { ok: true, name: student.name, already: true };
  }

  // A student already tied to a DIFFERENT family means that family already
  // has its own identity — possibly its own parent login, orders, and
  // payment history. Auto-merging it into the caller's family on nothing
  // but a typed regNo would fold all of that in with zero verification that
  // the caller actually has any right to it. Only the "student has never
  // been linked to anyone" case is safe to self-serve; anything else needs
  // a human (the school office) to confirm the two families really belong
  // together before merging real records.
  if (student.familyId) {
    return {
      error: `${student.name} is already linked to another family account. Contact the school office to merge accounts.`,
    };
  }
  await prisma.student.update({ where: { id: student.id }, data: { familyId: parent.familyId } });

  await refreshFamilyName(parent.familyId);
  return { ok: true, name: student.name, campus: student.campus.name };
}

// Undoes addSiblingByReg's link, not a delete — the student row (and any
// orders already placed for them) stays exactly as-is, just detached from
// this family. familyId goes back to null rather than a fresh Family row:
// loginOrCreateByReg already creates one lazily on next login, so there's
// no dangling-empty-family state to worry about here.
export async function removeChildFromFamily(parentUserId: string, studentId: string) {
  const parent = await prisma.user.findUnique({ where: { id: parentUserId } });
  if (!parent?.familyId) return { error: "Your account is not a family yet." };

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student || student.familyId !== parent.familyId) {
    return { error: "That child is not on your account." };
  }

  await prisma.student.update({ where: { id: studentId }, data: { familyId: null } });
  await refreshFamilyName(parent.familyId);
  return { ok: true, name: student.name };
}
