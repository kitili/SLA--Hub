import { Suspense } from "react";
import { MatronQrScanner } from "@/components/matron/MatronQrScanner";

export default function MatronScanPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-4 py-8 text-sm text-ink-muted">
          Loading scanner…
        </main>
      }
    >
      <MatronQrScanner />
    </Suspense>
  );
}
