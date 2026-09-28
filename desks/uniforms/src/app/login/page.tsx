import { BrandLogo } from "@/components/brand-logo";
import { Card } from "@/components/ui";
import { LoginForm } from "@/components/login-form";
import { brand } from "@/lib/brand";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4 py-10">
      <Card className="w-full border-t-4 border-t-gold">
        <BrandLogo variant="brandmark" width={150} height={66} className="mb-5 h-12 w-auto" priority />
        <h1 className="font-display text-2xl font-extrabold text-electric-blue">{brand.productName}</h1>
        <p className="mt-1 mb-5 text-sm text-ink-muted">Leadership opens the leadership briefing. Staff pick a desk. Parents enter a child registration number.</p>
        <p className="mt-1 mb-5 text-sm text-ink-muted">Tap a desk. School admins share one desk — filter by school after you sign in. Parents use a child registration number.</p>
        <LoginForm error={error} />
      </Card>
    </main>
  );
}
