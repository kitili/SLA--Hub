/**
 * Ops Request Desk — main application.
 */

import * as api from "./api.js";
import { isOnline, onConnectivityChange } from "./connectivity.js";
import { startAutoSync, syncNow } from "./sync.js";
import * as store from "./offline-store.js";
import {
  showToast,
  showBanner,
  statusLabel,
  statusClass,
  escapeHtml,
  shortTicketId,
  filterRequestsByQuery,
  countByStatus,
  renderStatsStrip,
  renderRequestTable,
  renderMessages,
  renderAttachments,
  playNewTicketChime,
} from "./ui.js";
import * as extras from "./desk-extras.js";

const SESSION_KEY = "ops_desk_user";
const LAST_OPEN_COUNT_KEY = "ops_desk_last_open_count";
const DRAFT_KEY = "ops_desk_draft";
const connBar = document.getElementById("connectivity-bar");
const btnSync = document.getElementById("btn-sync");

let user = null;
let currentView = "list";
let selectedId = null;
let cachedRequesterList = [];
let cachedManagerList = [];
let badgePollTimer = null;
let authUser = null;
let cachedAlerts = [];
let alertPollTimer = null;
let pendingDraft = null;

/** Deep links from Ops domains: ?dept=Facilities&action=new&title=... */
function parseDeepLink() {
  const params = new URLSearchParams(location.search || "");
  const dept = params.get("dept") || params.get("department") || "";
  const action = params.get("action") || "";
  const draft = {
    department: dept,
    action: action === "new" || action === "list" ? action : "",
    title: params.get("title") || "",
    details: params.get("details") || "",
    category: params.get("category") || "",
    priority: params.get("priority") || "",
    campus: params.get("campus") || "",
    source_type: params.get("sourceType") || params.get("source_type") || "",
    source_id: params.get("sourceId") || params.get("source_id") || "",
    source_url: params.get("sourceUrl") || params.get("source_url") || "",
  };
  const hasDraft = Object.values(draft).some((v) => String(v || "").trim());
  if (!hasDraft) return null;
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
  return draft;
}

function loadPendingDraft() {
  if (pendingDraft) return pendingDraft;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    pendingDraft = raw ? JSON.parse(raw) : null;
  } catch {
    pendingDraft = null;
  }
  return pendingDraft;
}

function clearPendingDraft() {
  pendingDraft = null;
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

function applyDraftToSubmitForm(draft) {
  if (!draft) return;
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el && value) el.value = value;
  };
  if (draft.department && api.DEPARTMENTS.includes(draft.department)) {
    setVal("submit-department", draft.department);
  }
  setVal("submit-title", draft.title);
  setVal("submit-details", draft.details);
  setVal("submit-category", draft.category);
  setVal("submit-priority", draft.priority);
  setVal("submit-campus", draft.campus);
}

function openRequesterSubmitTab() {
  document.querySelectorAll("#panel-requester .tab-btn").forEach((b) => b.classList.remove("active"));
  document.querySelector('#panel-requester .tab-btn[data-tab="submit"]')?.classList.add("active");
  document.getElementById("req-tab-submit")?.classList.remove("hidden");
  document.getElementById("req-tab-list")?.classList.add("hidden");
  document.getElementById("req-tab-detail")?.classList.add("hidden");
}

// --- Session ---
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(u) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(u));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  user = null;
}

async function updateConnectivityBar() {
  if (!connBar) return;
  const pending = await store.outboxCount();
  const online = isOnline();

  if (!online) {
    connBar.textContent =
      pending > 0
        ? "Offline — " + pending + " change(s) queued. They will sync when you are back online."
        : "Offline — you can still open tickets and work from cached data.";
    connBar.className = "connectivity-bar";
    connBar.classList.remove("hidden");
  } else if (pending > 0) {
    connBar.textContent = "Online — " + pending + " change(s) waiting to sync.";
    connBar.className = "connectivity-bar online-pending";
    connBar.classList.remove("hidden");
  } else {
    connBar.classList.add("hidden");
  }

  if (btnSync) {
    btnSync.classList.toggle("hidden", !pending || !online);
  }
}

function setupConnectivity() {
  onConnectivityChange(() => {
    updateConnectivityBar();
    if (isOnline()) syncNow().then(refreshCurrentView).catch(() => {});
  });
  if (btnSync) {
    btnSync.addEventListener("click", async () => {
      btnSync.disabled = true;
      try {
        const { synced, errors } = await syncNow();
        if (errors.length) {
          showToast("Sync partly failed: " + errors[0].message, "error");
        } else if (synced) {
          showToast("Synced " + synced + " item(s).", "success");
        } else {
          showToast("Nothing to sync.", "success");
        }
        await updateConnectivityBar();
        refreshCurrentView();
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        btnSync.disabled = false;
      }
    });
  }
  updateConnectivityBar();
  setInterval(updateConnectivityBar, 8000);
}

function refreshCurrentView() {
  if (!user) return;
  if (user.role === "manager") {
    loadManagerInbox();
    if (selectedId) openManagerDetail(selectedId);
    refreshBadge();
  } else {
    loadRequesterList();
    if (selectedId) openRequesterDetail(selectedId);
  }
}

// --- Screens ---
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");

function showLogin() {
  loginScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
}

function showApp() {
  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  updateConnectivityBar();
  updateHeader();
  refreshAlerts();
  startAlertPolling();
  if (user.role === "manager") {
    initManager();
    startManagerPolling();
  } else {
    stopManagerPolling();
    initRequester();
  }
}

function startAlertPolling() {
  stopAlertPolling();
  alertPollTimer = setInterval(() => {
    if (user) refreshAlerts();
  }, 25000);
}

