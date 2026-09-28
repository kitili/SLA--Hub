import "server-only";

import type { Campus, Student } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeReg } from "@/lib/family";
import { campusCodeFromEdadmin, normalizeGender } from "./campus";
import {
  edadminConfigured,
  edadminFetchQuery,
  parseEdadminParents,
  parseEdadminStudents,
  parseStudentClasses,
  type EdadminParentRow,
  type EdadminStudentRow,
} from "./client";

const CACHE_TTL_MS = 5 * 60 * 1000;

type DirectoryCache = {
  at: number;
  parents: EdadminParentRow[];
  students: EdadminStudentRow[];
};

let directoryCache: DirectoryCache | null = null;

export type EdadminSyncResult = {
  configured: boolean;
  parents: number;
  students: number;
  families: number;
  skipped: number;
  errors: string[];
};

async function loadCampusMap(): Promise<Map<string, Campus>> {
  const campuses = await prisma.campus.findMany();
  return new Map(campuses.map((c) => [c.code, c]));
}

async function fetchDirectory(force = false): Promise<DirectoryCache> {
  const now = Date.now();
  if (!force && directoryCache && now - directoryCache.at < CACHE_TTL_MS) {
    return directoryCache;
  }

  const [parentRows, studentRows, classRows] = await Promise.all([
    edadminFetchQuery("Parents"),
    edadminFetchQuery("Students"),
    edadminFetchQuery("StudentClasses"),
  ]);

  const classByStudentId = parseStudentClasses(classRows);
  const parents = parseEdadminParents(parentRows);
  const students = parseEdadminStudents(studentRows, classByStudentId).filter((s) => s.active && s.regNo);

  directoryCache = { at: now, parents, students };
  return directoryCache;
}

function parentById(parents: EdadminParentRow[]): Map<string, EdadminParentRow> {
  return new Map(parents.map((p) => [p.edadminId, p]));
}

function regMatches(a: string, b: string) {
  const left = normalizeReg(a).toUpperCase();
  const right = normalizeReg(b).toUpperCase();
  return left === right;
}

async function upsertFamilyForParent(
  parentEdadminId: string,
  parent: EdadminParentRow | undefined,
): Promise<string | null> {
  const existing = await prisma.family.findUnique({
    where: { edadminParentId: parentEdadminId },
    select: { id: true },
  });
  if (existing) {
    if (parent?.phone) {
      await prisma.family.update({ where: { id: existing.id }, data: { phone: parent.phone } });
    }
    return existing.id;
  }

  const family = await prisma.family.create({
    data: {
      edadminParentId: parentEdadminId,
      phone: parent?.phone ?? "",
    },
  });

  return family.id;
}

async function upsertStudentFromEdadmin(
  row: EdadminStudentRow,
  campusMap: Map<string, Campus>,
  familyId: string | null,
): Promise<Student | null> {
  const regNo = normalizeReg(row.regNo);
  if (!regNo) return null;

  const campusCode = campusCodeFromEdadmin(row.campusName);
  const campus = campusCode ? campusMap.get(campusCode) : null;
  if (!campus) return null;

  const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || "Student";
  const className = row.className ?? "";
  const gender = normalizeGender(row.gender);

  const byEdadmin = await prisma.student.findUnique({ where: { edadminId: row.edadminId } });
  if (byEdadmin) {
    return prisma.student.update({
      where: { id: byEdadmin.id },
      data: {
        regNo,
        name,
        className,
        gender,
        campusId: campus.id,
        familyId: familyId ?? byEdadmin.familyId,
      },
    });
  }

  const byReg = await prisma.student.findFirst({
    where: { OR: [{ regNo }, { regNo: regNo.toUpperCase() }] },
  });
  if (byReg) {
    return prisma.student.update({
      where: { id: byReg.id },
      data: {
        edadminId: row.edadminId,
        name,
        className,
        gender,
        campusId: campus.id,
        familyId: familyId ?? byReg.familyId,
      },
    });
  }

  return prisma.student.create({
    data: {
      edadminId: row.edadminId,
      regNo,
      name,
      className,
      gender,
      campusId: campus.id,
      familyId,
    },
  });
}

/** Full directory sync — upsert all active students and link families by ParentID. */
export async function syncEdadminDirectory(force = false): Promise<EdadminSyncResult> {
  if (!edadminConfigured()) {
    return { configured: false, parents: 0, students: 0, families: 0, skipped: 0, errors: [] };
  }

  const campusMap = await loadCampusMap();
  const { parents, students } = await fetchDirectory(force);
  const parentMap = parentById(parents);
  const byParent = new Map<string, EdadminStudentRow[]>();

  for (const student of students) {
    const pid = student.parentEdadminId ?? `orphan-${student.edadminId}`;
    const list = byParent.get(pid) ?? [];
    list.push(student);
    byParent.set(pid, list);
  }

  let syncedStudents = 0;
  let syncedFamilies = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [parentEdadminId, siblings] of byParent) {
    if (parentEdadminId.startsWith("orphan-")) {
      for (const row of siblings) {
        try {
          const saved = await upsertStudentFromEdadmin(row, campusMap, null);
          if (saved) syncedStudents += 1;
          else skipped += 1;
        } catch (err) {
          errors.push(`${row.regNo}: ${err instanceof Error ? err.message : "sync failed"}`);
        }
      }
      continue;
    }

    try {
      const parent = parentMap.get(parentEdadminId);
      const familyId = await upsertFamilyForParent(parentEdadminId, parent);
      if (familyId) syncedFamilies += 1;

      for (const row of siblings) {
        const saved = await upsertStudentFromEdadmin(row, campusMap, familyId);
        if (saved) syncedStudents += 1;
        else skipped += 1;
      }
    } catch (err) {
      errors.push(`Parent ${parentEdadminId}: ${err instanceof Error ? err.message : "sync failed"}`);
    }
  }

  directoryCache = null;
  return {
    configured: true,
    parents: parents.length,
    students: syncedStudents,
    families: syncedFamilies,
    skipped,
    errors: errors.slice(0, 20),
  };
}

/** On-demand: find student by registration number in Ed-admin and sync their family. */
export async function syncStudentByRegNo(rawRegNo: string): Promise<Student | null> {
  if (!edadminConfigured()) return null;

  const cleaned = normalizeReg(rawRegNo);
  if (!cleaned) return null;

  const local = await prisma.student.findFirst({
    where: { OR: [{ regNo: cleaned }, { regNo: cleaned.toUpperCase() }] },
  });
  if (local) return local;

  const campusMap = await loadCampusMap();
  const { parents, students } = await fetchDirectory(false);
  const parentMap = parentById(parents);

  const match = students.find((s) => regMatches(s.regNo, cleaned));
  if (!match) return null;

  let familyId: string | null = null;
  if (match.parentEdadminId) {
    const siblings = students.filter((s) => s.parentEdadminId === match.parentEdadminId);
    familyId = await upsertFamilyForParent(match.parentEdadminId, parentMap.get(match.parentEdadminId));

    for (const sibling of siblings) {
      await upsertStudentFromEdadmin(sibling, campusMap, familyId);
    }
  }

  return upsertStudentFromEdadmin(match, campusMap, familyId);
}
