import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { ProfileForm } from "@/components/profile/profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl">
      <ProfileForm
        name={user.name ?? ""}
        username={user.username ?? ""}
        jobTitle={user.jobTitle ?? ""}
        bio={user.bio ?? ""}
        avatarUrl={user.avatarUrl}
      />
    </div>
  );
}
