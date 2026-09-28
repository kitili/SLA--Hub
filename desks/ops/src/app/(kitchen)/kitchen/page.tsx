import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSchools } from "@/lib/db/queries";
import {
  listKitchenChecklistEntries,
  listKitchenChecklistTemplates,
} from "@/lib/db/kitchen";
import { ChecklistClient } from "@/components/kitchen/ChecklistClient";
import { getCurrentChecklistPeriods } from "@/lib/kitchen/checklist-periods";

export default async function KitchenStaffPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/kitchen");

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .maybeSingle();

  const schoolsRaw = await getSchools();
  // Prefer Usa River when the profile has no campus (leadership/admin testing).
  const schools = [...schoolsRaw].sort((a, b) => {
    const score = (s: { name: string; slug: string }) =>
      /usariver|usa\s*river/i.test(`${s.name} ${s.slug}`) ? 0 : 1;
    return score(a) - score(b) || a.name.localeCompare(b.name);
  });
  const preferred =
    schools.find((s) => /usariver|usa\s*river/i.test(`${s.name} ${s.slug}`)) ?? schools[0];
  const defaultSchoolId = profile?.school_id ?? preferred?.id ?? "";

  const periods = getCurrentChecklistPeriods();

  const [dailyTemplates, weeklyTemplates, monthlyTemplates, entries] = await Promise.all([
    listKitchenChecklistTemplates("daily"),
    listKitchenChecklistTemplates("weekly"),
    listKitchenChecklistTemplates("monthly"),
    defaultSchoolId
      ? listKitchenChecklistEntries(defaultSchoolId, Object.values(periods))
      : Promise.resolve([]),
  ]);

  return (
    <ChecklistClient
      schools={schools}
      defaultSchoolId={defaultSchoolId}
      periods={periods}
      templates={{ daily: dailyTemplates, weekly: weeklyTemplates, monthly: monthlyTemplates }}
      initialEntries={entries}
    />
  );
}
