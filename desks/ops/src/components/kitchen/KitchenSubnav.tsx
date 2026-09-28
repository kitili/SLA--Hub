import Link from "next/link";
import { KITCHEN_SECTIONS, type KitchenSectionId } from "@/lib/kitchen-sections";

type Props = {
  active?: KitchenSectionId;
};

export function KitchenSubnav({ active = "dashboard" }: Props) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-2" aria-label="Kitchen sections">
      {KITCHEN_SECTIONS.map((item) => {
        const isActive = item.id === active;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm font-semibold no-underline transition ${
              isActive
                ? "border-electric-blue bg-electric-blue text-white shadow-[var(--shadow)]"
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