function stopAlertPolling() {
  if (alertPollTimer) {
    clearInterval(alertPollTimer);
    alertPollTimer = null;
  }
}

async function refreshAlerts() {
  if (!user) return;
  cachedAlerts = await extras.fetchDeskAlerts({
    role: user.role,
    ownerToken: api.getOrCreateOwnerToken(),
  });
  paintAlertUi();
}

function paintAlertUi() {
  const unread = extras.unreadCount(cachedAlerts);
  const dot = document.getElementById("alert-dot");
  const banner = document.getElementById("alert-banner");
  if (dot) {
    if (unread > 0) {
      dot.textContent = String(unread);
      dot.classList.remove("hidden");
    } else {
      dot.classList.add("hidden");
    }
  }
  if (banner) {
    const top = cachedAlerts.find((a) => !a.read_at);
    if (top) {
      banner.textContent = top.title + (top.body ? " — " + top.body : "");
      banner.classList.remove("hidden");
      banner.onclick = () => {
        document.getElementById("btn-alerts")?.click();
      };
    } else {
      banner.classList.add("hidden");
      banner.onclick = null;
    }
  }

  const panel = document.getElementById("alert-panel");
  if (!panel || panel.classList.contains("hidden")) return;
  renderAlertPanel();
}

function renderAlertPanel() {
  const panel = document.getElementById("alert-panel");
  if (!panel) return;
  if (!cachedAlerts.length) {
    panel.innerHTML = '<p class="alert-empty">No alerts yet.</p>';
    return;
  }
  panel.innerHTML =
    `<div class="alert-panel-head">
      <strong>Alerts</strong>
      <button type="button" class="btn btn-outline btn-sm" id="btn-alerts-clear">Mark all read</button>
    </div>` +
    cachedAlerts
      .map((a) => {
        const when = a.created_at
          ? new Date(a.created_at).toLocaleString("en-GB", {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "";
        return `<button type="button" class="alert-item ${a.read_at ? "" : "unread"}" data-alert="${escapeHtml(a.id)}" data-req="${escapeHtml(a.request_id || "")}">
        <span class="alert-item-title">${escapeHtml(a.title || "Alert")}</span>
        <span class="alert-item-body">${escapeHtml(a.body || "")}</span>
        <span class="alert-item-time">${escapeHtml(when)}</span>
      </button>`;
      })
      .join("");

  document.getElementById("btn-alerts-clear")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    await extras.markAllAlertsRead(cachedAlerts);
    refreshAlerts();
  });

  panel.querySelectorAll("[data-alert]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-alert");
      const req = btn.getAttribute("data-req");
      await extras.markAlertRead(id);
      document.getElementById("alert-panel")?.classList.add("hidden");
      await refreshAlerts();
      if (req && user?.role === "manager") openManagerDetail(req);
      else if (req && user?.role === "requester") openRequesterDetail(req);
    });
  });
}

document.getElementById("btn-alerts")?.addEventListener("click", (e) => {
  e.stopPropagation();
  const panel = document.getElementById("alert-panel");
  if (!panel) return;
  const open = panel.classList.toggle("hidden") === false;
  document.getElementById("btn-alerts")?.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) renderAlertPanel();
});

document.addEventListener("click", (e) => {
  const menu = document.querySelector(".alert-menu");
  const panel = document.getElementById("alert-panel");
  if (!menu || !panel || panel.classList.contains("hidden")) return;
  if (!menu.contains(e.target)) panel.classList.add("hidden");
});

function updateHeader() {
  const title = document.getElementById("header-title");
  const meta = document.getElementById("header-meta");
  const badge = document.getElementById("badge-new");
  const buildEl = document.getElementById("build-id");
  const buildId = globalThis.__SL_ENV__?.BUILD_ID;
  if (buildEl && buildId) {
    buildEl.textContent = "build " + buildId;
    buildEl.classList.remove("hidden");
  }

  if (user.role === "manager") {
    title.textContent = "Manager inbox";
    meta.textContent = "All departments";
    refreshBadge();
  } else {
    title.textContent = "Open ticket";
    meta.textContent = user.requesterName
      ? user.requesterName + " · signed in"
      : "Department staff";
    badge.classList.add("hidden");
  }
}

