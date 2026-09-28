'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PublicChrome } from '@/components/public/PublicChrome';
import { BRAND } from '@/theme';

const CLASSES = ['Daycare', 'KG1', 'KG2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'];

const fieldStyle = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #d4d4d8',
};

export default function ApplyForm() {
  const params = useSearchParams();
  const [campuses, setCampuses] = useState([]);
  const [status, setStatus] = useState({ kind: '', message: '' });
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    campus_id: '',
    parent_name: '',
    parent_phone: '',
    parent_email: '',
    whatsapp_number: '',
    child_name: '',
    child_age: '',
    interested_class: 'KG1',
    boarding_day: 'day',
    how_heard: '',
  });

  const utm = useMemo(() => ({
    utm_source: params.get('utm_source') || 'website',
    utm_medium: params.get('utm_medium') || 'organic',
    utm_campaign: params.get('utm_campaign') || '',
    campus_code: params.get('campus') || '',
  }), [params]);

  useEffect(() => {
    fetch('/api/public/campuses')
      .then((res) => res.json())
      .then((rows) => {
        setCampuses(Array.isArray(rows) ? rows : []);
        const fromCode = rows.find((c) => c.code === utm.campus_code);
        if (fromCode) setForm((f) => ({ ...f, campus_id: String(fromCode.id) }));
      })
      .catch(() => setStatus({ kind: 'error', message: 'Could not load campuses.' }));
  }, [utm.campus_code]);

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setStatus({ kind: '', message: '' });
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          child_age: form.child_age ? Number(form.child_age) : null,
          campaign_slug: utm.utm_campaign,
          utm_source: utm.utm_source,
          utm_medium: utm.utm_medium,
          utm_campaign: utm.utm_campaign,
          landing_page: typeof window !== 'undefined' ? window.location.href : '/apply',
          source_detail: 'Public apply form',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send enquiry.');
      setStatus({
        kind: 'ok',
        message: data.existing
          ? 'We already have this enquiry. Our team will follow up on the number you used.'
          : 'Thank you. A Silverleaf team member will contact you shortly.',
      });
    } catch (err) {
      setStatus({ kind: 'error', message: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <PublicChrome>
      <h1 style={{ fontSize: 28, color: BRAND.electricBlue, marginBottom: 8 }}>Enquire about a place</h1>
      <p style={{ color: BRAND.silver, marginBottom: 20 }}>
        This starts an inquiry with marketing. The official admission application is sent after the campus interview.
      </p>
      <form onSubmit={submit} style={{ background: BRAND.white, padding: 20, borderRadius: 12, display: 'grid', gap: 12 }}>
        <label>
          Campus
          <select required value={form.campus_id} onChange={(e) => setForm((f) => ({ ...f, campus_id: e.target.value }))} style={fieldStyle}>
            <option value="">Select a campus</option>
            {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          Parent name
          <input required value={form.parent_name} onChange={(e) => setForm((f) => ({ ...f, parent_name: e.target.value }))} style={fieldStyle} />
        </label>
        <label>
          Phone
          <input required value={form.parent_phone} onChange={(e) => setForm((f) => ({ ...f, parent_phone: e.target.value }))} placeholder="07XX XXX XXX" style={fieldStyle} />
        </label>
        <label>
          Email
          <input type="email" value={form.parent_email} onChange={(e) => setForm((f) => ({ ...f, parent_email: e.target.value }))} style={fieldStyle} />
        </label>
        <label>
          WhatsApp
          <input value={form.whatsapp_number} onChange={(e) => setForm((f) => ({ ...f, whatsapp_number: e.target.value }))} style={fieldStyle} />
        </label>
        <label>
          Child name
          <input value={form.child_name} onChange={(e) => setForm((f) => ({ ...f, child_name: e.target.value }))} style={fieldStyle} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>
            Age
            <input type="number" min="1" max="16" value={form.child_age} onChange={(e) => setForm((f) => ({ ...f, child_age: e.target.value }))} style={fieldStyle} />
          </label>
          <label>
            Class
            <select value={form.interested_class} onChange={(e) => setForm((f) => ({ ...f, interested_class: e.target.value }))} style={fieldStyle}>
              {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label>
          Day or boarding
          <select value={form.boarding_day} onChange={(e) => setForm((f) => ({ ...f, boarding_day: e.target.value }))} style={fieldStyle}>
            <option value="day">Day scholar</option>
            <option value="boarding">Boarding</option>
          </select>
        </label>
        <label>
          How did you hear about us?
          <input value={form.how_heard} onChange={(e) => setForm((f) => ({ ...f, how_heard: e.target.value }))} style={fieldStyle} />
        </label>
        {status.message && (
          <p style={{ color: status.kind === 'ok' ? '#1f7a3a' : '#b42318' }}>{status.message}</p>
        )}
        <button type="submit" disabled={sending} style={{
          background: BRAND.electricBlue, color: BRAND.white, border: 'none', borderRadius: 8,
          padding: '12px 16px', fontWeight: 700, cursor: 'pointer',
        }}>
          {sending ? 'Sending…' : 'Send enquiry'}
        </button>
      </form>
    </PublicChrome>
  );
}
