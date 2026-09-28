import type { School } from "@/types/database";

export type CampusCount = {
  schoolId: string;
  name: string;
  slug: string;
  count: number;
};

export function countBySchool<T>(
  items: T[],
  getSchoolId: (item: T) => string | null | undefined,
  schools: School[],
): CampusCount[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const id = getSchoolId(item);
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return schools
    .map((s) => ({ schoolId: s.id, name: s.name, slug: s.slug, count: counts.get(s.id) ?? 0 }))
    .sort((a, b) => b.count - a.count);
}
