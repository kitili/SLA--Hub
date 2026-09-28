"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CAMPUS_NAMES, Campus } from "@/domain/Campus";
import { BrandLogo } from "@/components/BrandLogo";
import { CampusPills } from "@/components/CampusPills";
import { SignInForm } from "@/components/SignInForm";

function CheckInInner() {
  const params = useSearchParams();
  const presetCampus = Campus.tryParse(params.get("campus"))?.name;
  const [campus, setCampus] = useState(presetCampus ?? CAMPUS_NAMES[0]);

  return (
    <div className="checkin-shell">
      <div className="hero-banner">
        <BrandLogo variant="white" height={36} priority />
        <h1>Welcome</h1>
        <p>Silverleaf Academy visitor check-in</p>
      </div>
      <hr className="gold-rule" />
      <div className="checkin-campus-picker">
        <label>Which campus are you visiting?</label>
        <CampusPills value={campus} onChange={setCampus} />
      </div>
      <SignInForm campus={campus} source="self" />
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={<div className="checkin-shell">Loading check-in…</div>}>
      <CheckInInner />
    </Suspense>
  );
}
