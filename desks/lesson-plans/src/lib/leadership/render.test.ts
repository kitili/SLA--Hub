import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DASHBOARD_HTML } from "./dashboard-html";
import { LEADERSHIP_DATA_URL, renderLeadershipHtml } from "./render";

describe("leadership page", () => {
  const html = renderLeadershipHtml();

  it("serves exactly the Index.html in the integration folder (run build-template.mjs if this fails)", () => {
    const source = readFileSync(
      path.join(process.cwd(), "integrations/instructional-leadership/Index.html"),
      "utf8",
    );
    expect(DASHBOARD_HTML).toBe(source);
  });

  it("defines the google.script.run stand-in before the dashboard script runs", () => {
    const shim = html.indexOf("window.google = {");
    const dashboard = html.indexOf("var DATA = null, M = null;");
    expect(shim).toBeGreaterThan(0);
    expect(dashboard).toBeGreaterThan(shim);
    expect(html).toContain(LEADERSHIP_DATA_URL);
    expect(html).toContain("window.__LOGO__");
  });

  it("is noindex and drops the Apps Script-only wording", () => {
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).not.toContain("Re-reading both trackers");
    expect(html).not.toContain("account that deployed it");
  });

  it("loads no remote script and builds no HTML from data (CSP script-src 'self')", () => {
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toContain("innerHTML");
    expect(html).not.toContain("eval(");
  });
});
