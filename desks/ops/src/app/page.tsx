import { Suspense } from "react";
import { LoginForm } from "@/app/login/LoginForm";
import { brand } from "@/lib/brand";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-[#001a4d] text-white">
          Loading {brand.shortName}…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
