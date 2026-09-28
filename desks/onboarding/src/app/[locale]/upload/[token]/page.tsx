import { Suspense } from "react";
import type { Metadata } from "next";

import UploadClient from "@/components/hiring/UploadClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Upload — Silverleaf Academy Hiring",
  robots: { index: false },
};

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: "2rem", textAlign: "center" }}>
          Loading upload…
        </main>
      }
    >
      <UploadClient />
    </Suspense>
  );
}
