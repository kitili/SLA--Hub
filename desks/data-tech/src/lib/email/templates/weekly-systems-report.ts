import { escapeHtml } from "@/lib/email/escape-html";
import { renderEmailLayout, emailButton, priorityBadge } from "@/lib/email/layout";

type ReportTask = { title: string; priority: string };

function statPill(label: string, count: number, color: string) {
  return `
    <div style="display:inline-block;text-align:center;padding:12px 18px;background:#f7f7f7;border-radius:8px;margin:0 8px 8px 0;">
      <div style="font-size:22px;font-weight:700;color:${color};">${count}</div>
      <div style="font-size:11px;color:#666666;text-transform:uppercase;letter-spacing:0.3px;">${label}</div>
    </div>`;
}

function renderSection(label: string, color: string, tasks: ReportTask[]) {
  if (tasks.length === 0) {
    return `
      <div style="margin-bottom:20px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${color};border-left:3px solid ${color};padding-left:8px;margin-bottom:6px;">${label} (0)</div>
        <div style="color:#999999;font-size:13px;padding-left:11px;">None</div>
      </div>`;
  }

  const rows = tasks
    .map(
      (t) => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #f0f0f0;">
        <span style="color:#111111;">${escapeHtml(t.title)}</span>
        ${priorityBadge(t.priority)}
      </div>`,
    )
    .join("");

  return `
    <div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${color};border-left:3px solid ${color};padding-left:8px;margin-bottom:6px;">${label} (${tasks.length})</div>
      <div style="padding-left:11px;">${rows}</div>
    </div>`;
}

export function weeklySystemsReportEmail(params: {
  systemName: string;
  systemUrl: string;
  created: ReportTask[];
  completed: ReportTask[];
  overdue: ReportTask[];
  updated: ReportTask[];
}) {
  const body = `
    <h1 style="margin:0 0 2px;font-size:20px;color:#002368;">${escapeHtml(params.systemName)}</h1>
    <p style="margin:0 0 20px;color:#666666;font-size:13px;">Weekly project update</p>
    <div>
      ${statPill("New", params.created.length, "#002368")}
      ${statPill("Completed", params.completed.length, "#166534")}
      ${statPill("Overdue", params.overdue.length, "#991b1b")}
      ${statPill("Updated", params.updated.length, "#666666")}
    </div>
    ${renderSection("New tasks", "#002368", params.created)}
    ${renderSection("Completed", "#166534", params.completed)}
    ${renderSection("Overdue", "#991b1b", params.overdue)}
    ${renderSection("Other updates", "#666666", params.updated)}
    ${emailButton(params.systemUrl, "View the task board")}
  `;

  return {
    subject: `Weekly project update: ${params.systemName}`,
    html: renderEmailLayout(body),
  };
}
