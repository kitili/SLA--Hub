"use client";

import { useSearchParams } from "next/navigation";
import { Flash } from "./flash";

export function SearchFlash() {
  const params = useSearchParams();
  return <Flash error={params.get("error")} ok={params.get("ok")} />;
}
