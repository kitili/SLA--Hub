import Link from "next/link";
import { FARM_SECTIONS, type FarmSectionId } from "@/lib/farm-sections";

const HUB = { id: "hub" as const, name: "Overview", href: "/admin/farm" };

type Props = {
  active?: FarmSectionId | "hub";
};

export function FarmSubnav({ active = "hub" }: Props) {
  const items = [HUB, ...FARM_SECTIONS];
  return (
    <nav
      className="mb-6 flex flex-wrap items-center gap-2"
      aria-label="Farm sections"
    >
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
