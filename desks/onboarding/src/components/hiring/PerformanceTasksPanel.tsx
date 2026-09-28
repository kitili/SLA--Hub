"use client";

import { useRef, useState } from "react";

import adminStyles from "@/components/admin/admin.module.css";

export type PerformanceTask = {
  id: string;
  title: string;
  description: string | null;
  fileLink: string | null;
  managerEmail: string | null;
  isActive: boolean;
};

type FormState = {
  title: string;
  description: string;
  fileLink: string;
  managerEmail: string;
  isActive: boolean;
};

function emptyForm(task?: PerformanceTask): FormState {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    fileLink: task?.fileLink ?? "",
    managerEmail: task?.managerEmail ?? "",
    isActive: task?.isActive ?? true,
  };
}

export function PerformanceTasksPanel({
  initialTasks,
}: {
  initialTasks: PerformanceTask[];
}) {
  const [tasks, setTasks] = useState<PerformanceTask[]>(initialTasks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openEdit(task: PerformanceTask) {
    setEditingId(task.id);
    setForm(emptyForm(task));
    setUploadedFileName(task.fileLink ? "current file" : null);
    setShowAddForm(false);
    setError(null);
    setSuccess(null);
  }

  function openAdd() {
    setShowAddForm(true);
    setEditingId(null);
    setForm(emptyForm());
    setUploadedFileName(null);
    setError(null);
    setSuccess(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setShowAddForm(false);
    setUploadedFileName(null);
    setError(null);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/hiring/performance-tasks/upload", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      updateField("fileLink", data.url);
      setUploadedFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function updateField(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/hiring/performance-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          fileLink: form.fileLink.trim() || null,
          managerEmail: form.managerEmail.trim() || null,
          isActive: form.isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create task");
      setTasks((prev) => [data as PerformanceTask, ...prev]);
      setShowAddForm(false);
      setSuccess("Task created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating task");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/hiring/performance-tasks/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          fileLink: form.fileLink.trim() || null,
          managerEmail: form.managerEmail.trim() || null,
          isActive: form.isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update task");
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingId ? (data as PerformanceTask) : t,
        ),
      );
      setEditingId(null);
      setSuccess("Task updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating task");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (
      !window.confirm(
        "Delete this performance task? This cannot be undone.",
      )
    )
      return;
    setError(null);
    try {
      const res = await fetch(`/api/hiring/performance-tasks/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete task");
      }
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setSuccess("Task deleted.");
      if (editingId === id) setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting task");
    }
  }

  const taskForm = (onSubmit: (e: React.FormEvent) => Promise<void>) => (
    <form onSubmit={onSubmit} className={adminStyles.form}>
      <div className={adminStyles.field}>
        <label className={adminStyles.label} htmlFor="pt-title">
          Title <span style={{ color: "#b91c1c" }}>*</span>
        </label>
        <input
          id="pt-title"
          type="text"
          required
          value={form.title}
          onChange={(e) => updateField("title", e.target.value)}
          className={adminStyles.input}
          placeholder="e.g. Teaching Demo Task"
        />
      </div>
      <div className={adminStyles.field}>
        <label className={adminStyles.label} htmlFor="pt-description">
          Description / Questions
        </label>
        <textarea
          id="pt-description"
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
          className={adminStyles.textarea}
          placeholder="Questions or instructions shown to the candidate in the email"
          rows={5}
        />
      </div>
      <div className={adminStyles.field}>
        <label className={adminStyles.label}>
          Task file (PDF, Word, etc.)
        </label>
        {form.fileLink && uploadedFileName ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <a
              href={form.fileLink}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: "0.85rem", color: "var(--electric-blue, #1e40af)" }}
            >
              {uploadedFileName === "current file" ? "View current file" : uploadedFileName}
            </a>
            <button
              type="button"
              onClick={() => { updateField("fileLink", ""); setUploadedFileName(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              style={{ fontSize: "0.75rem", color: "#b91c1c", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Remove
            </button>
          </div>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
          onChange={handleFileChange}
          disabled={uploading}
          className={adminStyles.input}
          style={{ padding: "0.4rem" }}
        />
        {uploading ? (
          <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", marginTop: "0.25rem" }}>Uploading…</p>
        ) : null}
      </div>
      <div className={adminStyles.field}>
        <label className={adminStyles.label} htmlFor="pt-manager-email">
          Manager email (receives submission notification)
        </label>
        <input
          id="pt-manager-email"
          type="email"
          value={form.managerEmail}
          onChange={(e) => updateField("managerEmail", e.target.value)}
          className={adminStyles.input}
          placeholder="manager@silverleaf.co.tz"
        />
      </div>
      <div className={adminStyles.field}>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => updateField("isActive", e.target.checked)}
          />
          Active (visible in task selection)
        </label>
      </div>
      {error ? <p className={adminStyles.formError}>{error}</p> : null}
      <div className={adminStyles.formActions}>
        <button
          type="submit"
          disabled={saving}
          className={adminStyles.btn}
        >
          {saving ? "Saving…" : "Save task"}
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          className={`${adminStyles.btn} ${adminStyles.btnSecondary}`}
        >
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div>
      {success ? (
        <p className={adminStyles.formSuccess} style={{ marginBottom: "1rem" }}>
          {success}
        </p>
      ) : null}

      {!showAddForm && editingId === null ? (
        <div style={{ marginBottom: "1rem" }}>
          <button
            type="button"
            onClick={openAdd}
            className={adminStyles.btn}
          >
            + Add new task
          </button>
        </div>
      ) : null}

      {showAddForm ? (
        <div className={adminStyles.card}>
          <div className={adminStyles.cardHeader}>
            <h2>New performance task</h2>
          </div>
          {taskForm(handleCreate)}
        </div>
      ) : null}

      {tasks.length === 0 && !showAddForm ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.9rem" }}>
          No performance tasks yet. Add one above.
        </p>
      ) : null}

      {tasks.map((task) => (
        <div key={task.id} className={adminStyles.card}>
          {editingId === task.id ? (
            <>
              <div className={adminStyles.cardHeader}>
                <h2>Edit: {task.title}</h2>
              </div>
              {taskForm(handleUpdate)}
            </>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  <strong style={{ color: "var(--electric-blue)" }}>
                    {task.title}
                  </strong>
                  {!task.isActive ? (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        color: "var(--ink-muted)",
                        background: "var(--gray)",
                        padding: "0.1rem 0.4rem",
                        borderRadius: "999px",
                      }}
                    >
                      Inactive
                    </span>
                  ) : null}
                </div>
                {task.description ? (
                  <p
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--ink-muted)",
                      margin: "0 0 0.25rem",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {task.description.slice(0, 200)}
                    {task.description.length > 200 ? "…" : ""}
                  </p>
                ) : null}
                {task.fileLink ? (
                  <p style={{ fontSize: "0.78rem", margin: "0 0 0.15rem" }}>
                    <span style={{ color: "var(--ink-muted)" }}>File: </span>
                    <a
                      href={task.fileLink}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--electric-blue)" }}
                    >
                      {task.fileLink.split("/").pop()?.replace(/^\d+_/, "") || "Download"}
                    </a>
                  </p>
                ) : null}
                {task.managerEmail ? (
                  <p
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--ink-muted)",
                      margin: 0,
                    }}
                  >
                    Manager: {task.managerEmail}
                  </p>
                ) : null}
              </div>
              <div className={adminStyles.tableActions}>
                <button
                  type="button"
                  onClick={() => openEdit(task)}
                  className={`${adminStyles.btn} ${adminStyles.btnSecondary} ${adminStyles.btnSmall}`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(task.id)}
                  className={`${adminStyles.btn} ${adminStyles.btnDanger} ${adminStyles.btnSmall}`}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
