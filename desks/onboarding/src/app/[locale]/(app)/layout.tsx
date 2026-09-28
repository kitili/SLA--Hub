import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import AdminNavLink from "@/components/AdminNavLink";
import IdleLogout from "@/components/IdleLogout";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import LogoutButton from "@/components/LogoutButton";
import SiteNav from "@/components/SiteNav";
import SlaBotWidget from "@/components/SlaBot";
import ThemeToggle from "@/components/ThemeToggle";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("nav");
  const user = await getCurrentUser();

  return (
    <>
      {user && <IdleLogout />}
      {user && <SlaBotWidget />}
      <SiteNav openLabel={t("menu")} closeLabel={t("closeMenu")}>
        <Link href="/">{t("dashboard")}</Link>
        {user?.isAdmin && <AdminNavLink isAdmin />}
        <LocaleSwitcher />
        <ThemeToggle />
        {user && <LogoutButton />}
      </SiteNav>
      {children}
    </>
  );
}
