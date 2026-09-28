"use client";

import { ghostClass } from "./forms";

export function PrintBtn({ children = "Print report" }: { children?: string }) {
  return (
    <button className={`${ghostClass()} no-print`} type="button" onClick={() => window.print()}>
      {children}
    </button>
  );
}
