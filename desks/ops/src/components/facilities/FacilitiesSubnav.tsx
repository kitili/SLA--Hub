import Link from "next/link";
import { FACILITIES_SECTIONS, type FacilitiesSectionId } from "@/lib/facilities-sections";

const HUB = { id: "hub" as const, name: "Top Sheet", href: "/ops/facilities" };

type Props = {
  active?: FacilitiesSectionId | "hub";
};

export function FacilitiesSubnav({ active = "hub" }: Props) {
  const items = [HUB, ...FACILITIES_SECTIONS];
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-2" aria-label="Facilities sections">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm font-semibold no-underline ${
              isActive
                ? "border-electric-blue bg-electric-blue text-white"
                : "border-card-border bg-card text-electric-blue hover:bg-light-blue-30"
            }`}
          >
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
