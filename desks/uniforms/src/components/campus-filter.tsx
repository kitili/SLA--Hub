import Link from "next/link";
import { setSchoolFilter } from "@/actions/school";

export function CampusFilter({
  sites,
  active,
  path = "/reports",
  persist = false,
}: {
  sites: { code: string; name: string }[];
  active?: string | null;
  path?: string;
  persist?: boolean;
}) {
  const pill = (on: boolean) =>
    on
      ? "rounded-full bg-electric-blue px-3 py-1 text-sm font-semibold text-white no-underline"
      : "rounded-full border border-card-border bg-white px-3 py-1 text-sm font-semibold text-electric-blue no-underline hover:bg-light-blue-30";

  const label = (name: string) => name.replace("Arusha Town (AM)", "AM");

  if (persist) {
    return (
      <nav className="no-print flex flex-wrap gap-1.5" aria-label="Campus">
        <form action={setSchoolFilter}>
          <input type="hidden" name="campus" value="" />
          <input type="hidden" name="next" value={path} />
          <button className={pill(!active)} type="submit">
            All campuses
          </button>
        </form>
        {sites.map((site) => (
          <form action={setSchoolFilter} key={site.code}>
            <input type="hidden" name="campus" value={site.code} />
            <input type="hidden" name="next" value={path} />
            <button className={pill(active === site.code)} type="submit">
              {label(site.name)}
            </button>
          </form>
        ))}
      </nav>
    );
  }

  return (
    <nav className="no-print flex flex-wrap gap-1.5" aria-label="Campus">
      <Link href={path} className={pill(!active)}>
        All campuses
      </Link>
      {sites.map((site) => (
        <Link key={site.code} href={`${path}?campus=${site.code}`} className={pill(active === site.code)}>
          {label(site.name)}
        </Link>
      ))}
    </nav>
  );
}
