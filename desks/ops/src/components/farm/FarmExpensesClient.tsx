"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FarmCrudActions } from "@/components/farm/FarmCrudActions";
import type {
  FarmBudget,
  FarmBudgetCategory,
  FarmExpense,
  FarmExpenseCategory,
  FarmPlot,
} from "@/lib/db/farm";

const EXPENSE_CATEGORIES: FarmExpenseCategory[] = [
  "seed",
  "fertilizer",
  "labor",
  "tools",
  "irrigation",
  "pest_control",
  "other",
];

const BUDGET_CATEGORIES: FarmBudgetCategory[] = [
  "all",
  "seed",
  "fertilizer",
  "labor",
  "tools",
  "irrigation",
  "pest_control",
  "other",
];

type Tab = "expenses" | "budgets";

type Props = {
  plots: FarmPlot[];
  initialExpenses: FarmExpense[];
  initialBudgets: FarmBudget[];
};

function money(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString()}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plotCodeFor(plots: FarmPlot[], plotId: string | null) {
  if (!plotId) return "—";
  return plots.find((p) => p.id === plotId)?.code ?? "—";
}

export function FarmExpensesClient({
  plots,
  initialExpenses,
  initialBudgets,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("expenses");
  const [expenses, setExpenses] = useState(initialExpenses);
  const [budgets, setBudgets] = useState(initialBudgets);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  const [expCategory, setExpCategory] = useState<FarmExpenseCategory>("seed");
  const [expAmount, setExpAmount] = useState("");
  const [expCurrency, setExpCurrency] = useState("TZS");
  const [expDate, setExpDate] = useState(todayIso);
  const [expPlotId, setExpPlotId] = useState("");
  const [expNotes, setExpNotes] = useState("");

  const [budCategory, setBudCategory] = useState<FarmBudgetCategory>("all");
  const [budPeriod, setBudPeriod] = useState("");
  const [budPlannedAmount, setBudPlannedAmount] = useState("");
  const [budNotes, setBudNotes] = useState("");

  function clearFlash() {
    setError(null);
    setOkMsg(null);
  }

  function resetExpenseForm() {
    setEditingExpenseId(null);
    setExpCategory("seed");
    setExpAmount("");
    setExpCurrency("TZS");
    setExpDate(todayIso());
    setExpPlotId("");
    setExpNotes("");
  }

  function startEditExpense(row: FarmExpense) {
    setEditingExpenseId(row.id);
    setExpCategory(row.category);
    setExpAmount(String(row.amount));
    setExpCurrency(row.currency);
    setExpDate(row.spent_on);
    setExpPlotId(row.plot_id ?? "");
    setExpNotes(row.notes ?? "");
    clearFlash();
  }

  function startEditBudget(row: FarmBudget) {
    setEditingBudgetId(row.id);
    setBudCategory(row.category);
    setBudPeriod(row.period);
    setBudPlannedAmount(String(row.planned_amount));
    setBudNotes(row.notes ?? "");
    clearFlash();
  }

  async function deleteExpenseRow(id: string) {
    if (!confirm("Delete this expense?")) return;
    const res = await fetch(`/api/farm/expenses/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
      return;
    }
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    if (editingExpenseId === id) resetExpenseForm();
    router.refresh();
  }

  async function deleteBudgetRow(id: string) {
    if (!confirm("Delete this budget envelope?")) return;
    const res = await fetch(`/api/farm/budgets/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
      return;
    }
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    if (editingBudgetId === id) {
      setEditingBudgetId(null);
      setBudPlannedAmount("");
      setBudNotes("");
    }
    router.refresh();
  }

  async function submitExpense(e: React.FormEvent) {
    e.preventDefault();
    clearFlash();
    const amount = Number(expAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("A non-negative amount is required");
      return;
    }
    setSaving(true);
    try {
      const isEdit = Boolean(editingExpenseId);
      const res = await fetch(
        isEdit ? `/api/farm/expenses/${editingExpenseId}` : "/api/farm/expenses",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: expCategory,
            amount,
            currency: expCurrency || undefined,
            spentOn: expDate || undefined,
            plotId: expPlotId || null,
            notes: expNotes.trim() || null,
          }),
        },
      );
      const data = (await res.json()) as { expense?: FarmExpense; error?: string };
      if (!res.ok || !data.expense) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setExpenses((prev) =>
        isEdit
          ? prev.map((e) => (e.id === data.expense!.id ? data.expense! : e))
          : [data.expense!, ...prev],
      );
      setOkMsg(
        `${isEdit ? "Updated" : "Saved"} · ${money(data.expense.currency, data.expense.amount)}`,
      );
      resetExpenseForm();
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  async function submitBudget(e: React.FormEvent) {
    e.preventDefault();
    clearFlash();
    const plannedAmount = Number(budPlannedAmount);
    if (!budPeriod.trim()) {
      setError("Period is required, e.g. 2026-08");
      return;
    }
    if (!Number.isFinite(plannedAmount) || plannedAmount < 0) {
      setError("A non-negative planned amount is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/farm/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: budCategory,
          period: budPeriod.trim(),
          plannedAmount,
          notes: budNotes.trim() || null,
        }),
      });
      const data = (await res.json()) as { budget?: FarmBudget; error?: string };
      if (!res.ok || !data.budget) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setBudgets((prev) => {
        const existingIdx = prev.findIndex((b) => b.id === data.budget!.id);
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = data.budget!;
          return next;
        }
        return [data.budget!, ...prev];
      });
      setOkMsg(
        `Budget set · ${data.budget.category} ${data.budget.period} · ${money(
          data.budget.currency,
          data.budget.planned_amount,
        )}`,
      );
      setBudPlannedAmount("");
      setBudNotes("");
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "expenses", label: "Expenses" },
    { id: "budgets", label: "Budgets" },
  ];

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-1 rounded-[var(--radius)] border border-card-border bg-card p-1 shadow-[var(--shadow)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              clearFlash();
            }}
            className={`rounded-[var(--radius-sm)] px-4 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-electric-blue text-white"
                : "text-electric-blue hover:bg-light-blue-30"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 text-sm font-semibold text-danger">{error}</p>
      ) : null}
      {okMsg ? (
        <p className="mt-4 text-sm font-semibold text-success">{okMsg}</p>
      ) : null}

      {tab === "expenses" ? (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <form
            onSubmit={submitExpense}
            className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {editingExpenseId ? "Edit expense" : "Add expense"}
            </h2>
            <p className="mt-1 text-xs text-ink-faint">
              Posts to <code>POST /api/farm/expenses</code>
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Category</span>
                <select
                  value={expCategory}
                  onChange={(e) =>
                    setExpCategory(e.target.value as FarmExpenseCategory)
                  }
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Amount</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  required
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Currency</span>
                <input
                  value={expCurrency}
                  onChange={(e) => setExpCurrency(e.target.value)}
                  placeholder="TZS"
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Spent on</span>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Plot (optional)</span>
                <select
                  value={expPlotId}
                  onChange={(e) => setExpPlotId(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                >
                  <option value="">None</option>
                  {plots.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code}
                      {p.name ? ` · ${p.name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Notes</span>
                <textarea
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  rows={2}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
                >
                  {saving ? "Saving…" : editingExpenseId ? "Update expense" : "Save expense"}
                </button>
                {editingExpenseId ? (
                  <button
                    type="button"
                    onClick={resetExpenseForm}
                    className="rounded-[var(--radius-sm)] border border-card-border px-4 py-2 text-sm font-semibold text-ink-muted"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </form>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Expense ledger
            </h2>
            {expenses.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">No expenses yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-ink-muted">
                      <th className="px-4 py-2">Category</th>
                      <th className="px-4 py-2">Amount</th>
                      <th className="px-4 py-2">Plot</th>
                      <th className="px-4 py-2">Spent on</th>
                      <th className="px-4 py-2">Notes</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((row) => (
                      <tr key={row.id} className="border-t border-card-border">
                        <td className="px-4 py-2 capitalize">
                          {row.category.replaceAll("_", " ")}
                        </td>
                        <td className="px-4 py-2 font-semibold text-electric-blue">
                          {money(row.currency, row.amount)}
                        </td>
                        <td className="px-4 py-2">
                          {plotCodeFor(plots, row.plot_id)}
                        </td>
                        <td className="px-4 py-2">{row.spent_on}</td>
                        <td className="px-4 py-2 text-ink-muted">
                          {row.notes ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <FarmCrudActions
                            onEdit={() => startEditExpense(row)}
                            onDelete={() => void deleteExpenseRow(row.id)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === "budgets" ? (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <form
            onSubmit={submitBudget}
            className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {editingBudgetId ? "Edit budget" : "Set/update budget for this period"}
            </h2>
            <p className="mt-1 text-xs text-ink-faint">
              Posts to <code>POST /api/farm/budgets</code> — resubmitting the
              same category + period updates the planned amount.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Category</span>
                <select
                  value={budCategory}
                  onChange={(e) =>
                    setBudCategory(e.target.value as FarmBudgetCategory)
                  }
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                >
                  {BUDGET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Period</span>
                <input
                  value={budPeriod}
                  onChange={(e) => setBudPeriod(e.target.value)}
                  required
                  placeholder="2026-08"
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">
                  Planned amount (TZS)
                </span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={budPlannedAmount}
                  onChange={(e) => setBudPlannedAmount(e.target.value)}
                  required
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Notes</span>
                <textarea
                  value={budNotes}
                  onChange={(e) => setBudNotes(e.target.value)}
                  rows={2}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save budget"}
                </button>
              </div>
            </div>
          </form>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Budget envelopes
            </h2>
            {budgets.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">No budgets yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-ink-muted">
                      <th className="px-4 py-2">Category</th>
                      <th className="px-4 py-2">Period</th>
                      <th className="px-4 py-2">Planned</th>
                      <th className="px-4 py-2">Notes</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgets.map((row) => (
                      <tr key={row.id} className="border-t border-card-border">
                        <td className="px-4 py-2 capitalize">
                          {row.category.replaceAll("_", " ")}
                        </td>
                        <td className="px-4 py-2">{row.period}</td>
                        <td className="px-4 py-2 font-semibold text-electric-blue">
                          {money(row.currency, row.planned_amount)}
                        </td>
                        <td className="px-4 py-2 text-ink-muted">
                          {row.notes ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <FarmCrudActions
                            onEdit={() => startEditBudget(row)}
                            onDelete={() => void deleteBudgetRow(row.id)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
