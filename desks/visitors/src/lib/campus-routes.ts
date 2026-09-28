import { CAMPUS_NAMES, Campus, CampusName } from "@/domain/Campus";

export function campusFromSlug(slug: string): Campus | null {
  return Campus.all.find((campus) => campus.slug === slug) ?? null;
}

export function campusPath(campus: CampusName, section: "desk" | "history" | "qr" = "desk"): string {
  const base = `/campus/${Campus.parse(campus).slug}`;
  if (section === "desk") return base;
  return `${base}/${section}`;
}

export const CAMPUS_HUB = CAMPUS_NAMES.map((name) => {
  const campus = Campus.parse(name);
  return {
    name,
    slug: campus.slug,
    accent: campus.accent,
    gradient: campus.gradient,
    href: campusPath(name),
  };
});
