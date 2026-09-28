"use client";

import { useEffect, useMemo, useState } from "react";
import { Btn, Field, inputClass } from "./forms";

export type SkuOption = {
  id: string;
  code: string;
  name: string;
  sellTzs: number;
  buyTzs: number;
  sizes: string[];
};

export type LineRow = { skuId: string; size: string; qty: number; unitTzs?: number };
type Row = LineRow;

function pickSize(sizes: string[]) {
  return sizes.includes("24") ? "24" : (sizes[0] ?? "");
}

export function LinesEditor({
  skus,
  showCost = false,
  initialRows,
}: {
  skus: SkuOption[];
  showCost?: boolean;
  initialRows?: LineRow[];
}) {
  const [rows, setRows] = useState<Row[]>(() => {
    if (initialRows?.length) return initialRows;
    const first = skus[0];
    return [{ skuId: first?.id ?? "", size: pickSize(first?.sizes ?? []), qty: 1 }];
  });

  const byId = useMemo(() => Object.fromEntries(skus.map((s) => [s.id, s])), [skus]);

  return (
    <div className="grid gap-2">
      {rows.map((row, i) => {
        const sku = byId[row.skuId];
        return (
          <div key={i} className="grid gap-2 sm:grid-cols-12">
            <select
              className={`${inputClass()} sm:col-span-5`}
              name="skuId"
              value={row.skuId}
              onChange={(e) => {
                const nextSku = byId[e.target.value];
                const next = [...rows];
                next[i] = { ...row, skuId: e.target.value, size: pickSize(nextSku?.sizes ?? []) };
                setRows(next);
              }}
            >
              {skus.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
            <select
              className={`${inputClass()} sm:col-span-2`}
              name="size"
              value={row.size}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, size: e.target.value };
                setRows(next);
              }}
            >
              {(sku?.sizes ?? []).map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <input
              className={`${inputClass()} sm:col-span-2`}
              name="qty"
              type="number"
              min={1}
              max={500}
              value={row.qty}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, qty: Number(e.target.value) };
                setRows(next);
              }}
            />
            {showCost ? (
              <input
                className={`${inputClass()} sm:col-span-3`}
                name="unitTzs"
                type="number"
                min={0}
                placeholder="Unit TZS"
                defaultValue={row.unitTzs ?? sku?.buyTzs}
              />
            ) : (
              <div className="sm:col-span-3 self-center text-xs text-ink-muted">
                {sku
                  ? `${sku.sellTzs.toLocaleString()} × ${row.qty} = ${(sku.sellTzs * row.qty).toLocaleString()} TZS`
                  : ""}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex gap-2">
        <Btn
          type="button"
          tone="ghost"
          onClick={() => {
            const first = skus[0];
            setRows([...rows, { skuId: first?.id ?? "", size: pickSize(first?.sizes ?? []), qty: 1 }]);
          }}
        >
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

type FoundStudent = {
  name: string;
  className: string;
  gender: string;
  campusId: string;
  campusName: string;
  openOrders?: { ref: string; status: string; orderedAt: string }[];
};

export function StudentLookup({
  showCampus = false,
  campuses = [],
  defaultCampusId = "",
}: {
  showCampus?: boolean;
  campuses?: { id: string; name: string }[];
  defaultCampusId?: string;
}) {
  const [regNo, setRegNo] = useState("");
  const [hint, setHint] = useState("");
  const [found, setFound] = useState<FoundStudent | null>(null);
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [gender, setGender] = useState("GIRL");
  const [campusId, setCampusId] = useState(defaultCampusId);

  useEffect(() => {
    const trimmed = regNo.trim();
    if (trimmed.length < 6) {
      setFound(null);
      setHint("");
      return;
    }
    const timer = window.setTimeout(() => {
      void hydrate(trimmed);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [regNo]);

  async function hydrate(value: string) {
    const res = await fetch(`/api/students?regNo=${encodeURIComponent(value)}`);
    if (!res.ok) {
      setFound(null);
      setHint("No match — type name, class, and gender.");
      return;
    }
    const data = (await res.json()) as FoundStudent & { campusId: string };
    setFound(data);
    setName(data.name);
    setClassName(data.className);
    setGender(data.gender);
    setCampusId(data.campusId);
    setHint(`${data.name} · ${data.className} · ${data.gender} · ${data.campusName}`);
  }

  return (
    <div className="grid gap-3">
      <Field label="Registration number">
        <input
          className={inputClass()}
          name="regNo"
          value={regNo}
          onChange={(e) => setRegNo(e.target.value)}
          onBlur={() => {
            if (regNo.trim()) void hydrate(regNo.trim());
          }}
          placeholder="Registration number"
        />
      </Field>
      {found ? (
        <p className="rounded-[10px] bg-light-blue-30 px-3 py-2 text-sm text-electric-blue">{hint}</p>
      ) : null}
      {found?.openOrders?.length ? (
        <p className="rounded-[10px] border border-gold bg-gold-15 px-3 py-2 text-sm">
          Already has {found.openOrders.length} open coupon{found.openOrders.length > 1 ? "s" : ""}:{" "}
          {found.openOrders.map((o) => `${o.ref} (${o.status}, ${o.orderedAt})`).join(", ")} — creating another
          won&apos;t replace it. Check it isn&apos;t a duplicate before continuing.
        </p>
      ) : null}
      {!found ? (
        <>
          {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
          <Field label="Student name">
            <input className={inputClass()} name="studentName" required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Class">
              <input className={inputClass()} name="className" required value={className} onChange={(e) => setClassName(e.target.value)} />
            </Field>
            <Field label="Gender">
              <select className={inputClass()} name="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option>GIRL</option>
                <option>BOY</option>
              </select>
            </Field>
          </div>
        </>
      ) : null}
      {found ? (
        <>
          <input type="hidden" name="studentName" value={found.name} />
          <input type="hidden" name="className" value={found.className} />
          <input type="hidden" name="gender" value={found.gender} />
        </>
      ) : null}
      {showCampus ? (
        <Field label="Campus">
          <select className={inputClass()} name="campusId" value={campusId} onChange={(e) => setCampusId(e.target.value)}>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
    </div>
  );
}

export function SkuSizeFields({
  skus,
  showName = false,
  initialSkuId,
  initialSize,
}: {
  skus: { id: string; code: string; name: string; sizes: string[] }[];
  showName?: boolean;
  initialSkuId?: string;
  initialSize?: string;
}) {
  const [skuId, setSkuId] = useState(initialSkuId ?? skus[0]?.id ?? "");
  const sku = skus.find((s) => s.id === skuId);
  const sizes = sku?.sizes ?? [];
  const [size, setSize] = useState(initialSize ?? pickSize(sizes));

  return (
    <>
      <Field label="SKU">
        <select
          className={inputClass()}
          name="skuId"
          value={skuId}
          onChange={(e) => {
            const next = skus.find((s) => s.id === e.target.value);
            setSkuId(e.target.value);
            setSize(pickSize(next?.sizes ?? []));
          }}
        >
          {skus.map((s) => (
            <option key={s.id} value={s.id}>
              {showName ? `${s.code} · ${s.name}` : s.code}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Size">
        <select className={inputClass()} name="size" value={size} onChange={(e) => setSize(e.target.value)}>
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}
