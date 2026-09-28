"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Budget,
  BudgetCategory,
  Expense,
  ExpenseCategory,
  Revenue,
  RevenueCategory,
} from "@/lib/db/finance";
import type { RevenueTarget } from "@/lib/db/revenue-targets";
import { budgetMatchesExpense } from "@/lib/finance/budget-match";
import { revenueTargetMatchesRevenue } from "@/lib/finance/revenue-target-match";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { LastEditedBy } from "@/components/ui/LastEditedBy";

type SchoolOption = { id: string; name: string; slug: string };
type BusOption = {
  id: string;
  label: string;
  plate_number: string;
  school_id: string;
};

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "fuel",
  "maintenance",
  "salary",
  "insurance",
  "toll",
  "parts",
  "hire_cost",
  "other",
];

const REVENUE_CATEGORIES: RevenueCategory[] = [
  "transport_fees",
  "hire_out",
  "grant",
  "other",
];

const BUDGET_CATEGORIES: BudgetCategory[] = [
  "fuel",
  "maintenance",
  "salary",
  "insurance",
  "ops",
  "hire_cost",
  "other",
];

// hire_cost reads as ambiguous next to hire_out (revenue) -- it's actually
// bus lease/rental payments, not a hire-out job's cost. Every other category
// is self-explanatory as its raw name, so only this one needs a real label.
function categoryLabel(category: string): string {
  if (category === "hire_cost") return "bus lease / hire cost";
  return category.replaceAll("_", " ");
}

type Tab = "expenses" | "revenues" | "budgets" | "revenue-targets";

type Props = {
  schools: SchoolOption[];
  buses: BusOption[];
  initialExpenses: Expense[];
  initialRevenues: Revenue[];
  initialBudgets: Budget[];
  initialRevenueTargets: RevenueTarget[];
  profileLabels?: Record<string, string>;
};