async function refreshBadge() {
  if (user?.role !== "manager") return;
  try {
    const { newCount } = await api.getStats();
    const badge = document.getElementById("badge-new");
    const countEl = document.getElementById("mgr-tab-count");
    if (newCount > 0) {
      badge.textContent = newCount + " new";
      badge.classList.remove("hidden");
      document.title = "(" + newCount + ") Ops Tickets";
    } else {
      badge.classList.add("hidden");
      document.title = "Ops Ticket Desk";
    }
    if (countEl) {
      countEl.textContent = newCount > 0 ? "· " + newCount + " open" : "";
    }

    let prev = 0;
    try {
      prev = Number(sessionStorage.getItem(LAST_OPEN_COUNT_KEY) || "0");
    } catch {
      prev = 0;
    }
    if (newCount > prev && prev >= 0 && document.visibilityState === "visible") {
      playNewTicketChime();
      if (newCount > prev) {
        extras.createDeskAlert({
          audience: "manager",
          kind: "urgent",
          title: newCount + " open ticket" + (newCount === 1 ? "" : "s"),
          body: "Inbox has new open work — check Alerts / Inbox.",
        }).then(() => refreshAlerts());
      }
    }
    try {
      sessionStorage.setItem(LAST_OPEN_COUNT_KEY, String(newCount));
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

function startManagerPolling() {
  stopManagerPolling();
  badgePollTimer = setInterval(() => {
    if (user?.role === "manager") refreshBadge();
  }, 20000);
}

function stopManagerPolling() {
  if (badgePollTimer) {
    clearInterval(badgePollTimer);
    badgePollTimer = null;
  }
}

// --- Login ---
const roleSelect = document.getElementById("login-role");
const deptWrap = document.getElementById("dept-wrap");
const pinWrap = document.getElementById("pin-wrap");
const pinHint = document.getElementById("pin-hint");

roleSelect.addEventListener("change", () => {
  const isRequester = roleSelect.value === "requester";
  deptWrap.classList.toggle("hidden", !isRequester);
  pinWrap.classList.toggle("hidden", isRequester);
  document.getElementById("login-name").toggleAttribute("required", isRequester);
  document.getElementById("login-pin").toggleAttribute("required", !isRequester);
  if (isRequester) {
    document.getElementById("login-pin").value = "";
  }
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const role = roleSelect.value;
  const pin = document.getElementById("login-pin").value;
  const requesterName =
    role === "requester" ? document.getElementById("login-name").value.trim() : null;

  if (role === "requester" && !requesterName) {
    showToast("Enter your name to see only your tickets.", "error");
    document.getElementById("login-name").focus();
    return;
  }
  if (role === "manager" && !String(pin || "").trim()) {
    showToast("Enter the manager PIN.", "error");
    document.getElementById("login-pin").focus();
    return;
  }

  try {
    const { user: u } = await api.login({
      role,
      pin: role === "manager" ? pin : undefined,
    });
    authUser = await extras.ensureDeskAuth(role);
    user = {
      ...u,
      requesterName,
      ownerUid: authUser?.id || null,
    };
    saveSession(user);
    showApp();
    showToast(
      role === "manager"
        ? "Welcome, Operations Manager."
        : "Welcome, " + requesterName + "." + (authUser ? " (secure session)" : ""),
      "success"
    );
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  clearSession();
  stopManagerPolling();
  stopAlertPolling();
  await extras.signOutDeskAuth();
  authUser = null;
  document.getElementById("login-pin").value = "";
  showLogin();
  showToast("Signed out.", "success");
});

// --- Requester ---
function initRequester() {
  document.getElementById("panel-manager").classList.add("hidden");
  document.getElementById("panel-requester").classList.remove("hidden");

  const deptField = document.getElementById("submit-department");
  deptField.disabled = false;

  document.getElementById("submit-name").value = user.requesterName || "";

  setupRequesterTabs();
  const draft = loadPendingDraft();
  if (draft) {
    applyDraftToSubmitForm(draft);
    if (draft.action === "new" || draft.title || draft.details) {
      openRequesterSubmitTab();
    } else {
      loadRequesterList();
    }
  } else {
    loadRequesterList();
  }
}

function setupRequesterTabs() {
  const tabs = document.querySelectorAll("#panel-requester .tab-btn");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.getAttribute("data-tab");
      document.getElementById("req-tab-submit").classList.toggle("hidden", tab !== "submit");
      document.getElementById("req-tab-list").classList.toggle("hidden", tab !== "list");
      document.getElementById("req-tab-detail").classList.toggle("hidden", tab !== "detail");
      if (tab === "list") loadRequesterList();
    });
  });
}

