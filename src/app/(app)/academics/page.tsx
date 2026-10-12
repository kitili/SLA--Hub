import { redirect } from "next/navigation";
import { getDepartment } from "@/lib/departments";

export const dynamic = "force-dynamic";

export default function AcademicsPage() {
  const department = getDepartment("lesson-plans");
  redirect(department?.liveUrl ?? "https://silverleaf-lesson-plans-main.vercel.app");
}
