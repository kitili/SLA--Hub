"use client";

import { useState } from "react";
import { ghostClass } from "./forms";

export function CopyText({ text, children = "Copy pack" }: { text: string; children?: string }) {
  const [status, setStatus] = useState<"idle" | "done" | "failed">("idle");
  return (
    <button
      className={`${ghostClass()} no-print`}
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setStatus("done");
        } catch {
          setStatus("failed");
        }
        setTimeout(() => setStatus("idle"), 1500);
      }}
    >
      {status === "done" ? "Copied" : status === "failed" ? "Couldn't copy" : children}
    </button>
  );
}
