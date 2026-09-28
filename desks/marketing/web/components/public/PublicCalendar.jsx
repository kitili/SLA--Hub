'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BRAND } from '@/theme';

const TYPE_LABEL = {
  enrolment_window: 'Enrolment',
  open_day: 'Open day',
  term_start: 'Term start',
  term_end: 'Term end',
};

function formatRange(event) {
  const start = event.start_date;
  const end = event.end_date && event.end_date !== event.start_date ? event.end_date : null;
  const pretty = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  return end ? `${pretty(start)} – ${pretty(end)}` : pretty(start);
}

export default function PublicCalendar({ embed = false }) {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/public/calendar')
      .then((res) => {
        if (!res.ok) throw new Error('Calendar is unavailable.');
        return res.json();
      })
      .then((data) => setEvents(data.events || []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: embed ? 22 : 28, marginBottom: 8, color: BRAND.electricBlue }}>
        Enrolment calendar
      </h1>
      <p style={{ color: BRAND.silver, marginBottom: 20, fontSize: 14 }}>
        Parent-facing dates only — enrolment windows and open days. Exams and internal school days stay off this feed.
      </p>
      {error && <p style={{ color: '#b42318' }}>{error}</p>}
      {!error && events.length === 0 && (
        <p style={{ color: BRAND.silver }}>No public marketing dates have been published yet.</p>
      )}
      <div style={{ display: 'grid', gap: 12 }}>
        {events.map((event) => (
          <article
            key={event.id}
            style={{
              background: BRAND.white,
              border: `1px solid ${BRAND.silver}33`,
              borderRadius: 10,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: BRAND.electricBlue, textTransform: 'uppercase' }}>
              {TYPE_LABEL[event.event_type] || event.event_type}
            </div>
            <h2 style={{ fontSize: 18, margin: '6px 0 4px' }}>{event.title}</h2>
            <div style={{ fontSize: 13, color: BRAND.silver }}>{formatRange(event)}</div>
            {event.location && (
              <div style={{ fontSize: 13, color: BRAND.silver, marginTop: 2 }}>{event.location}</div>
            )}
            {event.description && (
              <p style={{ fontSize: 14, marginTop: 8 }}>{event.description}</p>
            )}
          </article>
        ))}
      </div>
      <div style={{ marginTop: 20, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 14 }}>
        <Link href="/apply" style={{ color: BRAND.electricBlue, fontWeight: 600 }}>Enquire or apply</Link>
        <a href="/api/public/calendar.ics" style={{ color: BRAND.electricBlue }}>Subscribe (ICS)</a>
      </div>
    </div>
  );
}
