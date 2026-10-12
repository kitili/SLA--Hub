import Link from "next/link";
import { getDepartment, hubEntryHref, isExternalUrl } from "@/lib/departments";

export default function DeskOpen({
  id,
  liveUrl,
  label = "Open live",
}: {
  id: string;
  liveUrl: string;
  label?: string;
}) {
  const department = getDepartment(id);
  const href = department ? hubEntryHref(department) : liveUrl;
  if (isExternalUrl(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {label}
      </a>
    );
  }
  return <Link href={href}>{label}</Link>;
}
