const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendServerError } = require('../lib/safe');

const PUBLIC_EVENT_TYPES = ['open_day', 'enrolment_window', 'term_start', 'term_end'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toIsoDate(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

async function loadPublicEvents() {
  const { rows } = await db.query(
    `SELECT se.id, se.title, se.description, se.event_type, se.start_date, se.end_date,
            se.start_time, se.location, c.name AS campus_name, c.code AS campus_code
     FROM school_events se
     LEFT JOIN campuses c ON c.id = se.campus_id
     WHERE se.is_public = TRUE
       AND se.audience IN ('marketing','all')
       AND se.event_type = ANY($1)
     ORDER BY se.start_date, se.title`,
    [PUBLIC_EVENT_TYPES]
  );
  return rows.map(row => ({
    ...row,
    start_date: toIsoDate(row.start_date),
    end_date: toIsoDate(row.end_date),
    start_time: row.start_time || null,
  }));
}

router.get('/campuses', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, code, location
       FROM campuses
       WHERE is_active = TRUE
       ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/calendar', async (_req, res) => {
  try {
    const events = await loadPublicEvents();
    res.json({
      source: 'Silverleaf Academy marketing calendar',
      filter: 'Parent-facing enrolment windows and open days only',
      events,
    });
  } catch (err) {
    return sendServerError(res, err);
  }
});

function icsDate(iso, extraDay) {
  const day = extraDay ? addUtcDays(iso, 1) : iso;
  return String(day).slice(0, 10).replace(/-/g, '');
}

function addUtcDays(iso, days) {
  const day = toIsoDate(iso);
  if (!day) throw new Error(`Invalid calendar date: ${iso}`);
  const dt = new Date(`${day}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function icsEscape(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

router.get('/calendar.ics', async (_req, res) => {
  try {
    const events = await loadPublicEvents();
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Silverleaf Academy//Marketing Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Silverleaf Academy — Enrolment & Open Days',
    ];

    for (const event of events) {
      const start = event.start_date;
      const end = event.end_date || event.start_date;
      lines.push(
        'BEGIN:VEVENT',
        `UID:marketing-event-${event.id}@silverleaf.co.tz`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(start)}`,
        `DTEND;VALUE=DATE:${icsDate(end, true)}`,
        `SUMMARY:${icsEscape(event.title)}`,
        `DESCRIPTION:${icsEscape(event.description || '')}`,
        `LOCATION:${icsEscape(event.location || event.campus_name || 'Silverleaf Academy')}`,
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="silverleaf-marketing-calendar.ics"');
    res.send(lines.join('\r\n'));
  } catch (err) {
    return sendServerError(res, err);
  }
});

module.exports = router;
module.exports.PUBLIC_EVENT_TYPES = PUBLIC_EVENT_TYPES;
