"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type {
  MaintenanceCategory,
  MaintenanceRecord,
  MaintenanceStatus,
} from "@/lib/db/maintenance";
import { buildMaintenanceDueCompliance } from "@/lib/compliance/maintenance-compliance";
import { COMPLIANCE_STATUS_STYLES } from "@/lib/compliance/expiry-check";
import type { School } from "@/types/database";
import { countBySchool } from "@/lib/dashboard/campus-count";
import { CampusCountChips } from "@/components/admin/CampusCountChips";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { sortByAlpha } from "@/lib/sort/alphabetical";

const DUE_STYLES = COMPLIANCE_STATUS_STYLES;

/** One record's own title/category/notes/due-badge/cost/expense-link status
 * -- shared by both a standalone record and each line item inside a grouped
 * (same bus + same day) card, so the two don't drift apart visually. */
function RecordSummaryLine({ r }: { r: MaintenanceRecord }) {
  const dueCompliance = buildMaintenanceDueCompliance(r);
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="font-semibold text-ink">{r.title}</p>
        <p className="text-xs text-ink-muted">
          {r.category} · {r.status}
          {r.vendor_name ? ` · ${r.vendor_name}` : ""}
        </p>
        {r.notes ? (
          <p className="mt-1 text-xs text-ink-faint">{r.notes}</p>
        ) : null}
        {r.vat_amount != null || r.labour_cost != null ? (
          <p className="mt-1 text-xs text-ink-faint">
            {r.vat_amount != null ? `VAT ${r.vat_amount.toLocaleString()}` : ""}
            {r.vat_amount != null && r.labour_cost != null ? " · " : ""}
            {r.labour_cost != null ? `Labour ${r.labour_cost.toLocaleString()}` : ""}
          </p>
        ) : null}
        {dueCompliance ? (
          <span
            className={`mt-1 inline-block rounded-[var(--radius-sm)] px-2 py-1 text-xs font-semibold ${DUE_STYLES[dueCompliance.status]}`}
          >
            {dueCompliance.note}
          </span>
        ) : null}
      </div>
      <div className="text-right">
        <p className="font-semibold text-electric-blue">
          {Number(r.cost).toLocaleString()} {r.currency}
        </p>
        <p
          className={`mt-1 text-xs font-semibold ${
            r.expense_id ? "text-success" : "text-ink-faint"
          }`}
        >
          {r.expense_id
            ? `Expense ${r.expense_id.slice(0, 8)}…`
            : "No expense linked"}
        </p>
      </div>
    </div>
  );
}

const CATEGORIES: MaintenanceCategory[] = sortByAlpha(
  [
    "service",
    "repair",
    "tyre",
    "fuel_system",
    "body",
    "inspection",
    "other",
  ] as MaintenanceCategory[],
  (c) => c.replace("_", " "),
);

const STATUSES: MaintenanceStatus[] = sortByAlpha(
  ["open", "in_progress", "done", "cancelled"] as MaintenanceStatus[],
  (s) => s.replace("_", " "),
);

// <select> can't use "" for this option (a required select treats an
// empty-string value as "nothing chosen" for HTML validation purposes even
// with a labeled option there) -- use a real sentinel and convert to null
// at submit time.
const FLEET_WIDE = "__fleet_wide__";
const FLEET_WIDE_LABEL = "Fleet-wide (no specific bus)";

type BusOption = { id: string; label: string; plate_number: string; school_id: string };

type ExpenseOption = {
  id: string;
  bus_id: string | null;
  title: string;
  amount: number;
  currency: string;
  category: string;
  spent_on: string;
};

type Props = {
  initialRecords: MaintenanceRecord[];
  buses: BusOption[];
  expenses?: ExpenseOption[];
  schools: School[];
};

