/** Maps a pathname to a department label for the feedback widget — keeps
 * submitters from having to pick their own department, since the page
 * they're on already tells us. */
export function departmentForPath(pathname: string): string {
  if (pathname.startsWith("/ops/kitchen") || pathname.startsWith("/kitchen")) return "kitchen";
  if (pathname.startsWith("/ops/facilities")) return "facilities";
  if (pathname.startsWith("/admin/farm") || pathname.startsWith("/farm")) return "farm";
  if (pathname.startsWith("/ops/ticketing")) return "ticketing";
  if (pathname.startsWith("/ops/admin")) return "leadership";
  if (pathname.startsWith("/matron")) return "matron";
  if (pathname.startsWith("/admin")) return "transport";
  if (pathname.startsWith("/ops")) return "ops";
  return "other";
}

export const DEPARTMENT_LABEL: Record<string, string> = {
  kitchen: "Kitchen",
  facilities: "Facilities",
  farm: "Farm",
  ticketing: "Ticketing",
  leadership: "Leadership / command center",
  matron: "Matron / field ops",
  transport: "Transport",
  ops: "Ops",
  other: "Other",
};
