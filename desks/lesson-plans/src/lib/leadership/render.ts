import { DASHBOARD_HTML } from "./dashboard-html";

export const LEADERSHIP_DATA_URL = "/api/leadership/data";
const LOGO_URL = "/assets/branding/brandmark-electric-blue.svg";

const EMPTY_MESSAGE =
  "No figures have been synced yet. Ask the Instructional Leadership owner to run pushToHub in the Apps Script project.";

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
            if (d && d.empty) throw new Error(${JSON.stringify(EMPTY_MESSAGE)});
            if (ok) ok(d);
          })
          .catch(function (e) { if (fail) fail(e); });
      }
    };
  }
  window.__LOGO__ = ${JSON.stringify(LOGO_URL)};
  window.google = { script: { run: runner() } };
})();
</script>
`;

/** Wording that only made sense inside Apps Script. */
const REWORDS: Array<[string, string]> = [
  ["Re-reading both trackers…", "Refreshing the latest figures…"],
  [
    ". Check that the account that deployed it can open both trackers, then press Refresh.",
    ". Press Refresh to try again.",
  ],
];

/** The dashboard page, served by /[locale]/leadership. */
export function renderLeadershipHtml(): string {
  let html = DASHBOARD_HTML;
  for (const [from, to] of REWORDS) html = html.replaceAll(from, to);
  html = html.replace(
    "<title>",
    '<meta name="robots" content="noindex, nofollow">\n<title>',
  );
  const first = html.indexOf("<script>");
  if (first < 0) throw new Error("dashboard template has no script");
  return html.slice(0, first) + SHIM + html.slice(first);
}
