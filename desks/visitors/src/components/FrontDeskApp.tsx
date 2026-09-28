"use client";

import { useEffect, useState } from "react";
import { VisitRecord } from "@/domain/Visit";
import { fetchVisits } from "@/lib/visits-client";
import { SignInForm } from "./SignInForm";
import { SiteHeader } from "./SiteHeader";
import { VisitorBoard } from "./VisitorBoard";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function FrontDeskApp({ campus }: { campus: string }) {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [toast, setToast] = useState("");

  async function refresh() {
    setVisits(await fetchVisits({ campus, date: todayKey(), onSite: true }));
  }

  useEffect(() => {
    void refresh().catch(() => undefined);
    const timer = setInterval(() => void refresh().catch(() => undefined), 4000);
    return () => clearInterval(timer);
  }, [campus]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  return (
    <div className="wrap campus-themed" data-campus={campus}>
      <SiteHeader
        campus={campus}
        title="Visitor Log"
        subtitle={`Front desk for ${campus}. Sign visitors in or send them to the QR self check-in.`}
        active="desk"
      />
      <div className="grid">
        <SignInForm
          campus={campus}
          source="desk"
          onSignedIn={(name) => {
            showToast(`${name} signed in`);
            void refresh();
          }}
        />
        <VisitorBoard visits={visits} onChanged={() => void refresh()} onToast={showToast} />
      </div>
      <p className="footnote">
        Silverleaf Academy · visitor photos are stored securely · history is available on the dashboard.
      </p>
      <div className={`toast${toast ? " show" : ""}`}>{toast}</div>
    </div>
  );
}
