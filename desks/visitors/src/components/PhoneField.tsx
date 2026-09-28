"use client";

import { PhoneNumber } from "@/domain/PhoneNumber";

export function PhoneField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (digits: string) => void;
}) {
  return (
    <>
      <label htmlFor={id}>Phone number</label>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        pattern="[0-9]*"
        maxLength={15}
        placeholder="0754000000"
        value={value}
        onChange={(event) => onChange(PhoneNumber.digitsOnly(event.target.value))}
        onKeyDown={(event) => {
          const allowed = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
          if (allowed.includes(event.key) || event.ctrlKey || event.metaKey) return;
          if (!/^\d$/.test(event.key)) event.preventDefault();
        }}
        onPaste={(event) => {
          event.preventDefault();
          onChange(PhoneNumber.digitsOnly(event.clipboardData.getData("text")));
        }}
      />
      <div className="field-hint">Digits only — Tanzanian mobiles are usually 10 digits starting with 0.</div>
    </>
  );
}
