import "server-only";

import { getCurrentUser } from "@/lib/auth";
import { getDepartment, type DepartmentId } from "@/lib/departments";
import { recordAccessEvent } from "@/lib/db/repositories/access";
import type { AccessAction } from "@/lib/db/schema/access-events";

export async function recordCurrentAccess(input: {
  action: AccessAction;
  departmentId?: string | null;
  path?: string | null;
}): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const department = input.departmentId ? getDepartment(input.departmentId) : undefined;
  try {
    await recordAccessEvent({
      staffId: user.id,
      email: user.email,
      fullName: user.fullName ?? "",
      action: input.action,
      departmentId: department?.id ?? input.departmentId ?? null,
      departmentName: department?.name ?? null,
      path: input.path ?? null,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[access] Could not record event.", error);
    }
  }
}

export async function recordDeskOpen(departmentId: DepartmentId | string, path?: string): Promise<void> {
  await recordCurrentAccess({
    action: "opened_desk",
    departmentId,
    path,
  });
}
