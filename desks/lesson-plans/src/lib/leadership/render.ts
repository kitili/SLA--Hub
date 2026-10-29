import { DASHBOARD_HTML } from "./dashboard-html";

export const LEADERSHIP_DATA_URL = "/api/leadership/data";
const LOGO_URL = "/assets/branding/brandmark-electric-blue.svg";

const EMPTY_MESSAGE =
  "No figures yet. The walkthrough and observation figures have not been sent from the Google trackers. An Academics admin needs to run the first push from the Apps Script project (steps in docs/instructional-leadership.md). Then press Refresh.";

/**
 * Stands in for Google's `google.script.run`, which the page was written
 * against. `getDashboardData` reads the stored snapshot over the hub's own
 * admin-only endpoint; nothing is read from Google in the browser.
 */
const SHIM = `<script>
(function () {
  'use strict';
  function runner(ok, fail) {
    return {
      withSuccessHandler: function (f) { return runner(f, fail); },
      withFailureHandler: function (f) { return runner(ok, f); },
      getDashboardData: function (force) {
        fetch(${JSON.stringify(LEADERSHIP_DATA_URL)} + (force ? '?refresh=1' : ''), { credentials: 'same-origin', cache: 'no-store' })
          .then(function (r) {
            if (r.status === 401 || r.status === 403) throw new Error('Sign in with an Academics admin account to see this dashboard');
            if (!r.ok) throw new Error('The dashboard data could not be read (' + r.status + ')');
            return r.json();
          })
          .then(function (d) {
            if (d && d.empty) { var empty = new Error(${JSON.stringify(EMPTY_MESSAGE)}); empty.empty = true; throw empty; }
            if (ok) ok(d);
          })
          .catch(function (e) { if (fail) fail(e); });
      }
    };
  }
  // Status line the dashboard shows when it has nothing to draw. An empty
  // database is waiting for its first push, not a failure.
  window.__ildStatusText = function (err) {
    if (err && err.empty) return err.message;
    return 'The dashboard could not load: ' + (err && err.message ? err.message : err) + '. Press Refresh to try again.';
  };
  window.__LOGO__ = ${JSON.stringify(LOGO_URL)};
  window.google = { script: { run: runner() } };
})();
</script>
`;

/** Wording that only made sense inside Apps Script. */
const REWORDS: Array<[string, string]> = [
  ["Re-reading both trackers…", "Refreshing the latest figures…"],
  [
    "'The dashboard could not load: ' + (err && err.message ? err.message : err) + '. Check that the account that deployed it can open both trackers, then press Refresh.'",
    "window.__ildStatusText(err)",
  ],
];

/** The dashboard page, served by /[locale]/leadership. */
export function renderLeadershipHtml(): string {
  let html = DASHBOARD_HTML;
  for (const [from, to] of REWORDS) {
    if (!html.includes(from)) throw new Error(`dashboard template changed: cannot find "${from.slice(0, 40)}"`);
    html = html.replaceAll(from, to);
  }
  html = html.replace(
    "<title>",
    '<meta name="robots" content="noindex, nofollow">\n<title>',
  );
  const first = html.indexOf("<script>");
  if (first < 0) throw new Error("dashboard template has no script");
  return html.slice(0, first) + SHIM + html.slice(first);
}
