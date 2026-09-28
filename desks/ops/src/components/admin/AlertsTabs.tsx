"use client";

import { useState, type ReactNode } from "react";

type Tab = {
  key: string;
  label: string;
  badge?: number;
  content: ReactNode;
};

export function AlertsTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-card-border bg-white/80 p-1.5 shadow-[var(--shadow)]">
        {tabs.map((tab) => {
          const on = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                on
                  ? "bg-electric-blue text-white shadow-md shadow-electric-blue/20"
                  : "text-ink-muted hover:bg-light-blue-30 hover:text-ink"
              }`}
            >
              {tab.label}
              {tab.badge != null && tab.badge > 0 ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${
                    on ? "bg-white/20 text-white" : "bg-danger-15 text-danger"
                  }`}
                >
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div key={tab.key} hidden={active !== tab.key} className="pt-6">
          {tab.content}
        </div>
      ))}
    </div>
  );
}
