"use client";

import QRCode from "react-qr-code";

type Props = {
  code: string;
  studentName?: string;
  size?: "sm" | "lg";
};

const pixelSize = {
  sm: 96,
  lg: 240,
} as const;

export function StudentQrDisplay({
  code,
  studentName,
  size = "sm",
}: Props) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div
        className={`bg-white ${
          size === "lg"
            ? "rounded-[var(--radius)] border border-card-border p-4 shadow-[var(--shadow)] ring-1 ring-electric-blue/10"
            : "rounded-xl p-1"
        }`}
      >
        <QRCode value={code} size={pixelSize[size]} />
      </div>
      {studentName ? (
        <p className="text-sm font-semibold text-ink">{studentName}</p>
      ) : null}
      <p
        className={`font-mono font-bold tracking-wide ${
          size === "lg"
            ? "text-[11px] text-electric-blue"
            : "max-w-[8rem] truncate text-[10px] text-ink-faint"
        }`}
      >
        {code}
      </p>
    </div>
  );
}
