/**
 * Render docs/ARCHITECTURE.md to Word + PDF with diagrams as images
 * (WhatsApp / Slack will show the figures, unlike raw Markdown).
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcMd = path.join(root, "docs", "ARCHITECTURE.md");
const buildDir = path.join(root, "docs", ".report-build");
const outDocx = path.join(root, "docs", "Silverleaf-Uniform-Tracker-Planning-Report.docx");
const outPdf = path.join(root, "docs", "Silverleaf-Uniform-Tracker-Planning-Report.pdf");
const chrome = process.env.CHROME_PATH || "/usr/bin/google-chrome";

function splitMarkdown(md) {
  const parts = [];
  const re = /```mermaid\n([\s\S]*?)```/g;
  let last = 0;
  let m;
  let n = 0;
  while ((m = re.exec(md)) !== null) {
    if (m.index > last) parts.push({ type: "md", text: md.slice(last, m.index) });
    n += 1;
    parts.push({ type: "mermaid", text: m[1].trim(), index: n });
    last = m.index + m[0].length;
  }
  if (last < md.length) parts.push({ type: "md", text: md.slice(last) });
  return parts;
}

function diagramKind(def) {
  const first = def.split("\n").find((l) => l.trim() && !l.trim().startsWith("%%")) || "";
  if (first.includes("erDiagram")) return "er";
  if (first.includes("sequenceDiagram")) return "seq";
  if (first.includes("stateDiagram")) return "state";
  if (first.includes("gantt")) return "gantt";
  if (first.includes("flowchart LR") || first.includes("flowchart RL")) return "flow-h";
  return "flow-v";
}

function viewportFor(kind) {
  const map = {
    er: { width: 2200, height: 1400 },
    seq: { width: 1400, height: 1100 },
    state: { width: 1100, height: 900 },
    gantt: { width: 1600, height: 700 },
    "flow-h": { width: 1800, height: 1000 },
    "flow-v": { width: 1200, height: 1400 },
  };
  return map[kind] || map["flow-v"];
}

async function renderDiagrams(parts) {
  const puppeteer = (await import("puppeteer-core")).default;
  const mermaidPath = path.join(root, "node_modules", "mermaid", "dist", "mermaid.min.js");
  const mermaidJs = await readFile(mermaidPath, "utf8");

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setContent(`<!DOCTYPE html><html><head><style>
    html,body{margin:0;padding:16px;background:#fff;font-family:Segoe UI,Calibri,Arial,sans-serif;}
    #stage{display:inline-block;background:#fff;}
  </style></head><body><div id="stage"></div>
  <script>${mermaidJs}</script></body></html>`, { waitUntil: "load" });

  await page.evaluate(() => {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      securityLevel: "loose",
      fontFamily: "Segoe UI, Calibri, Arial, sans-serif",
      themeVariables: {
        primaryColor: "#dbeafe",
        primaryTextColor: "#0f172a",
        primaryBorderColor: "#1e3a5f",
        lineColor: "#334155",
        secondaryColor: "#fef3c7",
        tertiaryColor: "#f1f5f9",
        background: "#ffffff",
        clusterBkg: "#f8fafc",
        clusterBorder: "#64748b",
        titleColor: "#0f172a",
        nodeTextColor: "#0f172a",
        fontSize: "16px",
      },
      flowchart: { useMaxWidth: false, htmlLabels: true, padding: 12, curve: "basis" },
      er: { useMaxWidth: false },
      sequence: { useMaxWidth: false },
      gantt: { useMaxWidth: false, fontSize: 14 },
    });
  });

  const files = [];
  for (const part of parts) {
    if (part.type !== "mermaid") continue;
    const kind = diagramKind(part.text);
    const vp = viewportFor(kind);
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });

    let svg;
    try {
      svg = await page.evaluate(async (def, id) => {
        const { svg } = await window.mermaid.render(id, def);
        return svg;
      }, part.text, `fig${part.index}`);
    } catch (err) {
      console.error(`Diagram ${part.index} failed:`, err.message);
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="120">
        <rect width="800" height="120" fill="#fef2f2" stroke="#991b1b"/>
        <text x="20" y="70" fill="#991b1b" font-size="18">Diagram ${part.index} could not render</text>
      </svg>`;
    }

    await page.evaluate((s) => {
      document.getElementById("stage").innerHTML = s;
      const svgEl = document.querySelector("#stage svg");
      if (svgEl) {
        svgEl.style.maxWidth = "none";
        svgEl.style.height = "auto";
      }
    }, svg);

    const el = await page.$("#stage");
    const box = await el.boundingBox();
    if (box) {
      await page.setViewport({
        width: Math.max(400, Math.ceil(box.width) + 40),
        height: Math.max(200, Math.ceil(box.height) + 40),
        deviceScaleFactor: 2,
      });
    }
    const png = path.join(buildDir, `figure-${String(part.index).padStart(2, "0")}.png`);
    await el.screenshot({ path: png, type: "png", omitBackground: false });
    files.push(png);
    process.stdout.write(`  rendered figure ${part.index}\n`);
  }

  await browser.close();
  return files;
}

async function writePdf(htmlPath) {
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle0", timeout: 120000 });
  await page.pdf({
    path: outPdf,
    format: "A4",
    printBackground: true,
    margin: { top: "16mm", bottom: "18mm", left: "14mm", right: "14mm" },
    displayHeaderFooter: true,
    headerTemplate: `<div></div>`,
    footerTemplate: `<div style="font-size:9px;color:#64748b;width:100%;text-align:center;font-family:Segoe UI,sans-serif;">
      Silverleaf Uniform Tracker — Planning Report · <span class="pageNumber"></span> / <span class="totalPages"></span>
    </div>`,
  });
  await browser.close();
}

async function main() {
  await rm(buildDir, { recursive: true, force: true });
  await mkdir(buildDir, { recursive: true });

  let md = await readFile(srcMd, "utf8");
  md = md.replace(
    "This is the submit-ready report. All diagrams are in this file. Preview or print from GitHub, Cursor, or any mermaid-capable markdown viewer so the figures render.",
    "This report includes the architecture diagrams as pictures so they display when the file is opened on WhatsApp, Slack, or Word.",
  );

  const parts = splitMarkdown(md);
  const mermaidCount = parts.filter((p) => p.type === "mermaid").length;
  console.log(`Rendering ${mermaidCount} diagrams…`);
  await renderDiagrams(parts);

  const { default: MarkdownIt } = await import("markdown-it");
  const mdit = new MarkdownIt({ html: true, linkify: false, typographer: true });

  let exportMd = "";
  let htmlBody = "";
  for (const part of parts) {
    if (part.type === "md") {
      exportMd += part.text;
      htmlBody += mdit.render(part.text);
    } else {
      const rel = `figure-${String(part.index).padStart(2, "0")}.png`;
      const abs = path.join(buildDir, rel);
      exportMd += `\n\n![Figure ${part.index}](${abs})\n\n`;
      htmlBody += `<figure class="diagram"><img src="${pathToFileURL(abs).href}" alt="Figure ${part.index}" /><figcaption>Figure ${part.index}</figcaption></figure>`;
    }
  }

  const exportMdPath = path.join(buildDir, "report.export.md");
  await writeFile(exportMdPath, exportMd, "utf8");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Silverleaf Uniform Tracker — Planning &amp; Design Report</title>
<style>
  @page { size: A4; margin: 16mm 14mm 18mm 14mm; }
  body { font-family: "Segoe UI", Calibri, Arial, sans-serif; color: #0f172a; font-size: 12.5px; line-height: 1.45; }
  h1 { color: #0b3d5c; font-size: 26px; border-bottom: 3px solid #0b3d5c; padding-bottom: 8px; }
  h2 { color: #0b3d5c; font-size: 18px; margin-top: 28px; page-break-before: auto; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
  h3 { color: #1e3a5f; font-size: 14px; margin-top: 18px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 11px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
  th { background: #0b3d5c; color: #fff; text-align: left; }
  tr:nth-child(even) td { background: #f8fafc; }
  code { font-family: ui-monospace, Consolas, monospace; font-size: 11px; background: #f1f5f9; padding: 1px 4px; }
  pre { background: #f1f5f9; padding: 10px 12px; overflow: auto; font-size: 11px; }
  figure.diagram { margin: 16px 0; text-align: center; page-break-inside: avoid; }
  figure.diagram img { max-width: 100%; height: auto; border: 1px solid #e2e8f0; }
  figcaption { font-size: 11px; color: #475569; margin-top: 6px; }
  hr { border: none; border-top: 1px solid #cbd5e1; margin: 20px 0; }
  ul, ol { padding-left: 1.2rem; }
</style>
</head>
<body>
${htmlBody}
</body>
</html>`;
  const htmlPath = path.join(buildDir, "report.html");
  await writeFile(htmlPath, html, "utf8");

  console.log("Writing PDF…");
  await writePdf(htmlPath);

  console.log("Writing Word document…");
  await new Promise((resolve, reject) => {
    const py = spawn("python3", [path.join(root, "scripts", "md-images-to-docx.py"), exportMdPath, outDocx], {
      stdio: "inherit",
    });
    py.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`python exited ${code}`))));
  });

  console.log(`Wrote\n  ${outDocx}\n  ${outPdf}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
