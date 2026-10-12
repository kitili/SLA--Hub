import { band, esc, fmt, type Group } from "@/lib/curriculum-feedback/analysis";
import type { Series } from "@/lib/curriculum-feedback/types";

export function groupedBars(groups: Group[], series: Series[]) {
  if (!groups.length) return '<p class="empty">No data for this selection yet.</p>';
  const nS = series.length;
  const W = Math.max(680, groups.length * (nS * 32 + 72));
  const H = 260, padL = 34, padR = 12, padT = 22, padB = 52;
  const plotH = H - padT - padB, plotW = W - padL - padR;
  const gW = plotW / groups.length, barGap = 2, innerPad = gW * 0.16;
  const bw = (gW - innerPad * 2 - barGap * (nS - 1)) / nS;
  let svg = `<svg viewBox="0 0 ${W} ${H}" style="min-width:${W}px" role="img" aria-label="Average score by group">`;
  for (let y = 0; y <= 5; y++) {
    const yy = padT + plotH - (y / 5) * plotH;
    svg += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="var(--grid)" stroke-width="1"/>`;
    svg += `<text x="${padL - 6}" y="${yy + 3.5}" text-anchor="end" font-size="10" fill="var(--muted)">${y}</text>`;
  }
  groups.forEach((g, gi) => {
    const gx = padL + gi * gW;
    svg += `<g data-value="${esc(g.name)}">`;
    series.forEach((s, si) => {
      const v = g.values[s.key];
      const x = gx + innerPad + si * (bw + barGap);
      if (v != null) {
        const h = (v / 5) * plotH, yy = padT + plotH - h;
        svg += `<rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${s.color}"><title>${esc(g.name)} — ${s.label}: ${fmt(v)} (n=${g.n})</title></rect>`;
        if (bw >= 22) svg += `<text x="${(x + bw / 2).toFixed(1)}" y="${(yy - 4).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--ink2)">${fmt(v)}</text>`;
      }
    });
    const label = g.name.length > 22 ? g.name.slice(0, 21) + "…" : g.name;
    svg += `<text x="${(gx + gW / 2).toFixed(1)}" y="${H - padB + 16}" text-anchor="middle" font-size="11.5" font-weight="600" fill="var(--ink)">${esc(label)}<title>${esc(g.name)}</title></text>`;
    svg += `<text x="${(gx + gW / 2).toFixed(1)}" y="${H - padB + 30}" text-anchor="middle" font-size="10" fill="var(--muted)">n=${g.n}</text></g>`;
  });
  svg += `<line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="var(--base)" stroke-width="1.5"/></svg>`;
  return svg;
}

export function rankedBars(items: { name: string; value: number | null; n: number }[]) {
  if (!items.length) return '<p class="empty">No data for this selection yet.</p>';
  const sorted = items.slice().sort((a, b) => (a.value == null ? 1 : b.value == null ? -1 : a.value - b.value));
  const rowH = 30, padR = 52, labelW = 176, W = 680, H = sorted.length * rowH + 16;
  const plotW = W - labelW - padR;
  const refX = labelW + (3.25 / 5) * plotW;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ranked averages">`;
  svg += `<line x1="${refX}" y1="4" x2="${refX}" y2="${H - 12}" stroke="var(--grid)" stroke-width="1" stroke-dasharray="3 3"/>`;
  svg += `<text x="${refX}" y="${H - 2}" text-anchor="middle" font-size="9" fill="var(--muted)">3.25</text>`;
  sorted.forEach((it, i) => {
    const y = 8 + i * rowH, cy = y + rowH / 2 - 4;
    const name = it.name.length > 26 ? it.name.slice(0, 25) + "…" : it.name;
    svg += `<text x="${labelW - 8}" y="${cy + 3}" text-anchor="end" font-size="11.5" fill="var(--ink)">${esc(name)}</text>`;
    if (it.value != null) {
      const w = Math.max(2, (it.value / 5) * plotW), b = band(it.value);
      svg += `<rect x="${labelW}" y="${cy - 8}" width="${w.toFixed(1)}" height="16" rx="4" fill="${b.color}"><title>${esc(it.name)}: ${fmt(it.value)} (n=${it.n}) — ${b.name}</title></rect>`;
      svg += `<text x="${labelW + w + 6}" y="${cy + 4}" font-size="11" font-weight="700" fill="var(--ink2)">${fmt(it.value)} <tspan fill="var(--muted)" font-weight="400">·n${it.n}</tspan></text>`;
    } else {
      svg += `<text x="${labelW + 4}" y="${cy + 4}" font-size="10" fill="var(--muted)">no ratings</text>`;
    }
  });
  return svg + "</svg>";
}

