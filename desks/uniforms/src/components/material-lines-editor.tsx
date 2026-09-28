"use client";

import { useState } from "react";
import { Btn, inputClass } from "./forms";

export type PayeeOption = { id: string; name: string; phone?: string };

type Row = {
  kind: string;
  materialKind: string;
  description: string;
  qty: number;
  unit: string;
  unitCostTzs: number;
  payeeId: string;
};

const BLANK_ROW: Row = { kind: "MATERIAL", materialKind: "FABRIC", description: "", qty: 1, unit: "m", unitCostTzs: 0, payeeId: "" };

export function MaterialLinesEditor({ payees }: { payees: PayeeOption[] }) {
  const [rows, setRows] = useState<Row[]>([{ ...BLANK_ROW }]);

  function update(i: number, patch: Partial<Row>) {
    const next = [...rows];
    next[i] = { ...next[i], ...patch };
    setRows(next);
  }

  return (
    <div className="grid gap-2">
      {rows.map((row, i) => (
        <div key={i} className="grid gap-2 border-b border-card-border pb-2 last:border-0 sm:grid-cols-12">
          <select
            className={`${inputClass()} sm:col-span-2`}
            name="kind"
            value={row.kind}
            onChange={(e) => update(i, { kind: e.target.value })}
          >
            <option value="MATERIAL">Material</option>
            <option value="LABOUR">Labour</option>
          </select>
          {row.kind === "MATERIAL" ? (
            <select
              className={`${inputClass()} sm:col-span-2`}
              name="materialKind"
              value={row.materialKind}
              onChange={(e) => update(i, { materialKind: e.target.value })}
            >
              <option>FABRIC</option>
              <option>JORA</option>
              <option>SUPPLY</option>
            </select>
          ) : (
            <input type="hidden" name="materialKind" value="FABRIC" />
          )}
          <input
            className={`${inputClass()} ${row.kind === "MATERIAL" ? "sm:col-span-3" : "sm:col-span-5"}`}
            name="description"
            placeholder={row.kind === "MATERIAL" ? "Light-blue polo fabric" : "Stitching 12 sweaters"}
            value={row.description}
            onChange={(e) => update(i, { description: e.target.value })}
            required
          />
          <input
            className={`${inputClass()} sm:col-span-1`}
            name="qty"
            type="number"
            min={1}
            value={row.qty}
            onChange={(e) => update(i, { qty: Number(e.target.value) })}
          />
          <input
            className={`${inputClass()} sm:col-span-1`}
            name="unit"
            placeholder="m / pcs"
            value={row.unit}
            onChange={(e) => update(i, { unit: e.target.value })}
          />
          <input
            className={`${inputClass()} sm:col-span-2`}
            name="unitCostTzs"
            type="number"
            min={0}
            placeholder={row.kind === "LABOUR" ? "Real rate TZS" : "Imani prices this"}
            value={row.unitCostTzs || ""}
            onChange={(e) => update(i, { unitCostTzs: Number(e.target.value) })}
          />
          {row.kind === "LABOUR" ? (
            <select
              className={`${inputClass()} sm:col-span-1`}
              name="payeeId"
              value={row.payeeId}
              onChange={(e) => update(i, { payeeId: e.target.value })}
            >
              <option value="">Paid to…</option>
              {payees.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          ) : (
            <input type="hidden" name="payeeId" value="" />
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Btn type="button" tone="ghost" onClick={() => setRows([...rows, { ...BLANK_ROW }])}>
          Add line
        </Btn>
        {rows.length > 1 ? (
          <button type="button" className="text-sm text-ink-muted" onClick={() => setRows(rows.slice(0, -1))}>
            Remove last
          </button>
        ) : null}
      </div>
    </div>
  );
}
