import { escapeHtml } from "@/lib/email/escape-html";
import { renderEmailLayout, emailButton, priorityBadge, calloutBox } from "@/lib/email/layout";

export function taskAssignedEmail(params: {
  taskTitle: string;
  systemName: string;
  priority: string;
  dueDate: string | null;
  systemUrl: string;
}) {
  const body = `
    <p>You've been assigned a task on <strong>${escapeHtml(params.systemName)}</strong>:</p>
    ${calloutBox(
      "#002368",
      `<div style="font-weight:600;margin-bottom:6px;">${escapeHtml(params.taskTitle)}</div>
       <div>${priorityBadge(params.priority)}${params.dueDate ? ` <span style="color:#666666;font-size:12px;">&middot; Due ${params.dueDate}</span>` : ""}</div>`,
    )}
    ${emailButton(params.systemUrl, "View the task board")}
  `;
  return {
    subject: `You've been assigned a task: ${params.taskTitle}`,
    html: renderEmailLayout(body),
  };
}
