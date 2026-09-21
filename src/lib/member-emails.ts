import "server-only";

/** Portal URL used in links inside member emails. */
const PORTAL_URL =
  (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "") ||
  "https://onboarding.silverleaf.co.tz";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BASE_STYLES = `
  font-family: Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  color: #1a1a2e;
  line-height: 1.6;
`;

const BTN_STYLE = `
  display: inline-block;
  background: #003087;
  color: #ffffff;
  text-decoration: none;
  padding: 12px 28px;
  border-radius: 6px;
  font-weight: bold;
  font-size: 1rem;
  margin-top: 8px;
`;

const FOOTER_HTML = `
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:2rem 0 1rem">
  <p style="color:#718096;font-size:0.82rem;margin:0">
    Warm regards,<br>
    Silverleaf Academy HR Team<br>
    <a href="mailto:jobs@silverleaf.co.tz" style="color:#003087">jobs@silverleaf.co.tz</a>
  </p>
`;

/**
 * Reminder email sent to an individual staff member asking them to log in
 * and continue their onboarding.
 */
export function buildMemberReminderEmail(name: string): string {
  const safeName = escapeHtml(name);
  return `
    <div style="${BASE_STYLES}">
      <p style="font-size:1.1rem;font-weight:600;color:#003087">
        Hi ${safeName},
      </p>
      <p>
        We noticed you haven't logged into the <strong>Silverleaf Academy Onboarding Hub</strong> recently.
        Your onboarding is still waiting for you — please log in and continue as soon as possible.
      </p>
      <p>
        Completing your onboarding on time helps you get up to speed quickly and ensures you have
        everything you need to thrive at Silverleaf.
      </p>
      <p style="margin:1.5rem 0">
        <a href="${PORTAL_URL}" style="${BTN_STYLE}">Open the portal →</a>
      </p>
      <p>
        If you have any questions or need support, please reach out to the HR team at
        <a href="mailto:jobs@silverleaf.co.tz">jobs@silverleaf.co.tz</a>.
      </p>
      ${FOOTER_HTML}
    </div>
  `;
}

/**
 * Reminder email for members who completed onboarding but never filled the bio form.
 */
export function buildBioFormReminderEmail(name: string): string {
  const safeName = escapeHtml(name);
  return `
    <div style="${BASE_STYLES}">
      <p style="font-size:1.1rem;font-weight:600;color:#003087">
        Hi ${safeName},
      </p>
      <p>
        Congratulations on completing your onboarding at <strong>Silverleaf Academy</strong>! 🎉
      </p>
      <p>
        We noticed that your <strong>Bio Data Form</strong> is still empty. This is an important
        one-time form that HR needs to have on file — it covers your personal details, emergency
        contacts, banking information, and more.
      </p>
      <p>
        Please log into the portal and complete it as soon as possible.
      </p>
      <p style="margin:1.5rem 0">
        <a href="${PORTAL_URL}/bio" style="${BTN_STYLE}">Fill bio data form →</a>
      </p>
      <p>
        If you have any questions, reach out to the HR team at
        <a href="mailto:jobs@silverleaf.co.tz">jobs@silverleaf.co.tz</a>.
      </p>
      ${FOOTER_HTML}
    </div>
  `;
}

export interface OffTrackMemberRow {
  fullName: string;
  email: string;
  campus: string | null;
  completionPct: number;
  risk: "orange" | "red";
  lastActiveAt: string | null;
}

export interface BioMissingRow {
  fullName: string;
  email: string;
  campus: string | null;
}

/**
 * Daily summary email sent to HR — covers off-track members and
 * completed members who haven't filled the bio form.
 */
export function buildHrOffTrackReportEmail(
  members: OffTrackMemberRow[],
  sentAt: string,
  missingBio: BioMissingRow[] = [],
): string {
  const red = members.filter((m) => m.risk === "red");
  const orange = members.filter((m) => m.risk === "orange");

  function riskLabel(risk: "orange" | "red"): string {
    return risk === "red"
      ? '<span style="color:#dc2626;font-weight:700">Off track</span>'
      : '<span style="color:#d97706;font-weight:700">Slipping</span>';
  }

  function row(m: OffTrackMemberRow): string {
    const lastSeen = m.lastActiveAt
      ? new Date(m.lastActiveAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "Never";
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${escapeHtml(m.fullName)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#718096;font-size:0.9rem">${escapeHtml(m.email)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#718096">${escapeHtml(m.campus ?? "—")}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${m.completionPct}%</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#718096">${lastSeen}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${riskLabel(m.risk)}</td>
      </tr>
    `;
  }

  return `
    <div style="${BASE_STYLES}">
      <p style="font-size:1.1rem;font-weight:600;color:#003087">
        Daily Onboarding Status Report — ${sentAt}
      </p>

      ${
        red.length > 0
          ? `<p style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;color:#991b1b">
              ⚠️ <strong>${red.length}</strong> staff member${red.length !== 1 ? "s are" : " is"} <strong>off track</strong> and need${red.length === 1 ? "s" : ""} immediate follow-up.
            </p>`
          : ""
      }
      ${
        orange.length > 0
          ? `<p style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 14px;color:#92400e">
              ⚡ <strong>${orange.length}</strong> staff member${orange.length !== 1 ? "s are" : " is"} <strong>slipping</strong> behind schedule.
            </p>`
          : ""
      }

      <table style="width:100%;border-collapse:collapse;margin-top:1rem;font-size:0.9rem">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Name</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Email</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Campus</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0">Done</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Last login</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Status</th>
          </tr>
        </thead>
        <tbody>
          ${[...red, ...orange].map(row).join("")}
        </tbody>
      </table>

      ${
        missingBio.length > 0
          ? `
        <h3 style="margin:2rem 0 0.5rem;font-size:1rem;color:#1c2840">Bio form not filled — onboarding complete</h3>
        <p style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:10px 14px;color:#1e40af;margin:0 0 0.75rem">
          📋 <strong>${missingBio.length}</strong> staff member${missingBio.length !== 1 ? "s have" : " has"} completed onboarding but not yet filled the bio data form.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
          <thead>
            <tr style="background:#f8fafc">
              <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Name</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Email</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Campus</th>
            </tr>
          </thead>
          <tbody>
            ${missingBio
              .map(
                (m) => `
              <tr>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${escapeHtml(m.fullName)}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#718096;font-size:0.9rem">${escapeHtml(m.email)}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#718096">${escapeHtml(m.campus ?? "—")}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>`
          : ""
      }

      <p style="margin-top:1.5rem">
        Please reach out to these members directly to provide support and ensure they complete
        their onboarding on time.
        <a href="${PORTAL_URL}/admin/members" style="color:#003087">View all members →</a>
      </p>
      ${FOOTER_HTML}
    </div>
  `;
}
