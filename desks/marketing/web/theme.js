'use client';

// Silverleaf Academy brand palette — use these everywhere for structural/brand UI
// (sidebar, buttons, headers, links, cards). Status colors (critical/warning/resolved/
// emergency badges, alerts, charts) intentionally keep conventional red/green/amber —
// see components/shared/UI.jsx Badge component.
export const BRAND = {
  electricBlue: '#002368',
  lightBlue:    '#80BFEC',
  silver:       '#818283',
  gold:         '#FFC952',
  white:        '#FFFFFF',
  black:        '#000000',
};

// Per-module accent color, drawn from the brand palette (no green/red available).
export const MODULE_COLOR = {
  marketing:  BRAND.gold,
  ceo:        BRAND.gold,
  se:         BRAND.lightBlue,
  dispensary: BRAND.silver,
};
