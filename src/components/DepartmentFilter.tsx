import Link from "next/link";
import { departments, type DepartmentId } from "@/lib/departments";
import styles from "./DepartmentFilter.module.css";

export default function DepartmentFilter({
  base,
  current,
  param = "dept",
}: {
  base: string;
  current?: string | null;
  param?: string;
}) {
  const chips: Array<{ id: string; name: string }> = [
    { id: "", name: "All departments" },
    ...departments.map((department) => ({ id: department.id, name: department.name })),
  ];

  return (
    <div className={styles.row} role="tablist" aria-label="Filter by department">
      {chips.map((chip) => {
        const href = chip.id ? `${base}?${param}=${chip.id}` : base;
        const active = chip.id ? current === chip.id : !current;
        return (
          <Link
            key={chip.id || "all"}
            href={href}
            className={styles.chip}
            data-active={active}
            role="tab"
            aria-selected={active}
          >
            {chip.name}
          </Link>
        );
      })}
    </div>
  );
}

export function isDepartmentId(value: string | null | undefined): value is DepartmentId {
  return Boolean(value && departments.some((department) => department.id === value));
}
