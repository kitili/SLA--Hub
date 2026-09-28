// Shared branded shell + small building blocks for every outbound email. Inline styles
// only — Gmail/Workspace (the only client this app targets) strips <style> blocks in many
// contexts, so the safest path is styling every element directly.

export function renderEmailLayout(bodyHtml: string) {
  return `
<div style="background:#ececec;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#002368;padding:20px 32px;">
      <span style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:0.2px;">Silverleaf Data &amp; Tech</span>
    </div>
    <div style="padding:32px;color:#111111;font-size:14px;line-height:1.6;">
      ${bodyHtml}
    </div>
    <div style="background:#ececec;padding:14px 32px;color:#666666;font-size:12px;">
      This is an automated message from the Silverleaf Data &amp; Tech platform.
    </div>
  </div>
</div>`;
}

export function emailButton(url: string, label: string) {
  return `<a href="${url}" style="display:inline-block;background:#002368;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:6px;font-size:14px;font-weight:600;margin-top:8px;">${label}</a>`;
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: "#ececec", text: "#111111" },
  medium: { bg: "#dbeafe", text: "#002368" },
  high: { bg: "#fee2e2", text: "#991b1b" },
  urgent: { bg: "#991b1b", text: "#ffffff" },
};

export function priorityBadge(priority: string) {
  const c = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.low;
  return `<span style="display:inline-block;background:${c.bg};color:${c.text};border-radius:999px;padding:2px 10px;font-size:11px;font-weight:600;text-transform:capitalize;">${priority}</span>`;
}

export function calloutBox(borderColor: string, innerHtml: string) {
  return `<div style="background:#f7f7f7;border-left:3px solid ${borderColor};border-radius:6px;padding:12px 16px;margin:16px 0;">${innerHtml}</div>`;
}