export function MaintenanceClient({
  initialRecords,
  buses,
  expenses = [],
  schools,
}: Props) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [records, setRecords] = useState(initialRecords);
  const [busId, setBusId] = useState(buses[0]?.id ?? FLEET_WIDE);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<MaintenanceCategory>("service");
  const [status, setStatus] = useState<MaintenanceStatus>("open");
  const [cost, setCost] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vatAmount, setVatAmount] = useState("");
  const [labourCost, setLabourCost] = useState("");
  const [notes, setNotes] = useState("");
  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  // Defaults on -- most repairs should hit the budget unless deliberately
  // excluded, and this is the field that actually drives budget-vs-actual
  // tracking on the finance side.
  const [createExpense, setCreateExpense] = useState(true);
  const [expenseId, setExpenseId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [filterBusId, setFilterBusId] = useState("");
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);

  const busSchoolMap = useMemo(
    () => new Map(buses.map((b) => [b.id, b.school_id])),
    [buses],
  );
  const campusCounts = useMemo(
    () =>
      countBySchool(
        records,
        (r) => (r.bus_id ? busSchoolMap.get(r.bus_id) : undefined),
        schools,
      ),
    [records, busSchoolMap, schools],
  );
  const busesAz = useMemo(
    () => sortByAlpha(buses, (b) => b.label),
    [buses],
  );

  const busChoices = useMemo(() => {
    const list = selectedSchoolId
      ? busesAz.filter((b) => b.school_id === selectedSchoolId)
      : busesAz;
    return sortByAlpha(list, (b) => b.label);
  }, [busesAz, selectedSchoolId]);

  function selectSchool(schoolId: string | null) {
    setSelectedSchoolId(schoolId);
    if (schoolId && filterBusId && busSchoolMap.get(filterBusId) !== schoolId) {
      setFilterBusId("");
    }
  }

  const maintenanceExpenses = useMemo(
    () =>
      sortByAlpha(
        expenses.filter(
          (e) => e.category === "maintenance" || e.category === "parts",
        ),
        (e) => e.title,
      ),
    [expenses],
  );

  // No maintenance_line_items table -- itemized parts are logged as their
  // own "parts"-category expenses in the Finance Ledger, tied to the same
  // bus. Group those by bus_id + exact service_date match so a job's parts
  // show up here without a formal DB relationship between the two tables.
  const partsByBusAndDate = useMemo(() => {
    const map = new Map<string, ExpenseOption[]>();
    for (const e of expenses) {
      // Fleet-wide (bus_id null) parts expenses are deliberately excluded:
      // unlike a real bus, "fleet-wide + same day" doesn't identify one job
      // (two unrelated fleet-wide invoices can land the same day), and
      // groupedVisible below keys fleet-wide records by their own id for
      // exactly that reason -- there's no shared key to attach parts to
      // without a real FK. They still show up fine in the raw Finance
      // Ledger, just not grouped under a maintenance card here.
      if (e.category !== "parts" || !e.bus_id) continue;
      const key = `${e.bus_id}|${e.spent_on}`;
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [expenses]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setOkMsg(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const costNum = cost.trim() === "" ? 0 : Number(cost);
    if (!Number.isFinite(costNum) || costNum < 0) {
      setError("Cost must be a non-negative number.");
      return;
    }
    const vatNum = vatAmount.trim() === "" ? null : Number(vatAmount);
    if (vatNum !== null && (!Number.isFinite(vatNum) || vatNum < 0)) {
      setError("VAT must be a non-negative number.");
      return;
    }
    const labourNum = labourCost.trim() === "" ? null : Number(labourCost);
    if (labourNum !== null && (!Number.isFinite(labourNum) || labourNum < 0)) {
      setError("Labour cost must be a non-negative number.");
      return;
    }

    const willCreateExpense = !expenseId && createExpense && costNum > 0;
    const busLabel =
      busId === FLEET_WIDE
        ? FLEET_WIDE_LABEL
        : buses.find((b) => b.id === busId)?.label ?? busId;
    const linkedExpense = expenseId
      ? maintenanceExpenses.find((exp) => exp.id === expenseId)
      : undefined;
    const linkPart = expenseId
      ? ` and link it to "${linkedExpense?.title ?? "the selected expense"}"`
      : willCreateExpense
        ? ` and create a new ${costNum.toLocaleString()} TZS finance expense`
        : "";
    const ok = await confirm({
      title: "Save maintenance record?",
      message: `Log "${title.trim()}" for ${busLabel}${linkPart}?`,
      confirmLabel: "Save",
    });
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          busId: busId === FLEET_WIDE ? null : busId,
          title: title.trim(),
          category,
          status,
          cost: costNum,
          vendorName: vendorName.trim() || undefined,
          vatAmount: vatNum,
          labourCost: labourNum,
          notes: notes.trim() || undefined,
          serviceDate: serviceDate || undefined,
          dueDate: dueDate || undefined,
          expenseId: expenseId || undefined,
          createExpense: willCreateExpense,
        }),
      });
      const data = (await res.json()) as {
        record?: MaintenanceRecord;
        error?: string;
      };
      if (!res.ok || !data.record) {
        setError(data.error ?? "Failed to create maintenance record");
        return;
      }
      setRecords((prev) => [data.record!, ...prev]);
      const linked = data.record.expense_id
        ? ` · expense ${data.record.expense_id.slice(0, 8)}…`
        : willCreateExpense
          ? " · expense create requested"
          : "";
      setOkMsg(`Maintenance logged${linked}`);
      setTitle("");
      setCost("");
      setVendorName("");
      setVatAmount("");
      setLabourCost("");
      setNotes("");
      setServiceDate(new Date().toISOString().slice(0, 10));
      setDueDate("");
      setCreateExpense(true);
      setExpenseId("");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  const visible = records.filter(
    (r) =>
      (!filterBusId ||
        (filterBusId === FLEET_WIDE ? r.bus_id === null : r.bus_id === filterBusId)) &&
      (!selectedSchoolId ||
        (r.bus_id ? busSchoolMap.get(r.bus_id) : undefined) === selectedSchoolId),
  );

  // Historical parts-per-job data was seeded as one maintenance_records row
  // per PART (same bus, same service_date), not grouped under one job -- a
  // single repair visit can show up as 8 separate flat rows. Group same
  // bus + same day together so they render as one card instead, without
  // changing anything for the common case of one record = one job (group
  // size 1 renders identically to before).
  const groupedVisible = useMemo(() => {
    const map = new Map<string, MaintenanceRecord[]>();
    for (const r of visible) {
      const dateKey = r.service_date ?? r.created_at.slice(0, 10);
      // Fleet-wide records (bus_id null) have no bus to group by -- keying
      // on the record's own id keeps each one its own card instead of
      // merging unrelated same-day fleet-wide charges (e.g. two different
      // "Labour charges" invoices dated the same day) into one.
      const key = r.bus_id ? `${r.bus_id}|${dateKey}` : `fleet-wide|${r.id}`;
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return [...map.values()];
  }, [visible]);

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={(e) => void submit(e)}
        className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Log maintenance / repair
        </h2>
        {error ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {okMsg ? (
          <p className="mt-2 text-sm font-semibold text-success" role="status">
            {okMsg}
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Bus</span>
            <select
              value={busId}
              onChange={(e) => setBusId(e.target.value)}
              required
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              {busesAz.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label} ({b.plate_number})
                </option>
              ))}
              {/* schema_maintenance.sql's "drop not null" migration for
                  bus_id is written but not yet applied live (confirmed
                  2026-08-19) -- picking this before then surfaces
                  createMaintenance's friendly "not enabled yet" error
                  instead of a raw constraint violation, so it's safe to
                  offer now and it starts working the moment Kai runs it. */}
              <option value={FLEET_WIDE}>{FLEET_WIDE_LABEL}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Oil change / brake pads"
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MaintenanceCategory)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MaintenanceStatus)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Cost (TZS)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Service date</span>
            <input
              type="date"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          {/* Vendor/VAT/Labour inputs hidden until maintenance_records
              .vendor_name/vat_amount/labour_cost are applied live
              (schema_maintenance.sql) -- state/validation/submit logic kept
              so it's a quick JSX re-add once the migration lands. */}
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-semibold text-ink">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
        </div>
        <div className="mt-4 rounded-[var(--radius-sm)] border border-dashed border-card-border bg-light-blue-30/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Expense link
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={createExpense && !expenseId}
              disabled={Boolean(expenseId)}
              onChange={(e) => setCreateExpense(e.target.checked)}
              className="mt-0.5 rounded border-card-border"
            />
            <span>
              Create a new finance expense from this cost when amount &gt; 0
              {!expenseId ? "" : " (disabled while linking an existing expense)"}
            </span>
          </label>
          <label className="mt-3 flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Or link existing expense</span>
            <select
              value={expenseId}
              onChange={(e) => {
                setExpenseId(e.target.value);
                if (e.target.value) setCreateExpense(false);
              }}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              <option value="">None — use create expense flag</option>
              {maintenanceExpenses.map((exp) => (
                <option key={exp.id} value={exp.id}>
                  {exp.title} · {exp.currency} {exp.amount.toLocaleString()} ·{" "}
                  {exp.spent_on}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={saving || buses.length === 0}
          className="mt-4 rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save record"}
        </button>
      </form>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-bold text-electric-blue">Records</h2>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Filter by bus</span>
            <select
              value={filterBusId}
              onChange={(e) => setFilterBusId(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              <option value="">All buses</option>
              {busChoices.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
              <option value={FLEET_WIDE}>{FLEET_WIDE_LABEL}</option>
            </select>
          </label>
        </div>

        <CampusCountChips
          counts={campusCounts}
          selected={selectedSchoolId}
          onSelect={selectSchool}
        />

        <ul className="mt-4 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
          {groupedVisible.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">
              No maintenance records yet.
            </li>
          ) : (
            groupedVisible.map((group) => {
              const first = group[0];
              const busDisplayLabel = first.bus_label ?? first.bus_id ?? "Fleet-wide";
              const serviceDate = first.service_date ?? first.created_at.slice(0, 10);
              const parts = partsByBusAndDate.get(`${first.bus_id}|${serviceDate}`) ?? [];
              const partsTotal = parts.reduce((s, p) => s + p.amount, 0);
              const groupTotal = group.reduce((s, r) => s + Number(r.cost), 0);
              const partsBlock =
                parts.length > 0 ? (
                  <div className="mt-2 rounded-[var(--radius-sm)] border border-dashed border-card-border bg-light-blue-30/40 px-2 py-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                      Parts logged this day · {partsTotal.toLocaleString()}{" "}
                      {parts[0]?.currency}
                    </p>
                    <ul className="mt-0.5 text-xs text-ink-faint">
                      {parts.map((p) => (
                        <li key={p.id}>
                          {p.title} — {p.amount.toLocaleString()} {p.currency}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null;

              if (group.length === 1) {
                return (
                  <li key={first.id} className="px-4 py-3 text-sm">
                    <p className="text-xs text-ink-muted">
                      {busDisplayLabel} · {serviceDate}
                    </p>
                    <div className="mt-1">
                      <RecordSummaryLine r={first} />
                      {partsBlock}
                    </div>
                  </li>
                );
              }

              return (
                <li
                  key={`${first.bus_id}|${serviceDate}`}
                  className="px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      {busDisplayLabel} · {serviceDate} ·{" "}
                      {group.length} line items
                    </p>
                    <p className="font-semibold text-electric-blue">
                      Total {groupTotal.toLocaleString()} {first.currency}
                    </p>
                  </div>
                  <ul className="mt-2 flex flex-col gap-2 divide-y divide-card-border/60">
                    {group.map((r) => (
                      <li key={r.id} className="pt-2 first:pt-0">
                        <RecordSummaryLine r={r} />
                      </li>
                    ))}
                  </ul>
                  {partsBlock}
                </li>
              );
            })
          )}
        </ul>
      </section>
      {dialog}
    </div>
  );
}