export function lineChart(weeks: ({ label: string } & Record<string, number | null | string | undefined>)[], series: Series[]) {
  if (weeks.length < 2) return '<p class="empty">Not enough data across time yet — this fills in as feedback arrives over several weeks.</p>';
  const W = 680, H = 240, padL = 30, padR = 14, padT = 14, padB = 40;
  const plotH = H - padT - padB, plotW = W - padL - padR, n = weeks.length, xStep = plotW / (n - 1);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend over time">`;
  for (let y = 0; y <= 5; y++) {
    const yy = padT + plotH - (y / 5) * plotH;
    svg += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="var(--grid)" stroke-width="1"/>`;
    svg += `<text x="${padL - 6}" y="${yy + 3.5}" text-anchor="end" font-size="10" fill="var(--muted)">${y}</text>`;
  }
  weeks.forEach((w, i) => {
    if (i % Math.ceil(n / 6 || 1) === 0 || i === n - 1) {
      svg += `<text x="${padL + i * xStep}" y="${H - padB + 16}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${esc(w.label)}</text>`;
    }
  });
  for (const s of series) {
    const pts: [number, number, number, string][] = [];
    weeks.forEach((w, i) => {
      const v = w[s.key];
      if (typeof v === "number") pts.push([padL + i * xStep, padT + plotH - (v / 5) * plotH, v, String(w.label)]);
    });
    if (!pts.length) continue;
    svg += `<path d="M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L")}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    for (const p of pts) svg += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.4" fill="${s.color}"><title>${s.label} — ${esc(p[3])}: ${fmt(p[2])}</title></circle>`;
  }
  return svg + `<line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="var(--base)" stroke-width="1.5"/></svg>`;
}

const APPLIED = [
  { k: "Not yet", hex: "#c3ccdb", dark: true },
  { k: "Tried it once or twice", hex: "#5fb3e8", dark: false },
  { k: "Using it regularly", hex: "#2f6bd6", dark: false },
];

export function appliedMarkup(rows: { topic: string; applied: string }[]) {
  const legend = APPLIED.map((s) => `<span><i class="sw" style="background:${s.hex}"></i>${s.k}</span>`).join("");
  const ws = rows.filter((r) => r.applied);
  if (!ws.length) return { legend, svg: '<p class="empty">No “are you using it yet?” answers for this selection yet.</p>' };
  const dist = (list: typeof ws) => {
    const d = [0, 0, 0];
    let t = 0;
    for (const r of list) {
      const i = APPLIED.findIndex((s) => s.k === r.applied);
      if (i >= 0) { d[i] = (d[i] ?? 0) + 1; t++; }
    }
    return { d, t };
  };
  const m = new Map<string, typeof ws>();
  for (const r of ws) {
    const k = r.topic || "—";
    const list = m.get(k) || [];
    list.push(r);
    m.set(k, list);
  }
  const groups = [...m.entries()].map(([name, list]) => ({ name, rows: list })).sort((a, b) => b.rows.length - a.rows.length).slice(0, 8);
  const list = [{ name: "All sessions", rows: ws, all: true }, ...groups.map((g) => ({ ...g, all: false }))];
  const rowH = 34, labelW = 140, padR = 44, W = 680, H = list.length * rowH + 12, plotW = W - labelW - padR;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Applied-it distribution by session">`;
  list.forEach((g, i) => {
    const r = dist(g.rows);
    if (!r.t) return;
    const cy = 6 + i * rowH + rowH / 2 - 2;
    svg += `<text x="${labelW - 8}" y="${cy + 4}" text-anchor="end" font-size="11.5" font-weight="${g.all ? 700 : 400}" fill="var(--ink)">${esc(g.name.length > 20 ? g.name.slice(0, 19) + "…" : g.name)}</text>`;
    let x = labelW;
    APPLIED.forEach((s, si) => {
      const count = r.d[si] ?? 0;
      const w = (count / r.t) * plotW;
      if (w <= 0) return;
      svg += `<rect x="${x.toFixed(1)}" y="${cy - 9}" width="${w.toFixed(1)}" height="18" fill="${s.hex}"><title>${esc(g.name)} — ${s.k}: ${count} of ${r.t}</title></rect>`;
      if (w >= 20) svg += `<text x="${(x + w / 2).toFixed(1)}" y="${cy + 4}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${s.dark ? "#3a4358" : "#fff"}">${count}</text>`;
      x += w;
    });
    svg += `<text x="${W - 4}" y="${cy + 4}" text-anchor="end" font-size="10" fill="var(--muted)">n=${r.t}</text>`;
  });
  return { legend, svg: svg + "</svg>" };
}
