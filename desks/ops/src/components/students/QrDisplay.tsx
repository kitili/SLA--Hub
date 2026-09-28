"use client";

import QRCode from "react-qr-code";

type Props = {
  value: string;
  size?: number;
};

export function QrDisplay({ value, size = 88 }: Props) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-card-border bg-white p-2.5 shadow-[var(--shadow)]">
      <QRCode value={value} size={size} />
    </div>
  );
}