function money(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString()}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function LedgerClient({
  schools,
  buses,
  initialExpenses,
  initialRevenues,
  initialBudgets,
  initialRevenueTargets,
  profileLabels,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, dialog } = useConfirm();
  const [tab, setTab] = useState<Tab>(
    searchParams.get("tab") === "budgets"
      ? "budgets"
      : searchParams.get("tab") === "revenue-targets"
        ? "revenue-targets"
        : "expenses",
  );
  const initialCategoryParam = searchParams.get("category");
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "all">(
    initialCategoryParam && EXPENSE_CATEGORIES.includes(initialCategoryParam as ExpenseCategory)
      ? (initialCategoryParam as ExpenseCategory)
      : "all",
  );
  const [budgetFilterId, setBudgetFilterId] = useState<string | null>(
    searchParams.get("budget"),
  );
  const [expenses, setExpenses] = useState(initialExpenses);
  const [revenues, setRevenues] = useState(initialRevenues);
  const [budgets, setBudgets] = useState(initialBudgets);
  const [revenueTargets, setRevenueTargets] = useState(initialRevenueTargets);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] =
    useState<ExpenseCategory>("fuel");
  const [expDate, setExpDate] = useState(todayIso);
  const [expSchoolId, setExpSchoolId] = useState(schools[0]?.id ?? "");
  const [expBusId, setExpBusId] = useState("");
  const [expNotes, setExpNotes] = useState("");

  const [revTitle, setRevTitle] = useState("");
  const [revAmount, setRevAmount] = useState("");
  const [revCategory, setRevCategory] =
    useState<RevenueCategory>("transport_fees");
  const [revDate, setRevDate] = useState(todayIso);
  const [revSchoolId, setRevSchoolId] = useState(schools[0]?.id ?? "");
  const [revBusId, setRevBusId] = useState("");
  const [revNotes, setRevNotes] = useState("");

  const [budName, setBudName] = useState("");
  const [budAmount, setBudAmount] = useState("");
  const [budCategory, setBudCategory] = useState<BudgetCategory>("ops");
  const [budStart, setBudStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
  });
  const [budEnd, setBudEnd] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 3, 0)
      .toISOString()
      .slice(0, 10);
  });
  const [budSchoolId, setBudSchoolId] = useState(schools[0]?.id ?? "");
  const [budBusId, setBudBusId] = useState("");
  const [budNotes, setBudNotes] = useState("");

  const [rtName, setRtName] = useState("");
  const [rtAmount, setRtAmount] = useState("");
  const [rtCategory, setRtCategory] = useState<RevenueCategory>("transport_fees");
  const [rtStart, setRtStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
  });
  const [rtEnd, setRtEnd] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), 11, 31).toISOString().slice(0, 10);
  });
  const [rtSchoolId, setRtSchoolId] = useState("");
  const [rtBusId, setRtBusId] = useState("");
  const [rtNotes, setRtNotes] = useState("");

  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingRevenueId, setEditingRevenueId] = useState<string | null>(null);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editingRevenueTargetId, setEditingRevenueTargetId] = useState<string | null>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showRevenueForm, setShowRevenueForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const expenseListRef = useRef<HTMLDivElement | null>(null);

  function startEditExpense(row: Expense) {
    setShowExpenseForm(true);
    setEditingExpenseId(row.id);
    setExpTitle(row.title);
    setExpAmount(String(row.amount));
    setExpCategory(row.category);
    setExpDate(row.spent_on);
    setExpSchoolId(row.school_id ?? schools[0]?.id ?? "");
    setExpBusId(row.bus_id ?? "");
    setExpNotes(row.notes ?? "");
    clearFlash();
  }

  function cancelEditExpense() {
    setShowExpenseForm(false);
    setEditingExpenseId(null);
    setExpTitle("");
    setExpAmount("");
    setExpNotes("");
  }

  async function deleteExpenseRow(row: Expense) {
    const ok = await confirm({
      title: "Delete this expense?",
      message: `Delete "${row.title}" — ${money(row.currency, row.amount)} (${categoryLabel(row.category)})? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/expenses?id=${row.id}`, { method: "DELETE" });
    if (res.ok) {
      setExpenses((prev) => prev.filter((r) => r.id !== row.id));
      if (editingExpenseId === row.id) cancelEditExpense();
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
    }
  }

  function startEditRevenue(row: Revenue) {
    setShowRevenueForm(true);
    setEditingRevenueId(row.id);
    setRevTitle(row.title);
    setRevAmount(String(row.amount));
    setRevCategory(row.category);
    setRevDate(row.earned_on);
    setRevSchoolId(row.school_id ?? schools[0]?.id ?? "");
    setRevBusId(row.bus_id ?? "");
    setRevNotes(row.notes ?? "");
    clearFlash();
  }

  function cancelEditRevenue() {
    setShowRevenueForm(false);
    setEditingRevenueId(null);
    setRevTitle("");
    setRevAmount("");
    setRevNotes("");
  }

  async function deleteRevenueRow(row: Revenue) {
    const ok = await confirm({
      title: "Delete this revenue?",
      message: `Delete "${row.title}" — ${money(row.currency, row.amount)} (${categoryLabel(row.category)})? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/revenues?id=${row.id}`, { method: "DELETE" });
    if (res.ok) {
      setRevenues((prev) => prev.filter((r) => r.id !== row.id));
      if (editingRevenueId === row.id) cancelEditRevenue();
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
    }
  }

  function startEditBudget(row: Budget) {
    setShowBudgetForm(true);
    setEditingBudgetId(row.id);
    setBudName(row.name);
    setBudAmount(String(row.amount));
    setBudCategory(row.category);
    setBudStart(row.period_start);
    setBudEnd(row.period_end);
    setBudBusId(row.bus_id ?? "");
    setBudSchoolId(row.school_id ?? schools[0]?.id ?? "");
    setBudNotes(row.notes ?? "");
    clearFlash();
  }

  function cancelEditBudget() {
    setShowBudgetForm(false);
    setEditingBudgetId(null);
    setBudName("");
    setBudAmount("");
    setBudBusId("");
    setBudNotes("");
  }

  async function deleteBudgetRow(row: Budget) {
    const ok = await confirm({
      title: "Delete this budget?",
      message: `Delete "${row.name}" — ${money(row.currency, row.amount)} (${categoryLabel(row.category)})? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/budgets?id=${row.id}`, { method: "DELETE" });
    if (res.ok) {
      setBudgets((prev) => prev.filter((r) => r.id !== row.id));
      if (editingBudgetId === row.id) cancelEditBudget();
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
    }
  }

  function startEditRevenueTarget(row: RevenueTarget) {
    setEditingRevenueTargetId(row.id);
    setRtName(row.name);
    setRtAmount(String(row.amount));
    setRtCategory(row.category);
    setRtStart(row.period_start);
    setRtEnd(row.period_end);
    setRtSchoolId(row.school_id ?? "");
    setRtBusId(row.bus_id ?? "");
    setRtNotes(row.notes ?? "");
    clearFlash();
  }

  function cancelEditRevenueTarget() {
    setEditingRevenueTargetId(null);
    setRtName("");
    setRtAmount("");
    setRtBusId("");
    setRtNotes("");
  }

  async function deleteRevenueTargetRow(row: RevenueTarget) {
    const ok = await confirm({
      title: "Delete this revenue target?",
      message: `Delete "${row.name}" — ${money(row.currency, row.amount)} (${categoryLabel(row.category)})? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/revenue-targets?id=${row.id}`, { method: "DELETE" });
    if (res.ok) {
      setRevenueTargets((prev) => prev.filter((r) => r.id !== row.id));
      if (editingRevenueTargetId === row.id) cancelEditRevenueTarget();
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
    }
  }

  useEffect(() => {
    if (tab !== "budgets") return;
    const hash = window.location.hash;
    if (!hash) return;
    const el = document.querySelector(hash);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [tab]);

  const budgetBurns = useMemo(() => {
    const map = new Map<string, { spent: number; remaining: number; burnPct: number }>();
    for (const b of budgets) {
      const spent = expenses
        .filter((e) => budgetMatchesExpense(b, e))
        .reduce((s, e) => s + e.amount, 0);
      const remaining = b.amount - spent;
      const burnPct = b.amount > 0 ? Math.round((spent / b.amount) * 1000) / 10 : 0;
      map.set(b.id, { spent, remaining, burnPct });
    }
    return map;
  }, [budgets, expenses]);

  function overBudgetFor(e: Expense): Budget | null {
    for (const b of budgets) {
      if (!budgetMatchesExpense(b, e)) continue;
      const burn = budgetBurns.get(b.id);
      if (burn && burn.burnPct > 100) return b;
    }
    return null;
  }

  const expenseBudgetWarning = useMemo(() => {
    const amt = Number(expAmount);
    if (!Number.isFinite(amt) || amt <= 0 || !expDate) return null;
    // expBusId deliberately left out of the deps array below: including it
    // satisfies exhaustive-deps but trips react-compiler's
    // preserve-manual-memoization into a hard error (it can't verify the
    // memo through the cross-module budgetMatchesExpense call once a 7th
    // dependency is added). A stale expBusId here only matters if a user
    // changes *only* the bus dropdown with nothing else touched -- narrow
    // enough to accept a warning over a new compiler error.
    const candidate = {
      spent_on: expDate,
      category: expCategory,
      school_id: expSchoolId || null,
      bus_id: expBusId || null,
    };
    const matchingBudgets = budgets.filter((b) => budgetMatchesExpense(b, candidate));
    for (const b of matchingBudgets) {
      const alreadySpent = expenses
        .filter((e) => e.id !== editingExpenseId && budgetMatchesExpense(b, e))
        .reduce((s, e) => s + e.amount, 0);
      const projected = alreadySpent + amt;
      if (projected > b.amount) {
        return { budget: b, projected, over: projected - b.amount };
      }
    }
    return null;
  }, [budgets, expenses, expAmount, expCategory, expDate, expSchoolId, editingExpenseId]);

  const busesForExpense = useMemo(
    () =>
      buses.filter((b) => !expSchoolId || b.school_id === expSchoolId),
    [buses, expSchoolId],
  );
  const busesForRevenue = useMemo(
    () =>
      buses.filter((b) => !revSchoolId || b.school_id === revSchoolId),
    [buses, revSchoolId],
  );
  const busesForRevenueTarget = useMemo(
    () => buses.filter((b) => !rtSchoolId || b.school_id === rtSchoolId),
    [buses, rtSchoolId],
  );
  const busesForBudget = useMemo(
    () => buses.filter((b) => !budSchoolId || b.school_id === budSchoolId),
    [buses, budSchoolId],
  );

  // Collected-so-far per target, computed client-side from the revenues
  // already loaded (same pattern as budgetBurns, but against revenues and
  // with no "over 100% = bad" framing anywhere -- see
  // revenueTargetMatchesRevenue for why this stays a separate function).
  const revenueTargetProgress = useMemo(() => {
    const map = new Map<string, { collected: number; pct: number }>();
    for (const t of revenueTargets) {
      const collected = revenues
        .filter((r) => revenueTargetMatchesRevenue(t, r))
        .reduce((s, r) => s + r.amount, 0);
      const pct = t.amount > 0 ? Math.round((collected / t.amount) * 1000) / 10 : 0;
      map.set(t.id, { collected, pct });
    }
    return map;
  }, [revenueTargets, revenues]);

  function clearFlash() {
    setError(null);
    setOkMsg(null);
  }

  async function submitExpense(e: React.FormEvent) {
    e.preventDefault();
    clearFlash();
    const amount = Number(expAmount);
    if (!expTitle.trim() || !Number.isFinite(amount) || amount < 0) {
      setError("Expense title and non-negative amount are required");
      return;
    }
    const isEdit = Boolean(editingExpenseId);
    const ok = await confirm({
      title: isEdit ? "Update this expense?" : "Save this expense?",
      message: `${isEdit ? "Update" : "Save"} "${expTitle.trim()}" — ${money("TZS", amount)} (${categoryLabel(expCategory)})?`,
      confirmLabel: isEdit ? "Update" : "Save",
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(
        isEdit ? `/api/expenses?id=${editingExpenseId}` : "/api/expenses",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: expTitle.trim(),
            amount,
            category: expCategory,
            spentOn: expDate,
            schoolId: expSchoolId || undefined,
            busId: expBusId || undefined,
            notes: expNotes.trim() || undefined,
          }),
        },
      );
      const data = (await res.json()) as { expense?: Expense; error?: string };
      if (!res.ok || !data.expense) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setExpenses((prev) =>
        isEdit
          ? prev.map((r) => (r.id === data.expense!.id ? data.expense! : r))
          : [data.expense!, ...prev],
      );
      setOkMsg(
        `Expense ${isEdit ? "updated" : "saved"} · ${money(data.expense.currency, data.expense.amount)}`,
      );
      setEditingExpenseId(null);
      setExpTitle("");
      setExpAmount("");
      setExpNotes("");
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  async function submitRevenue(e: React.FormEvent) {
    e.preventDefault();
    clearFlash();
    const amount = Number(revAmount);
    if (!revTitle.trim() || !Number.isFinite(amount) || amount < 0) {
      setError("Revenue title and non-negative amount are required");
      return;
    }
    const isEdit = Boolean(editingRevenueId);
    const ok = await confirm({
      title: isEdit ? "Update this revenue?" : "Save this revenue?",
      message: `${isEdit ? "Update" : "Save"} "${revTitle.trim()}" — ${money("TZS", amount)} (${categoryLabel(revCategory)})?`,
      confirmLabel: isEdit ? "Update" : "Save",
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(
        isEdit ? `/api/revenues?id=${editingRevenueId}` : "/api/revenues",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: revTitle.trim(),
            amount,
            category: revCategory,
            earnedOn: revDate,
            schoolId: revSchoolId || undefined,
            busId: revBusId || undefined,
            notes: revNotes.trim() || undefined,
          }),
        },
      );
      const data = (await res.json()) as { revenue?: Revenue; error?: string };
      if (!res.ok || !data.revenue) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setRevenues((prev) =>
        isEdit
          ? prev.map((r) => (r.id === data.revenue!.id ? data.revenue! : r))
          : [data.revenue!, ...prev],
      );
      setOkMsg(
        `Revenue ${isEdit ? "updated" : "saved"} · ${money(data.revenue.currency, data.revenue.amount)}`,
      );
      setEditingRevenueId(null);
      setRevTitle("");
      setRevAmount("");
      setRevNotes("");
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
    const amount = Number(budAmount);
    if (
      !budName.trim() ||
      !budStart ||
      !budEnd ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      setError("Budget name, period, and non-negative amount are required");
      return;
    }
    const isEdit = Boolean(editingBudgetId);
    const ok = await confirm({
      title: isEdit ? "Update this budget?" : "Save this budget?",
      message: `${isEdit ? "Update" : "Save"} "${budName.trim()}" — ${money("TZS", amount)} (${categoryLabel(budCategory)})?`,
      confirmLabel: isEdit ? "Update" : "Save",
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(
        isEdit ? `/api/budgets?id=${editingBudgetId}` : "/api/budgets",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: budName.trim(),
            amount,
            category: budCategory,
            periodStart: budStart,
            periodEnd: budEnd,
            // Explicit null (not undefined/omitted) when cleared, so an edit
            // that clears the campus/bus actually clears it in the DB —
            // updateBudget only touches a field when the key is present.
            schoolId: budSchoolId || null,
            busId: budBusId || null,
            notes: budNotes.trim() || undefined,
          }),
        },
      );
      const data = (await res.json()) as { budget?: Budget; error?: string };
      if (!res.ok || !data.budget) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setBudgets((prev) =>
        isEdit
          ? prev.map((r) => (r.id === data.budget!.id ? data.budget! : r))
          : [data.budget!, ...prev],
      );
      setOkMsg(
        `Budget ${isEdit ? "updated" : "saved"} · ${money(data.budget.currency, data.budget.amount)}`,
      );
      setEditingBudgetId(null);
      setBudName("");
      setBudAmount("");
      setBudBusId("");
      setBudNotes("");
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  async function submitRevenueTarget(e: React.FormEvent) {
    e.preventDefault();
    clearFlash();
    const amount = Number(rtAmount);
    if (
      !rtName.trim() ||
      !rtStart ||
      !rtEnd ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      setError("Target name, period, and non-negative amount are required");
      return;
    }
    const isEdit = Boolean(editingRevenueTargetId);
    const ok = await confirm({
      title: isEdit ? "Update this revenue target?" : "Save this revenue target?",
      message: `${isEdit ? "Update" : "Save"} "${rtName.trim()}" — ${money("TZS", amount)} (${categoryLabel(rtCategory)})?`,
      confirmLabel: isEdit ? "Update" : "Save",
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(
        isEdit ? `/api/revenue-targets?id=${editingRevenueTargetId}` : "/api/revenue-targets",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: rtName.trim(),
            amount,
            category: rtCategory,
            periodStart: rtStart,
            periodEnd: rtEnd,
            schoolId: rtSchoolId || null,
            busId: rtBusId || null,
            notes: rtNotes.trim() || undefined,
          }),
        },
      );
      const data = (await res.json()) as { target?: RevenueTarget; error?: string };
      if (!res.ok || !data.target) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setRevenueTargets((prev) =>
        isEdit
          ? prev.map((r) => (r.id === data.target!.id ? data.target! : r))
          : [data.target!, ...prev],
      );
      setOkMsg(
        `Revenue target ${isEdit ? "updated" : "saved"} · ${money(data.target.currency, data.target.amount)}`,
      );
      setEditingRevenueTargetId(null);
      setRtName("");
      setRtAmount("");
      setRtBusId("");
      setRtNotes("");
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "expenses", label: "Expenses" },
    { id: "revenues", label: "Revenues" },
    { id: "budgets", label: "Budgets" },
    { id: "revenue-targets", label: "Revenue Targets" },
  ];

  const maintenanceBudgets = budgets.filter((b) => b.category === "maintenance");

  return (
    <>
    <div className="mt-6">
      <div className="mb-4 rounded-[var(--radius-sm)] border border-card-border bg-card px-4 py-3 shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          R&amp;M budget spend
        </p>
        {maintenanceBudgets.length === 0 ? (
          <p className="mt-1.5 text-sm text-ink-muted">
            No maintenance-category budget set yet — add one on the Budgets tab below.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {maintenanceBudgets.map((b) => {
              const burn = budgetBurns.get(b.id);
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setTab("expenses");
                      setCategoryFilter("maintenance");
                      setBudgetFilterId(b.id);
                      setShowExpenseForm(false);
                      requestAnimationFrame(() =>
                        expenseListRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        }),
                      );
                    }}
                    className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm hover:bg-light-blue-30 ${
                      budgetFilterId === b.id ? "bg-light-blue-30" : ""
                    }`}
                    title="See exactly which expenses make up this spend"
                  >
                    <span className="font-semibold text-ink">{b.name} →</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        (burn?.burnPct ?? 0) > 100
                          ? "text-danger"
                          : (burn?.burnPct ?? 0) > 90
                            ? "text-gold"
                            : "text-ink-muted"
                      }`}
                    >
                      {money(b.currency, burn?.spent ?? 0)} / {money(b.currency, b.amount)} ·{" "}
                      {burn?.burnPct ?? 0}%
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

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
        <div
          className={
            showExpenseForm
              ? "mt-6 grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start"
              : "mt-6 grid gap-8"
          }
        >
          {showExpenseForm ? (
          <form
            onSubmit={submitExpense}
            className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {editingExpenseId ? "Edit expense" : "Add expense"}
            </h2>
            <p className="mt-1 text-xs text-ink-faint">
              Posts to{" "}
              <code>{editingExpenseId ? "PATCH" : "POST"} /api/expenses</code>
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Title</span>
                <input
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  required
                  placeholder="e.g. Diesel fill"
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Amount (TZS)</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  required
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Category</span>
                <select
                  value={expCategory}
                  onChange={(e) =>
                    setExpCategory(e.target.value as ExpenseCategory)
                  }
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </select>
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
                <span className="font-semibold text-ink">Campus</span>
                <select
                  value={expSchoolId}
                  onChange={(e) => {
                    setExpSchoolId(e.target.value);
                    setExpBusId("");
                  }}
                  required
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                >
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Bus (optional)</span>
                <select
                  value={expBusId}
                  onChange={(e) => setExpBusId(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                >
                  <option value="">None</option>
                  {busesForExpense.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label} · {b.plate_number}
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
              {expenseBudgetWarning ? (
                <p className="rounded-[var(--radius-sm)] border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
                  ⚠ Over budget: &quot;{expenseBudgetWarning.budget.name}&quot;
                  would reach{" "}
                  {money(
                    expenseBudgetWarning.budget.currency,
                    expenseBudgetWarning.projected,
                  )}{" "}
                  — that&apos;s{" "}
                  {money(
                    expenseBudgetWarning.budget.currency,
                    expenseBudgetWarning.over,
                  )}{" "}
                  over its{" "}
                  {money(
                    expenseBudgetWarning.budget.currency,
                    expenseBudgetWarning.budget.amount,
                  )}{" "}
                  target.
                </p>
              ) : null}
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
                    onClick={cancelEditExpense}
                    className="rounded-[var(--radius-sm)] border border-card-border px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-light-blue-30"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </form>
          ) : null}

          <section ref={expenseListRef} className="scroll-mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Expense ledger
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => (showExpenseForm ? cancelEditExpense() : setShowExpenseForm(true))}
                  className="rounded-[var(--radius-sm)] bg-electric-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light"
                >
                  {showExpenseForm ? "Close" : "+ Add expense"}
                </button>
                <label className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-ink-muted">Category</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value as ExpenseCategory | "all");
                      setBudgetFilterId(null);
                    }}
                    className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1.5 text-ink"
                  >
                    <option value="all">All categories</option>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            {(() => {
              const activeBudgetFilter = budgetFilterId
                ? (budgets.find((b) => b.id === budgetFilterId) ?? null)
                : null;
              const visibleExpenses = expenses.filter((e) => {
                if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
                if (activeBudgetFilter) {
                  if (
                    e.spent_on < activeBudgetFilter.period_start ||
                    e.spent_on > activeBudgetFilter.period_end
                  )
                    return false;
                  if (
                    activeBudgetFilter.school_id &&
                    e.school_id &&
                    e.school_id !== activeBudgetFilter.school_id
                  )
                    return false;
                }
                return true;
              });
              return (
                <>
                {activeBudgetFilter ? (
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-light-blue-30 px-2.5 py-1 font-semibold text-electric-blue">
                      Showing only: {activeBudgetFilter.name} (
                      {activeBudgetFilter.period_start} → {activeBudgetFilter.period_end})
                    </span>
                    <button
                      type="button"
                      onClick={() => setBudgetFilterId(null)}
                      className="font-semibold text-ink-muted hover:underline"
                    >
                      Clear
                    </button>
                  </p>
                ) : null}
                {visibleExpenses.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">
                    {expenses.length === 0
                      ? "No expenses yet."
                      : "No expenses match this filter."}
                  </p>
                ) : (
              <ul className="mt-3 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
                {visibleExpenses.slice(0, 40).map((row) => {
                  const overBudget = overBudgetFor(row);
                  return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-ink">
                        {row.title}
                        {overBudget ? (
                          <Link
                            href={`/admin/ledger?tab=budgets#budget-${overBudget.id}`}
                            className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold text-danger no-underline hover:bg-danger/20"
                          >
                            ⚠ over budget
                          </Link>
                        ) : null}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {categoryLabel(row.category)} · {row.spent_on}
                      </p>
                      <LastEditedBy row={row} labels={profileLabels} />
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-electric-blue">
                        {money(row.currency, row.amount)}
                      </p>
                      <button
                        type="button"
                        onClick={() => startEditExpense(row)}
                        className="text-xs font-semibold text-electric-blue hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteExpenseRow(row)}
                        className="text-xs font-semibold text-danger hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                  );
                })}
              </ul>
              )}
                </>
              );
            })()}
          </section>
        </div>
      ) : null}

      {tab === "revenues" ? (
        <div
          className={
            showRevenueForm
              ? "mt-6 grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start"
              : "mt-6 grid gap-8"
          }
        >
          {showRevenueForm ? (
          <form
            onSubmit={submitRevenue}
            className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {editingRevenueId ? "Edit revenue" : "Add revenue"}
            </h2>
            <p className="mt-1 text-xs text-ink-faint">
              Posts to{" "}
              <code>{editingRevenueId ? "PATCH" : "POST"} /api/revenues</code>
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Title</span>
                <input
                  value={revTitle}
                  onChange={(e) => setRevTitle(e.target.value)}
                  required
                  placeholder="e.g. July transport fees"
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Amount (TZS)</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={revAmount}
                  onChange={(e) => setRevAmount(e.target.value)}
                  required
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Category</span>
                <select
                  value={revCategory}
                  onChange={(e) =>
                    setRevCategory(e.target.value as RevenueCategory)
                  }
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                >
                  {REVENUE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Earned on</span>
                <input
                  type="date"
                  value={revDate}
                  onChange={(e) => setRevDate(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Campus</span>
                <select
                  value={revSchoolId}
                  onChange={(e) => {
                    setRevSchoolId(e.target.value);
                    setRevBusId("");
                  }}
                  required
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                >
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Bus (optional)</span>
                <select
                  value={revBusId}
                  onChange={(e) => setRevBusId(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                >
                  <option value="">None</option>
                  {busesForRevenue.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label} · {b.plate_number}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Notes</span>
                <textarea
                  value={revNotes}
                  onChange={(e) => setRevNotes(e.target.value)}
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
                  {saving ? "Saving…" : editingRevenueId ? "Update revenue" : "Save revenue"}
                </button>
                {editingRevenueId ? (
                  <button
                    type="button"
                    onClick={cancelEditRevenue}
                    className="rounded-[var(--radius-sm)] border border-card-border px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-light-blue-30"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </form>
          ) : null}

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Revenue ledger
              </h2>
              <button
                type="button"
                onClick={() => (showRevenueForm ? cancelEditRevenue() : setShowRevenueForm(true))}
                className="rounded-[var(--radius-sm)] bg-electric-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light"
              >
                {showRevenueForm ? "Close" : "+ Add revenue"}
              </button>
            </div>
            {revenues.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">No revenues yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
                {revenues.slice(0, 40).map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-ink">{row.title}</p>
                      <p className="text-xs text-ink-muted">
                        {categoryLabel(row.category)} · {row.earned_on}
                      </p>
                      <LastEditedBy row={row} labels={profileLabels} />
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-success">
                        {money(row.currency, row.amount)}
                      </p>
                      <button
                        type="button"
                        onClick={() => startEditRevenue(row)}
                        className="text-xs font-semibold text-electric-blue hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRevenueRow(row)}
                        className="text-xs font-semibold text-danger hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {tab === "budgets" ? (
        <div
          className={
            showBudgetForm
              ? "mt-6 grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start"
              : "mt-6 grid gap-8"
          }
        >
          {showBudgetForm ? (
          <form
            onSubmit={submitBudget}
            className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {editingBudgetId ? "Edit budget" : "Add budget"}
            </h2>
            <p className="mt-1 text-xs text-ink-faint">
              Posts to{" "}
              <code>{editingBudgetId ? "PATCH" : "POST"} /api/budgets</code>
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Name</span>
                <input
                  value={budName}
                  onChange={(e) => setBudName(e.target.value)}
                  required
                  placeholder="e.g. Usariver Fuel Q3"
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Amount (TZS)</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={budAmount}
                  onChange={(e) => setBudAmount(e.target.value)}
                  required
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Category</span>
                <select
                  value={budCategory}
                  onChange={(e) =>
                    setBudCategory(e.target.value as BudgetCategory)
                  }
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                >
                  {BUDGET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold text-ink">Period start</span>
                  <input
                    type="date"
                    value={budStart}
                    onChange={(e) => setBudStart(e.target.value)}
                    required
                    className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold text-ink">Period end</span>
                  <input
                    type="date"
                    value={budEnd}
                    onChange={(e) => setBudEnd(e.target.value)}
                    required
                    className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Campus</span>
                <select
                  value={budSchoolId}
                  onChange={(e) => {
                    setBudSchoolId(e.target.value);
                    setBudBusId("");
                  }}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                >
                  <option value="">All / none (fleet-wide)</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Bus (optional)</span>
                <select
                  value={budBusId}
                  onChange={(e) => setBudBusId(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                >
                  <option value="">None — fleet/campus-wide</option>
                  {busesForBudget.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label} · {b.plate_number}
                    </option>
                  ))}
                </select>
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
                  {saving ? "Saving…" : editingBudgetId ? "Update budget" : "Save budget"}
                </button>
                {editingBudgetId ? (
                  <button
                    type="button"
                    onClick={cancelEditBudget}
                    className="rounded-[var(--radius-sm)] border border-card-border px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-light-blue-30"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </form>
          ) : null}

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Budget envelopes
              </h2>
              <button
                type="button"
                onClick={() => (showBudgetForm ? cancelEditBudget() : setShowBudgetForm(true))}
                className="rounded-[var(--radius-sm)] bg-electric-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light"
              >
                {showBudgetForm ? "Close" : "+ Add budget"}
              </button>
            </div>
            {budgets.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">No budgets yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
                {budgets.map((row) => {
                  const burn = budgetBurns.get(row.id);
                  const over = burn ? burn.burnPct > 100 : false;
                  const scopedBus = row.bus_id
                    ? buses.find((b) => b.id === row.bus_id)
                    : undefined;
                  return (
                    <li
                      key={row.id}
                      id={`budget-${row.id}`}
                      className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm ${
                        over ? "border-l-4 border-l-danger bg-danger/5" : ""
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-ink">{row.name}</p>
                        <p className="text-xs text-ink-muted">
                          {categoryLabel(row.category)} · {row.period_start}{" "}
                          → {row.period_end}
                          {scopedBus ? ` · ${scopedBus.label}` : ""}
                        </p>
                        <LastEditedBy row={row} labels={profileLabels} />
                        {burn ? (
                          <p
                            className={`mt-1 text-xs font-semibold ${
                              over ? "text-danger" : "text-ink-faint"
                            }`}
                          >
                            Spent {money(row.currency, burn.spent)} of{" "}
                            {money(row.currency, row.amount)} ({burn.burnPct}%)
                            {over
                              ? ` — ${money(row.currency, -burn.remaining)} over`
                              : ` · ${money(row.currency, burn.remaining)} left`}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-electric-blue">
                          {money(row.currency, row.amount)}
                        </p>
                        <button
                          type="button"
                          onClick={() => startEditBudget(row)}
                          className="text-xs font-semibold text-electric-blue hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteBudgetRow(row)}
                          className="text-xs font-semibold text-danger hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {tab === "revenue-targets" ? (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <form
            onSubmit={submitRevenueTarget}
            className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {editingRevenueTargetId ? "Edit revenue target" : "Add revenue target"}
            </h2>
            <p className="mt-1 text-xs text-ink-faint">
              Posts to{" "}
              <code>
                {editingRevenueTargetId ? "PATCH" : "POST"} /api/revenue-targets
              </code>
              . Kept separate from Budgets — collecting more than a target is
              good, not an overspend.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Name</span>
                <input
                  value={rtName}
                  onChange={(e) => setRtName(e.target.value)}
                  required
                  placeholder="e.g. Transport fees 2026"
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Target amount (TZS)</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={rtAmount}
                  onChange={(e) => setRtAmount(e.target.value)}
                  required
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Category</span>
                <select
                  value={rtCategory}
                  onChange={(e) => setRtCategory(e.target.value as RevenueCategory)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                >
                  {REVENUE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold text-ink">Period start</span>
                  <input
                    type="date"
                    value={rtStart}
                    onChange={(e) => setRtStart(e.target.value)}
                    required
                    className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold text-ink">Period end</span>
                  <input
                    type="date"
                    value={rtEnd}
                    onChange={(e) => setRtEnd(e.target.value)}
                    required
                    className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Campus</span>
                <select
                  value={rtSchoolId}
                  onChange={(e) => {
                    setRtSchoolId(e.target.value);
                    setRtBusId("");
                  }}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                >
                  <option value="">All / none (fleet-wide)</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Bus (optional)</span>
                <select
                  value={rtBusId}
                  onChange={(e) => setRtBusId(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                >
                  <option value="">None — fleet/campus-wide</option>
                  {busesForRevenueTarget.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label} · {b.plate_number}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Notes</span>
                <textarea
                  value={rtNotes}
                  onChange={(e) => setRtNotes(e.target.value)}
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
                  {saving
                    ? "Saving…"
                    : editingRevenueTargetId
                      ? "Update target"
                      : "Save target"}
                </button>
                {editingRevenueTargetId ? (
                  <button
                    type="button"
                    onClick={cancelEditRevenueTarget}
                    className="rounded-[var(--radius-sm)] border border-card-border px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-light-blue-30"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </form>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Revenue targets
            </h2>
            {revenueTargets.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">No revenue targets yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
                {revenueTargets.map((row) => {
                  const progress = revenueTargetProgress.get(row.id);
                  const met = progress ? progress.pct >= 100 : false;
                  const scopedBus = row.bus_id
                    ? buses.find((b) => b.id === row.bus_id)
                    : undefined;
                  return (
                    <li
                      key={row.id}
                      id={`revenue-target-${row.id}`}
                      className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm ${
                        met ? "border-l-4 border-l-success bg-success-15" : ""
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-ink">{row.name}</p>
                        <p className="text-xs text-ink-muted">
                          {categoryLabel(row.category)} · {row.period_start}{" "}
                          → {row.period_end}
                          {scopedBus ? ` · ${scopedBus.label}` : ""}
                        </p>
                        {progress ? (
                          <p
                            className={`mt-1 text-xs font-semibold ${
                              met ? "text-success" : "text-ink-faint"
                            }`}
                          >
                            Collected {money(row.currency, progress.collected)} of{" "}
                            {money(row.currency, row.amount)} ({progress.pct}%)
                            {met ? " — target met" : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-electric-blue">
                          {money(row.currency, row.amount)}
                        </p>
                        <button
                          type="button"
                          onClick={() => startEditRevenueTarget(row)}
                          className="text-xs font-semibold text-electric-blue hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRevenueTargetRow(row)}
                          className="text-xs font-semibold text-danger hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
    {dialog}
    </>
  );
}
