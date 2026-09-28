'use client';

import { BRAND } from '@/theme';

/** Live pipeline stages (reached this stage or later, top → bottom). */
export const SHEET_FUNNEL_STEPS = [
  { key: 'total_leads', label: 'Total Leads', color: BRAND.electricBlue },
  { key: 'interested', label: 'Interested', color: '#3498db' },
  { key: 'tour_booked', label: 'Tour Booked', color: '#f39c12' },
  { key: 'interview_booked', label: 'Interview', color: '#16a085' },
  { key: 'registered', label: 'Registered', color: '#8e44ad' },
  { key: 'admission_paid', label: 'Admission Paid', color: BRAND.gold },
];

function n(live, key) {
  return parseInt(live?.[key] || 0, 10) || 0;
}

/** Occupancy → “reached this stage or later” so the chart tapers like a funnel. */
export function cumulativeFunnelCounts(live = {}) {
  const paid = n(live, 'admission_paid');
  const enrolled = n(live, 'enrolled');
  const registered = n(live, 'registered');
  const interview = n(live, 'interview_booked');
  const tour = n(live, 'tour_booked');
  const interested = n(live, 'interested');
  const reachedRegistered = registered + enrolled + paid;
  const reachedInterview = interview + reachedRegistered;
  const reachedTour = tour + reachedInterview;
  const reachedInterested = interested + reachedTour;
  return {
    total_leads: n(live, 'total_leads') || reachedInterested + n(live, 'dead_leads'),
    interested: reachedInterested,
    tour_booked: reachedTour,
    interview_booked: reachedInterview,
    registered: reachedRegistered,
    admission_paid: paid,
  };
}

export function buildLiveFunnelSteps(live = {}) {
  const counts = cumulativeFunnelCounts(live);
  return SHEET_FUNNEL_STEPS.map(step => ({
    ...step,
    value: counts[step.key] || 0,
  }));
}

export function formatTrendTick(value, period) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  if (period === 'yearly') return String(d.getUTCFullYear());
  if (period === 'monthly') {
    return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

export function buildSheetFunnelSteps(cluster = {}) {
  const map = {
    total_leads: cluster.total_leads,
    interested: cluster.interested_leads,
    tour_booked: cluster.tour_booked,
    interview_booked: (cluster.passed_interview || 0) + (cluster.failed_interview || 0) || cluster.interview_booked,
    registered: cluster.registered_form_filled,
    admission_paid: cluster.enrolled_admission_paid,
  };
  return SHEET_FUNNEL_STEPS.map(step => ({
    ...step,
    value: map[step.key] == null ? null : parseInt(map[step.key] || 0, 10),
  }));
}

export function funnelWidthPct(value, max) {
  if (!max) return 28;
  return Math.max(22, Math.min(100, Math.round((value / max) * 100)));
}

export function formatVariance(n) {
  if (!n) return '±0';
  return n > 0 ? `+${n}` : `${n}`;
}

export function mergeCampusRows(liveCampuses = [], sheetCampuses = {}) {
  return liveCampuses.map(row => {
    const sheet = sheetCampuses[row.code] || {};
    return {
      code: row.code,
      name: row.name,
      live: row,
      sheet,
      target: sheet.target_enrollment || null,
    };
  });
}