document.getElementById("submit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const draft = loadPendingDraft() || {};
  const body = {
    department: document.getElementById("submit-department").value.trim(),
    requester_name: document.getElementById("submit-name").value.trim(),
    campus: document.getElementById("submit-campus").value.trim(),
    title: document.getElementById("submit-title").value.trim(),
    details: document.getElementById("submit-details").value.trim(),
    category: document.getElementById("submit-category").value,
    priority: document.getElementById("submit-priority").value,
    owner_token: api.getOrCreateOwnerToken(),
    owner_uid: authUser?.id || user.ownerUid || null,
    source_type: draft.source_type || null,
    source_id: draft.source_id || null,
    source_url: draft.source_url || null,
  };
  try {
    const res = await api.submitRequest(body);
    user.requesterName = body.requester_name;
    saveSession(user);
    clearPendingDraft();
    updateConnectivityBar();
    e.target.reset();
    document.getElementById("submit-department").value = body.department;
    document.getElementById("submit-name").value = body.requester_name;

    // Prefer My tickets list with a soft success banner
    document.querySelectorAll("#panel-requester .tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelector('#panel-requester .tab-btn[data-tab="list"]')?.classList.add("active");
    document.getElementById("req-tab-submit").classList.add("hidden");
    document.getElementById("req-tab-detail").classList.add("hidden");
    document.getElementById("req-tab-list").classList.remove("hidden");
    await loadRequesterList();
    const code = shortTicketId(res.row || { id: res.id });
    showBanner(
      document.getElementById("req-tab-list"),
      res._queued
        ? code + " saved offline — will sync when you are back online."
        : code + " opened — Operations has it in the inbox.",
      "success"
    );
    if (!res._queued) {
      extras.createDeskAlert({
        audience: "manager",
        request_id: res.id,
        display_id: code,
        kind: body.priority === "urgent" ? "urgent" : "info",
        title: "New ticket " + code,
        body: body.title + " · " + body.department + (body.priority === "urgent" ? " · URGENT" : ""),
      }).then(() => refreshAlerts());
    }
    if (!res._queued && (body.priority === "urgent" || body.priority === "high")) {
      extras.notifyDesk({
        kind: "status",
        requestId: res.id,
        displayId: code,
        title: body.title,
        status: "open",
        department: body.department,
        campus: body.campus,
        actor: body.requester_name,
        message: `[Ops Desk] New ${body.priority} ticket ${code}: ${body.title}`,
      }).catch(() => {});
    }
    showToast(res._queued ? "Ticket saved offline." : "Ticket opened.", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
});

function paintRequesterList() {
  const wrap = document.getElementById("requester-list");
  const q = document.getElementById("req-search")?.value || "";
  const filtered = filterRequestsByQuery(cachedRequesterList, q);
  renderRequestTable(wrap, filtered, openRequesterDetail, {
    emptyTitle: q ? "No matches" : "No tickets yet",
    emptyHint: q
      ? "Try a different search."
      : "Tickets you open with this name will show up here — only yours.",
  });
  const counts = countByStatus(cachedRequesterList);
  const el = document.getElementById("req-tab-count");
  if (el) el.textContent = counts.total ? "(" + counts.total + ")" : "";
}

async function loadRequesterList() {
  const wrap = document.getElementById("requester-list");
  wrap.innerHTML = "<p class=\"hint\">Loading…</p>";
  try {
    const { requests } = await api.listRequests({
      requester_name: user.requesterName,
      owner_token: api.getOrCreateOwnerToken(),
    });
    cachedRequesterList = requests;
    paintRequesterList();
  } catch (err) {
    wrap.innerHTML = "<p class=\"hint\">" + escapeHtml(err.message) + "</p>";
  }
}

async function openRequesterDetail(id) {
  selectedId = id;
  document.querySelectorAll("#panel-requester .tab-btn").forEach((b) => b.classList.remove("active"));
  document.getElementById("req-tab-submit").classList.add("hidden");
  document.getElementById("req-tab-list").classList.add("hidden");
  document.getElementById("req-tab-detail").classList.remove("hidden");

  const panel = document.getElementById("requester-detail");
  panel.innerHTML = "<p class=\"hint\">Loading…</p>";

  try {
    const { request, messages } = await api.getRequest(id);
    const mine =
      (request.owner_token &&
        request.owner_token === api.getOrCreateOwnerToken()) ||
      String(request.requester_name || "").trim().toLowerCase() ===
        String(user.requesterName || "").trim().toLowerCase();
    if (!mine) {
      panel.innerHTML =
        '<p class="hint">This ticket belongs to someone else. <span class="back-link" id="back-requester-list">Back to my tickets</span></p>';
      document.getElementById("back-requester-list").addEventListener("click", () => {
        document.getElementById("req-tab-detail").classList.add("hidden");
        document.getElementById("req-tab-list").classList.remove("hidden");
        document.querySelector('#panel-requester .tab-btn[data-tab="list"]').classList.add("active");
        loadRequesterList();
      });
      return;
    }
    const canClose = request.status === "resolved";
    const canReopen = request.status === "resolved" || request.status === "closed";

    panel.innerHTML = `
      <span class="back-link" id="back-requester-list">← Back to my tickets</span>
      <div class="card-head">
        <h2>${escapeHtml(shortTicketId(request))} — ${escapeHtml(request.title)}</h2>
      </div>
      <dl class="detail-grid">
        <div class="detail-item"><dt>Status</dt><dd><span class="${statusClass(request.status)}">${statusLabel(request.status)}</span></dd></div>
        <div class="detail-item"><dt>Opened</dt><dd>${escapeHtml(request.created_at_display)}</dd></div>
        <div class="detail-item"><dt>Category</dt><dd>${escapeHtml(request.category || "General")}</dd></div>
        <div class="detail-item"><dt>Priority</dt><dd>${escapeHtml(request.priority || "normal")}</dd></div>
        <div class="detail-item span-full"><dt>Details</dt><dd>${escapeHtml(request.details)}</dd></div>
      </dl>
      <div class="card">
        <h3 class="settings-sub">Attachments</h3>
        <div id="req-attachments"></div>
        <label for="req-file">Add photo / PDF</label>
        <input id="req-file" type="file" accept="image/*,application/pdf" />
        <button type="button" class="btn btn-secondary btn-sm" id="btn-req-upload">Upload</button>
      </div>
      <div class="messages" id="req-messages"></div>
      <div class="card">
        <label for="req-reply">Add comment</label>
        <textarea id="req-reply" placeholder="Add a note…"></textarea>
        <button type="button" class="btn btn-secondary" id="btn-req-msg">Send comment</button>
      </div>
      ${
        canClose
          ? `<div class="card">
        <h2>Close ticket</h2>
        <p class="hint">Operations marked this ticket as resolved. Close it if everything is okay.</p>
        <textarea id="receive-note" placeholder="Optional closing note"></textarea>
        <button type="button" class="btn btn-success" id="btn-received">Close ticket</button>
      </div>`
          : ""
      }
      ${
        canReopen
          ? `<div class="card">
        <h2>Reopen</h2>
        <p class="hint">If the issue is not fixed, reopen the ticket.</p>
        <textarea id="reopen-note" placeholder="Optional note"></textarea>
        <button type="button" class="btn btn-danger" id="btn-reopen">Reopen ticket</button>
      </div>`
          : ""
      }`;

    renderMessages(document.getElementById("req-messages"), messages);
    const reqAtt = await extras.listAttachments(id);
    renderAttachments(document.getElementById("req-attachments"), reqAtt);

    document.getElementById("btn-req-upload")?.addEventListener("click", async () => {
      const file = document.getElementById("req-file")?.files?.[0];
      if (!file) {
        showToast("Choose a file first.", "error");
        return;
      }
      try {
        await extras.uploadAttachment(id, file, user.requesterName || "staff");
        showToast("Attachment uploaded.", "success");
        openRequesterDetail(id);
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    document.getElementById("back-requester-list").addEventListener("click", () => {
      document.getElementById("req-tab-detail").classList.add("hidden");
      document.getElementById("req-tab-list").classList.remove("hidden");
      document.querySelector('#panel-requester .tab-btn[data-tab="list"]').classList.add("active");
      loadRequesterList();
    });

    document.getElementById("btn-req-msg")?.addEventListener("click", async () => {
      const body = document.getElementById("req-reply").value;
      if (!body.trim()) return;
      try {
        const res = await api.postMessage(id, {
          author_role: "requester",
          author_name: user.requesterName || request.requester_name,
          body,
        });
        showToast(res._queued ? "Comment queued for sync." : "Message sent.", "success");
        updateConnectivityBar();
        openRequesterDetail(id);
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    document.getElementById("btn-received")?.addEventListener("click", async () => {
      try {
        const res = await api.markReceived(id, {
          requester_name: user.requesterName || request.requester_name,
          note: document.getElementById("receive-note")?.value || "",
        });
        showToast(res._queued ? "Close queued for sync." : "Ticket closed.", "success");
        updateConnectivityBar();
        openRequesterDetail(id);
        loadRequesterList();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    document.getElementById("btn-reopen")?.addEventListener("click", async () => {
      try {
        const res = await api.reopenTicket(id, {
          requester_name: user.requesterName || request.requester_name,
          note: document.getElementById("reopen-note")?.value || "",
        });
        showToast(res._queued ? "Reopen queued for sync." : "Ticket reopened.", "success");
        updateConnectivityBar();
        openRequesterDetail(id);
        loadRequesterList();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  } catch (err) {
    panel.innerHTML = "<p class=\"hint\">" + escapeHtml(err.message) + "</p>";
  }
}

// --- Manager ---
function initManager() {
  document.getElementById("panel-requester").classList.add("hidden");
  document.getElementById("panel-manager").classList.remove("hidden");
  setupManagerTabs();
  loadManagerInbox();
  refreshAuthStatus();
}

function setupManagerTabs() {
  const tabs = document.querySelectorAll("#panel-manager .tab-btn");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.getAttribute("data-tab");
      document.getElementById("mgr-tab-inbox").classList.toggle("hidden", tab !== "inbox");
      document.getElementById("mgr-tab-detail").classList.toggle("hidden", tab !== "detail");
      document.getElementById("mgr-tab-export").classList.toggle("hidden", tab !== "export");
      document.getElementById("mgr-tab-settings").classList.toggle("hidden", tab !== "settings");
      if (tab === "inbox") loadManagerInbox();
      if (tab === "settings") {
        refreshAuthStatus();
        loadCampusLeadsEditor();
      }
    });
  });
}

document.getElementById("mgr-filter-apply").addEventListener("click", loadManagerInbox);
document.getElementById("mgr-filter-clear").addEventListener("click", () => {
  document.getElementById("mgr-filter-dept").value = "";
  document.getElementById("mgr-filter-status").value = "";
  const search = document.getElementById("mgr-search");
  if (search) search.value = "";
  const urgent = document.getElementById("mgr-filter-urgent");
  if (urgent) urgent.checked = false;
  loadManagerInbox();
});

document.getElementById("mgr-filter-urgent")?.addEventListener("change", paintManagerList);

document.getElementById("mgr-view-save")?.addEventListener("click", () => {
  const name = prompt("Name this view (e.g. Facilities urgent)");
  if (!name?.trim()) return;
  extras.upsertSavedView({
    name: name.trim(),
    department: document.getElementById("mgr-filter-dept").value,
    status: document.getElementById("mgr-filter-status").value,
    search: document.getElementById("mgr-search").value,
    urgentOnly: document.getElementById("mgr-filter-urgent").checked,
  });
  renderSavedViews();
  showToast("View saved.", "success");
});

document.getElementById("mgr-search")?.addEventListener("input", () => {
  paintManagerList();
});
document.getElementById("req-search")?.addEventListener("input", () => {
  paintRequesterList();
});

function paintManagerList() {
  const wrap = document.getElementById("manager-list");
  const q = document.getElementById("mgr-search")?.value || "";
  const urgentOnly = document.getElementById("mgr-filter-urgent")?.checked;
  let filtered = filterRequestsByQuery(cachedManagerList, q);
  if (urgentOnly) {
    filtered = filtered.filter(
      (r) => r.priority === "urgent" || r.priority === "high" || r.urgency === "urgent"
    );
  }
  renderRequestTable(wrap, filtered, openManagerDetail, {
    showRequester: true,
    emptyTitle: q || urgentOnly ? "No matches" : "Inbox is clear",
    emptyHint: q || urgentOnly ? "Try a different search or clear filters." : "New tickets from departments will land here.",
  });
  const counts = countByStatus(cachedManagerList);
  renderStatsStrip(document.getElementById("mgr-stats"), counts);
  const el = document.getElementById("mgr-tab-count");
  if (el) el.textContent = counts.fresh ? "· " + counts.fresh + " open" : counts.open ? "(" + counts.open + ")" : "";
  renderSavedViews();
}

function renderSavedViews() {
  const box = document.getElementById("saved-views");
  if (!box) return;
  const views = extras.loadSavedViews();
  if (!views.length) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML =
    '<span class="saved-views-label">Saved</span>' +
    views
      .map(
        (v) =>
          `<button type="button" class="view-chip" data-view="${escapeHtml(v.name)}">${escapeHtml(v.name)}</button>
           <button type="button" class="view-chip-x" data-del="${escapeHtml(v.name)}" title="Remove">×</button>`
      )
      .join("");
  box.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = extras.loadSavedViews().find((x) => x.name === btn.getAttribute("data-view"));
      if (!v) return;
      document.getElementById("mgr-filter-dept").value = v.department || "";
      document.getElementById("mgr-filter-status").value = v.status || "";
      document.getElementById("mgr-search").value = v.search || "";
      document.getElementById("mgr-filter-urgent").checked = Boolean(v.urgentOnly);
      loadManagerInbox();
    });
  });
  box.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      extras.deleteSavedView(btn.getAttribute("data-del"));
      renderSavedViews();
    });
  });
}

async function loadManagerInbox() {
  const wrap = document.getElementById("manager-list");
  wrap.innerHTML = "<p class=\"hint\">Loading…</p>";
  const params = {};
  const dept = document.getElementById("mgr-filter-dept").value;
  const status = document.getElementById("mgr-filter-status").value;
  if (dept) params.department = dept;
  if (status) params.status = status;

  try {
    const { requests } = await api.listRequests(params);
    cachedManagerList = requests;
    paintManagerList();
    refreshBadge();
  } catch (err) {
    wrap.innerHTML = "<p class=\"hint\">" + escapeHtml(err.message) + "</p>";
  }
}

async function openManagerDetail(id) {
  selectedId = id;
  document.getElementById("mgr-tab-inbox").classList.add("hidden");
  document.getElementById("mgr-tab-detail").classList.remove("hidden");
  document.querySelectorAll("#panel-manager .tab-btn").forEach((b) => b.classList.remove("active"));

  const panel = document.getElementById("manager-detail");
  panel.innerHTML = "<p class=\"hint\">Loading…</p>";

  try {
    const { request, messages } = await api.getRequest(id);
    const closed = request.status === "closed" || request.status === "declined";

    panel.innerHTML = `
      <span class="back-link" id="back-manager-inbox">← Back to inbox</span>
      <div class="card-head">
        <h2>${escapeHtml(shortTicketId(request))} — ${escapeHtml(request.title)}</h2>
      </div>
      <dl class="detail-grid">
        <div class="detail-item"><dt>Department</dt><dd>${escapeHtml(request.department)} · ${escapeHtml(request.requester_name)}</dd></div>
        <div class="detail-item"><dt>Status</dt><dd><span class="${statusClass(request.status)}">${statusLabel(request.status)}</span></dd></div>
        <div class="detail-item"><dt>Campus</dt><dd>${escapeHtml(request.campus || "—")}</dd></div>
        <div class="detail-item"><dt>Category</dt><dd>${escapeHtml(request.category || "General")}</dd></div>
        <div class="detail-item"><dt>Priority</dt><dd>${escapeHtml(request.priority || "normal")}${request.priority === "urgent" ? ' <span class="urgent-tag">URGENT</span>' : ""}</dd></div>
        <div class="detail-item"><dt>Assigned to</dt><dd id="mgr-assigned-label">${escapeHtml(request.assigned_to || "—")}</dd></div>
        <div class="detail-item"><dt>Opened</dt><dd>${escapeHtml(request.created_at_display)} <span class="ticket-age">${escapeHtml(extras.formatTicketAge(request.created_at))}</span>${extras.isSlaBreached(request) ? ' <span class="urgent-tag">SLA</span>' : ""}</dd></div>
        <div class="detail-item"><dt>Resolved</dt><dd>${escapeHtml(request.resolved_at_display || "—")}</dd></div>
        <div class="detail-item"><dt>Closed</dt><dd>${escapeHtml(request.closed_at_display || "—")} ${request.closed_by ? "by " + escapeHtml(request.closed_by) : ""}</dd></div>
        <div class="detail-item span-full"><dt>Details</dt><dd>${escapeHtml(request.details)}</dd></div>
      </dl>
      ${
        !closed
          ? `<div class="btn-group">
        <button type="button" class="btn btn-primary btn-sm" id="btn-assign-me">Assign to me</button>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-notify-lead">Notify campus lead</button>
        <button type="button" class="btn btn-secondary btn-sm" data-status="in_progress">In progress</button>
        <button type="button" class="btn btn-secondary btn-sm" data-status="pending_info">Pending info</button>
        <button type="button" class="btn btn-success btn-sm" data-status="resolved">Resolve</button>
        <button type="button" class="btn btn-danger btn-sm" data-status="declined">Decline</button>
      </div>
      <div class="card assign-card">
        <label for="assign-note">Assignment note (optional)</label>
        <input id="assign-note" type="text" placeholder="e.g. Taking this — will update by 3pm" />
      </div>`
          : ""
      }
      <div class="card">
        <h3 class="settings-sub">Attachments</h3>
        <div id="mgr-attachments"></div>
        <label for="mgr-file">Add photo / PDF</label>
        <input id="mgr-file" type="file" accept="image/*,application/pdf" />
        <button type="button" class="btn btn-secondary btn-sm" id="btn-mgr-upload">Upload</button>
      </div>
      <div class="messages" id="mgr-messages"></div>
      <div class="card">
        <label for="mgr-reply">Add comment / response</label>
        <textarea id="mgr-reply" placeholder="Type @lead to also SMS the campus lead…"></textarea>
        <button type="button" class="btn btn-primary" id="btn-mgr-msg">Send</button>
      </div>`;

    renderMessages(document.getElementById("mgr-messages"), messages);
    const mgrAtt = await extras.listAttachments(id);
    renderAttachments(document.getElementById("mgr-attachments"), mgrAtt);

    document.getElementById("back-manager-inbox").addEventListener("click", () => {
      document.getElementById("mgr-tab-detail").classList.add("hidden");
      document.getElementById("mgr-tab-inbox").classList.remove("hidden");
      document.querySelector('#panel-manager .tab-btn[data-tab="inbox"]').classList.add("active");
      loadManagerInbox();
    });

    document.getElementById("btn-mgr-upload")?.addEventListener("click", async () => {
      const file = document.getElementById("mgr-file")?.files?.[0];
      if (!file) {
        showToast("Choose a file first.", "error");
        return;
      }
      try {
        await extras.uploadAttachment(id, file, "Operations Manager");
        showToast("Attachment uploaded.", "success");
        openManagerDetail(id);
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    document.getElementById("btn-notify-lead")?.addEventListener("click", async () => {
      if (!request.campus) {
        showToast("This ticket has no campus set.", "error");
        return;
      }
      const res = await extras.notifyDesk({
        kind: "campus_lead",
        requestId: id,
        displayId: shortTicketId(request),
        title: request.title,
        campus: request.campus,
        department: request.department,
        actor: "Operations Manager",
        message:
          `[Ops Desk] Please check ${shortTicketId(request)} “${request.title}” at ${request.campus} (${request.department}).`,
      });
      showToast(res.ok || res.notified ? "Campus lead notified (or stubbed)." : res.error || "Notify failed", res.ok ? "success" : "error");
      openManagerDetail(id);
    });

    document.getElementById("btn-assign-me")?.addEventListener("click", async () => {
      try {
        const note = document.getElementById("assign-note")?.value || "";
        const res = await api.assignTicket(id, {
          assigned_to: "Operations Manager",
          actor_name: "Operations Manager",
          note,
        });
        showToast(res._queued ? "Assignment queued." : "Assigned to you.", "success");
        updateConnectivityBar();
        openManagerDetail(id);
        refreshBadge();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    panel.querySelectorAll("[data-status]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const status = btn.getAttribute("data-status");
        if (status === "declined" && !confirm("Decline this ticket?")) return;
        try {
          const res = await api.patchStatus(id, {
            status,
            actor_name: "Operations Manager",
          });
          showToast(res._queued ? "Status queued for sync." : "Status: " + statusLabel(status), "success");
          extras.createDeskAlert({
            audience: "requester",
            owner_token: request.owner_token || null,
            request_id: id,
            display_id: shortTicketId(request),
            kind: "status",
            title: shortTicketId(request) + " → " + statusLabel(status),
            body: request.title,
          }).then(() => refreshAlerts());
          extras.createDeskAlert({
            audience: "manager",
            request_id: id,
            display_id: shortTicketId(request),
            kind: "status",
            title: "Updated " + shortTicketId(request),
            body: statusLabel(status) + " · " + request.title,
          }).then(() => refreshAlerts());
          extras.notifyDesk({
            kind: "status",
            requestId: id,
            displayId: shortTicketId(request),
            title: request.title,
            status,
            department: request.department,
            campus: request.campus,
            actor: "Operations Manager",
          }).catch(() => {});
          updateConnectivityBar();
          openManagerDetail(id);
          refreshBadge();
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    });

    document.getElementById("btn-mgr-msg").addEventListener("click", async () => {
      const body = document.getElementById("mgr-reply").value;
      if (!body.trim()) return;
      try {
        const res = await api.postMessage(id, {
          author_role: "manager",
          author_name: "Operations Manager",
          body,
        });
        if (/@lead\b/i.test(body) && request.campus) {
          extras.notifyDesk({
            kind: "mention",
            requestId: id,
            displayId: shortTicketId(request),
            title: request.title,
            campus: request.campus,
            department: request.department,
            actor: "Operations Manager",
            message: `[Ops Desk @lead] ${shortTicketId(request)}: ${body.slice(0, 200)}`,
          }).catch(() => {});
        }
        showToast(res._queued ? "Reply queued for sync." : "Reply sent.", "success");
        updateConnectivityBar();
        openManagerDetail(id);
        refreshBadge();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  } catch (err) {
    panel.innerHTML = "<p class=\"hint\">" + escapeHtml(err.message) + "</p>";
  }
}

document.getElementById("btn-export-sheets").addEventListener("click", async () => {
  const from = document.getElementById("export-from").value;
  const to = document.getElementById("export-to").value;
  try {
    const { count } = await api.exportForGoogleSheets(from, to);
    showToast(
      count + " ticket(s) copied — paste into cell A1 in the new Google Sheet (Ctrl+V).",
      "success"
    );
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("btn-export-csv").addEventListener("click", async () => {
  const from = document.getElementById("export-from").value;
  const to = document.getElementById("export-to").value;
  try {
    await api.downloadCsv(from, to);
    showToast("CSV downloaded.", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("btn-change-pin").addEventListener("click", async () => {
  const oldPin = document.getElementById("old-pin").value;
  const newPin = document.getElementById("new-pin").value;
  try {
    await api.changeManagerPin(oldPin, newPin);
    document.getElementById("old-pin").value = "";
    document.getElementById("new-pin").value = "";
    showToast("Manager PIN updated.", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
});

async function refreshAuthStatus() {
  const el = document.getElementById("auth-status");
  if (!el) return;
  authUser = await extras.currentDeskUser();
  if (authUser) {
    el.textContent =
      "Signed in as " +
      (authUser.email || (authUser.is_anonymous ? "anonymous session" : authUser.id.slice(0, 8)));
  } else {
    el.textContent = "No Ops Auth session — using PIN / device token.";
  }
}

document.getElementById("btn-auth-signin")?.addEventListener("click", async () => {
  const email = document.getElementById("auth-email")?.value || "";
  const password = document.getElementById("auth-password")?.value || "";
  try {
    authUser = await extras.signInDeskManager(email, password);
    showToast("Ops Auth connected.", "success");
    refreshAuthStatus();
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("btn-auth-signout")?.addEventListener("click", async () => {
  await extras.signOutDeskAuth();
  authUser = null;
  refreshAuthStatus();
  showToast("Ops Auth signed out.", "success");
});

async function loadCampusLeadsEditor() {
  const box = document.getElementById("campus-leads-editor");
  if (!box) return;
  const leads = await extras.loadCampusLeads();
  box.innerHTML = api.CAMPUSES.map((campus) => {
    const lead = leads[campus] || { name: "", phone: "", email: "" };
    return `
      <div class="lead-row" data-campus="${escapeHtml(campus)}">
        <strong>${escapeHtml(campus)}</strong>
        <input data-k="name" type="text" placeholder="Lead name" value="${escapeHtml(lead.name || "")}" />
        <input data-k="phone" type="tel" placeholder="+255…" value="${escapeHtml(lead.phone || "")}" />
        <input data-k="email" type="email" placeholder="email (optional)" value="${escapeHtml(lead.email || "")}" />
      </div>`;
  }).join("");
}

document.getElementById("btn-save-leads")?.addEventListener("click", async () => {
  const box = document.getElementById("campus-leads-editor");
  if (!box) return;
  const leads = {};
  box.querySelectorAll(".lead-row").forEach((row) => {
    const campus = row.getAttribute("data-campus");
    leads[campus] = {
      name: row.querySelector('[data-k="name"]')?.value?.trim() || "",
      phone: row.querySelector('[data-k="phone"]')?.value?.trim() || "",
      email: row.querySelector('[data-k="email"]')?.value?.trim() || "",
    };
  });
  try {
    await extras.saveCampusLeads(leads);
    showToast("Campus leads saved.", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
});

function isLocalDev() {
  const h = location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

function localSetupMessage() {
  return (
    "Database not connected. On this computer, edit public/js/config.js: " +
    "copy public/js/config.example.js if needed, then paste your Supabase Project URL and Publishable key " +
    "(Supabase → Settings → API Keys). Save the file and refresh this page. " +
    "If errors persist, hard-refresh (Ctrl+Shift+R) or clear site data for localhost."
  );
}

async function clearStaleServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) await r.unregister();
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
}

function showSetupError(msg) {
  const el = document.getElementById("setup-error");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function initStaticFormOptions() {
  const deptOpts = api.DEPARTMENTS.map(
    (d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`
  ).join("");
  document.getElementById("submit-department").innerHTML = deptOpts;
  document.getElementById("mgr-filter-dept").innerHTML =
    '<option value="">All departments</option>' + deptOpts;

  const catOpts = api.CATEGORIES.map(
    (c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
  ).join("");
  document.getElementById("submit-category").innerHTML = catOpts;

  const prOpts = api.PRIORITIES.map(
    (p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`
  ).join("");
  document.getElementById("submit-priority").innerHTML = prOpts;

  const campusEl = document.getElementById("submit-campus");
  if (campusEl && campusEl.tagName === "SELECT") {
    campusEl.innerHTML =
      '<option value="">Any / not sure</option>' +
      api.CAMPUSES.map(
        (c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
      ).join("");
  }
}

// --- Boot ---
async function boot() {
  initStaticFormOptions();
  pendingDraft = parseDeepLink() || loadPendingDraft();
  deptWrap.classList.toggle("hidden", roleSelect.value !== "requester");
  pinWrap.classList.toggle("hidden", roleSelect.value !== "manager");

  if (!api.isConfigured()) {
    if (isLocalDev()) {
      await clearStaleServiceWorker();
      showSetupError(localSetupMessage());
    } else {
      showSetupError(
        "Supabase is not connected on this site. Netlify → Site configuration → Environment variables: add SUPABASE_URL (Project URL) and SUPABASE_ANON_KEY (Publishable key from Supabase → API Keys — not Secret). Save, then Deploys → Trigger deploy → Deploy site. After deploy, open " +
          location.origin +
          "/js/env.js — your Project URL must appear there, not empty quotes. See SETUP-SUPABASE.md in the repo."
      );
    }
    showLogin();
    return;
  }

  setupConnectivity();
  startAutoSync();

  try {
    await api.refreshPinCache();
    const pinStatus = await api.getManagerPinStatus();
    if (!pinStatus.configured) {
      pinHint.textContent = "Run supabase/schema.sql in Supabase SQL Editor (sets manager PIN Ops2026).";
    } else if (!isOnline()) {
      pinHint.textContent = "Offline mode — manager PIN uses last cached settings.";
    }
  } catch (err) {
    if (!isOnline()) {
      pinHint.textContent = "Offline — sign in as department staff without network, or manager after one online login.";
    } else {
      pinHint.textContent = "Cannot reach Supabase: " + err.message;
    }
  }

  // Always start on the login screen so staff must confirm who they are.
  // Prefill last department / name only — never skip the form.
  const last = loadSession();
  user = null;
  if (pendingDraft?.action === "new" || pendingDraft?.department) {
    roleSelect.value = "requester";
  } else if (last?.role === "requester") {
    roleSelect.value = "requester";
  } else if (last?.role === "manager") {
    roleSelect.value = "manager";
  }
  if (last?.requesterName && roleSelect.value === "requester") {
    document.getElementById("login-name").value = last.requesterName;
  }
  deptWrap.classList.toggle("hidden", roleSelect.value !== "requester");
  pinWrap.classList.toggle("hidden", roleSelect.value !== "manager");
  document.getElementById("login-name").toggleAttribute("required", roleSelect.value === "requester");
  document.getElementById("login-pin").toggleAttribute("required", roleSelect.value === "manager");
  showLogin();
  if (pendingDraft?.department) {
    showBanner(
      document.querySelector(".login-card") || document.body,
      "Preparing a " +
        pendingDraft.department +
        " ticket — sign in, then confirm the department on the form.",
      "success",
    );
  } else if (pendingDraft?.action === "new") {
    showBanner(
      document.querySelector(".login-card") || document.body,
      "Sign in to open a ticket — choose which department should handle it on the form.",
      "success",
    );
  }
}

boot().catch((err) => {
  initStaticFormOptions();
  showSetupError("App failed to start: " + err.message);
  showLogin();
});
