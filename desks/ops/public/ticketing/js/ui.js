/**
 * DOM helpers — toasts, status labels, ticket lists.
 */

const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

export function showToast(message, type = "") {
  const el = document.createElement("div");
  el.className = "toast" + (type ? " " + type : "");
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/** Soft success / info banner at top of a panel (not a toast). */
export function showBanner(container, message, type = "success") {
  if (!container) return;
  let el = container.querySelector(".inline-banner");
  if (!el) {
    el = document.createElement("div");
    el.className = "inline-banner";
    el.setAttribute("role", "status");
    container.prepend(el);
  }
  el.className = "inline-banner banner-" + type;
  el.textContent = message;
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.remove(), 6000);
}

export function statusLabel(status) {
  const labels = {
    open: "Open",
    in_progress: "In progress",
    pending_info: "Pending info",
    resolved: "Resolved",
    closed: "Closed",
    declined: "Declined",
  };
  return labels[status] || status;
}

export function statusClass(status) {
  return "status status-" + status;
}

export function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

function formatTicketAge(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return mins <= 1 ? "1m" : mins + "m";
  const hours = Math.floor(mins / 60);
  if (hours < 48) return hours + "h";
  return Math.floor(hours / 24) + "d";
}

function isSlaBreached(request, urgentHours = 4) {
  const pri = request.priority || request.urgency || "normal";
  if (pri !== "urgent" && pri !== "high") return false;
  if (["closed", "declined", "resolved"].includes(request.status)) return false;
  const ms = Date.now() - new Date(request.created_at).getTime();
  return ms > urgentHours * 3600 * 1000;
}

/** Prefer DB display_id (TKT-1042); else derive a short stable code from UUID. */
export function shortTicketId(r) {
  if (r?.display_id) return String(r.display_id);
  const id = String(r?.id || "");
  const hex = id.replace(/-/g, "").slice(-4).toUpperCase();
  return hex ? "TKT-" + hex : "TKT-????";
}

export function sortRequests(requests) {
  const order = { open: 0, in_progress: 1, pending_info: 2, resolved: 3, closed: 4, declined: 5 };
  return [...requests].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority] ?? PRIORITY_RANK[a.urgency] ?? 2;
    const pb = PRIORITY_RANK[b.priority] ?? PRIORITY_RANK[b.urgency] ?? 2;
    if (pa !== pb) return pa - pb;
    const sa = order[a.status] ?? 9;
    const sb = order[b.status] ?? 9;
    if (sa !== sb) return sa - sb;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

export function filterRequestsByQuery(requests, query) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return requests;
  return requests.filter((r) => {
    const hay = [
      r.display_id,
      r.id,
      shortTicketId(r),
      r.title,
      r.requester_name,
      r.department,
      r.campus,
      r.category,
      r.assigned_to,
      r.status,
    ]
      .map((x) => String(x || "").toLowerCase())
      .join(" ");
    return hay.includes(q);
  });
}

export function countByStatus(requests) {
  const open = requests.filter((r) => !["closed", "declined"].includes(r.status)).length;
  const fresh = requests.filter((r) => r.status === "open").length;
  const inProgress = requests.filter((r) => r.status === "in_progress").length;
  const urgent = requests.filter(
    (r) =>
      (r.priority === "urgent" || r.urgency === "urgent") &&
      !["closed", "declined", "resolved"].includes(r.status)
  ).length;
  return { total: requests.length, open, fresh, inProgress, urgent };
}

export function renderStatsStrip(container, counts) {
  if (!container) return;
  container.innerHTML = `
    <div class="stat-pill">
      <span class="stat-value">${counts.fresh}</span>
      <span class="stat-label">New open</span>
    </div>
    <div class="stat-pill">
      <span class="stat-value">${counts.inProgress}</span>
      <span class="stat-label">In progress</span>
    </div>
    <div class="stat-pill stat-urgent">
      <span class="stat-value">${counts.urgent}</span>
      <span class="stat-label">Urgent</span>
    </div>
    <div class="stat-pill">
      <span class="stat-value">${counts.open}</span>
      <span class="stat-label">Active</span>
    </div>`;
}

