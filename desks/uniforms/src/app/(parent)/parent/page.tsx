import { ParentDesk } from "@/components/parent-desk";
import { requireUser } from "@/lib/auth";
import { buildParentSnapshot } from "@/lib/parent-snapshot";

export default async function ParentPage() {
  const user = await requireUser(["PARENT"]);
  const snapshot = await buildParentSnapshot(user.id, user.campusId ?? "", user.campusName, user.name);
  return <ParentDesk initial={snapshot} />;
}