export function renderRequestTable(container, requests, onRowClick, options = {}) {
  const emptyTitle = options.emptyTitle || "No tickets yet";
  const emptyHint =
    options.emptyHint || "Tickets you open with this name will show up here — only yours.";

  if (!requests.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>${escapeHtml(emptyTitle)}</strong>
        <p>${escapeHtml(emptyHint)}</p>
      </div>`;
    return;
  }

  const rows = requests
    .map((r, i) => {
      const pri = r.priority || r.urgency || "normal";
      const urgent =
        pri === "urgent" ? ' <span class="urgent-tag">URGENT</span>' : "";
      const sync = r._pending
        ? ' <span class="sync-tag">pending sync</span>'
        : r._offline
          ? ' <span class="sync-tag offline-tag">offline</span>'
          : "";
      const when = escapeHtml(r.created_at_display || r.created_at?.slice(0, 16) || "");
      const age = formatTicketAge(r.created_at);
      const sla = isSlaBreached(r);
      const ageHtml = age
        ? `<span class="ticket-age ${sla ? "age-breach" : pri === "urgent" ? "age-urgent" : ""}" title="Open for ${escapeHtml(age)}">${escapeHtml(age)}${sla ? " · SLA" : ""}</span>`
        : "";
      const metaBits = [r.department, r.campus, r.assigned_to ? "→ " + r.assigned_to : ""]
        .filter(Boolean)
        .map((x) => escapeHtml(x));
      const delay = Math.min(i, 8) * 0.04;
      return `
    <article class="ticket-row priority-${escapeHtml(pri)}${sla ? " sla-breach" : ""}" data-id="${escapeHtml(r.id)}" role="button" tabindex="0" style="animation-delay:${delay}s">
      <div class="ticket-id">${escapeHtml(shortTicketId(r))}${sync}</div>
      <div class="ticket-title">${escapeHtml(r.title)}${urgent}</div>
      <div class="ticket-side">
        <span class="${statusClass(r.status)}">${statusLabel(r.status)}</span>
        ${ageHtml}
        <span class="ticket-when">${when}</span>
      </div>
      <div class="ticket-meta">
        ${metaBits.map((b) => `<span>${b}</span>`).join("")}
        ${r.requester_name && options.showRequester ? `<span>${escapeHtml(r.requester_name)}</span>` : ""}
      </div>
    </article>`;
    })
    .join("");

  container.innerHTML = `<div class="ticket-list">${rows}</div>`;

  container.querySelectorAll(".ticket-row").forEach((row) => {
    const open = () => onRowClick(row.getAttribute("data-id"));
    row.addEventListener("click", open);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
}

export function renderMessages(container, messages) {
  if (!messages.length) {
    container.innerHTML =
      '<div class="empty-state" style="padding:1.25rem"><p>No messages yet.</p></div>';
    return;
  }
  container.innerHTML = messages
    .map(
      (m) => `
    <div class="message message-${m.author_role === "manager" ? "manager" : "requester"}">
      <div class="message-meta">${escapeHtml(m.author_name)} · ${escapeHtml(m.created_at_display || "")}</div>
      <div>${escapeHtml(m.body)}</div>
    </div>`
    )
    .join("");
}

export function renderAttachments(container, attachments) {
  if (!container) return;
  if (!attachments?.length) {
    container.innerHTML = '<p class="hint">No attachments yet.</p>';
    return;
  }
  container.innerHTML =
    '<div class="attach-grid">' +
    attachments
      .map((a) => {
        const url = escapeHtml(a.public_url || "#");
        const name = escapeHtml(a.file_name || "file");
        const isImg = String(a.mime_type || "").startsWith("image/");
        return `
      <a class="attach-card" href="${url}" target="_blank" rel="noopener">
        ${isImg && a.public_url ? `<img src="${url}" alt="" />` : `<span class="attach-icon">FILE</span>`}
        <span class="attach-name">${name}</span>
      </a>`;
      })
      .join("") +
    "</div>";
}

/** Soft chime for new manager inbox items (Web Audio — no asset file). */
export function playNewTicketChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.08, now + 0.02 + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35 + i * 0.08);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + i * 0.08);
      o.stop(now + 0.45 + i * 0.08);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    /* ignore */
  }
}
