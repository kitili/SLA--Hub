'use client';

// Marketing Analytics, Calendar, Team, Reports, Profile

import { useEffect, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';
import Layout from '@/components/shared/Layout';
import { Section, PageHeader, PeriodToggle, Spinner, Modal, Field, Input, Select, Btn, Table, Badge, ExportMenu } from '@/components/shared/UI';
import ProfileBase from '@/components/shared/ProfileBase';
import EnrollmentFunnel from '@/components/marketing/EnrollmentFunnel';
import BufferSocialKpi from '@/components/marketing/BufferSocialKpi';
import toast from 'react-hot-toast';
import { BRAND } from '@/theme';
import { formatTrendTick, mergeCampusRows } from '@/lib/marketingFunnel';
import { useCampusFilterStore, campusSearchParams } from '@/lib/campusFilter';
import WorkbookOps from '@/components/marketing/WorkbookOps';
// Loaded on demand (not statically) — jsPDF/xlsx/docx are ~1MB combined, and most
// visits to this page never click Export.

// ── ANALYTICS ─────────────────────────────────────────────────
export function Analytics() {
  const [data, setData]     = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const campusId = useCampusFilterStore((s) => s.campusId);
  const campuses = useCampusFilterStore((s) => s.campuses);
  const setCampusId = useCampusFilterStore((s) => s.setCampusId);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get(`/marketing/analytics${campusSearchParams(campusId, { period })}`),
      api.get(`/marketing/master-snapshot${campusSearchParams(campusId)}`),
    ]).then(([a, s]) => {
      if (cancelled) return;
      setData(a.data);
      setSnapshot(s.data || null);
    }).catch(() => {
      if (!cancelled) toast.error('Failed to load analytics.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [period, campusId]);

  if (loading) return <Layout module="marketing"><Spinner /></Layout>;

  const live = snapshot?.live || {};
  const sheet = snapshot?.snapshot?.cluster || {};
  const ops = snapshot?.ops || null;
  const campusRows = mergeCampusRows(live.campus_funnel || [], snapshot?.snapshot?.campus_funnel || {});
  const sources = (data?.sources || []).map((row) => ({
    ...row,
    source: String(row.source || 'other').replace(/_/g, ' '),
    count: Number(row.count || 0),
    conversions: Number(row.conversions || 0),
  }));
  const trend = (data?.trend || []).map((row) => ({
    ...row,
    leads: Number(row.leads || 0),
    paid: Number(row.paid || 0),
  }));
  const selectedCampus = campuses.find((c) => String(c.id) === String(campusId));

  return (
    <Layout module="marketing">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: BRAND.black }}>Analytics & Insights</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: BRAND.silver }}>
            {selectedCampus ? `${selectedCampus.name} · ` : ''}Live funnel, campus split, and {period} trend
          </p>
        </div>
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          ['Active leads', live.active_leads || live.total_leads || 0],
          ['Admission paid', live.admission_paid || 0],
          ['Conversion', `${live.conversion_rate || 0}%`],
          ['Dead leads', live.dead_leads || 0],
        ].map(([label, value]) => (
          <div key={label} style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, color: BRAND.silver, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: BRAND.black, marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 16 }}>
        <Section title="Live enrollment funnel">
          <EnrollmentFunnel live={live} sheetCluster={sheet} showCompare={!campusId} />
        </Section>
        <Section title="Buffer social">
          <BufferSocialKpi
            bufferKpi={live.buffer_kpi}
            socialTargets={snapshot?.snapshot?.social_following?.filter((r) => r.month === 2 && r.year === 2026) || []}
            socialOutput={snapshot?.snapshot?.social_output?.filter((r) => r.month === 2) || []}
          />
        </Section>
      </div>

      {campusRows.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Section title="Campus funnel" action={<span style={{ fontSize: 11, color: BRAND.silver }}>Click a campus to filter</span>}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: `${BRAND.silver}14`, textAlign: 'left' }}>
                    {['Campus', 'Leads', 'Interested', 'Paid', 'Dead', 'Passed int.', 'Target'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', fontWeight: 700, color: BRAND.silver }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campusRows.map((row) => {
                    const match = campuses.find((c) => c.code === row.code);
                    const active = match && String(match.id) === String(campusId);
                    return (
                      <tr
                        key={row.code}
                        onClick={() => {
                          if (!match) return;
                          setCampusId(active ? '' : String(match.id));
                        }}
                        style={{
                          borderBottom: `1px solid ${BRAND.silver}22`,
                          cursor: 'pointer',
                          background: active ? `${BRAND.electricBlue}10` : 'transparent',
                        }}
                      >
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: BRAND.electricBlue }}>{row.code} · {row.name}</td>
                        <td style={{ padding: '10px 12px' }}>{row.live.total_leads || 0}</td>
                        <td style={{ padding: '10px 12px' }}>{row.live.interested || 0}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: BRAND.gold }}>{row.live.admission_paid || 0}</td>
                        <td style={{ padding: '10px 12px' }}>{row.live.dead_leads || 0}</td>
                        <td style={{ padding: '10px 12px' }}>{row.live.passed_interview || 0}</td>
                        <td style={{ padding: '10px 12px' }}>{row.target ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Section title={`Lead sources (${period})`}>
          {sources.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={sources} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${BRAND.silver}26`}/>
                <XAxis dataKey="source" tick={{ fontSize: 10 }}/>
                <YAxis tick={{ fontSize: 11 }}/>
                <Tooltip/>
                <Legend/>
                <Bar dataKey="count" name="Leads" fill={BRAND.electricBlue} radius={[3,3,0,0]}/>
                <Bar dataKey="conversions" name="Paid" fill={BRAND.gold} radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ fontSize: 13, color: BRAND.silver, padding: 24 }}>No leads created in this period.</div>
          )}
        </Section>

        <Section title={`Trend (${period})`}>
          {trend.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${BRAND.silver}26`}/>
                <XAxis dataKey="period" tick={{ fontSize: 11 }} minTickGap={28} interval="preserveStartEnd" tickFormatter={(v) => formatTrendTick(v, period)}/>
                <YAxis tick={{ fontSize: 11 }}/>
                <Tooltip labelFormatter={(v) => formatTrendTick(v, period)}/>
                <Legend/>
                <Line type="monotone" dataKey="leads" stroke={BRAND.electricBlue} name="New leads" strokeWidth={2} dot={false}/>
                <Line type="monotone" dataKey="paid" stroke={BRAND.gold} name="Of which paid" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ fontSize: 13, color: BRAND.silver, padding: 24 }}>No trend points in this period.</div>
          )}
        </Section>
      </div>

      {ops && <WorkbookOps ops={ops} />}
    </Layout>
  );
}

// ── CALENDAR ──────────────────────────────────────────────────
export function MarketingCalendar() {
  const [events, setEvents]   = useState([]);
  const [month, setMonth]     = useState(new Date());
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm]       = useState({ title:'', event_type:'open_day', start_date:'', end_date:'', location:'', is_public:true });
  const campusId = useCampusFilterStore((s) => s.campusId);

  useEffect(() => {
    api.get(`/marketing/events${campusSearchParams(campusId)}`).then(r => {
      const ev = r.data || [];
      setEvents(ev);
      const today = new Date();
      const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const hasThisMonth = ev.some(e => (e.start_date || '').slice(0, 7) === ym);
      if (!hasThisMonth) {
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const next = ev.find(e => (e.start_date || '').slice(0, 10) >= todayStr);
        if (next?.start_date) setMonth(new Date(`${next.start_date.slice(0, 10)}T12:00:00`));
      }
    }).catch(() => {});
  }, [campusId]);

  async function save(e) {
    e.preventDefault();
    try { await api.post('/marketing/events', form); toast.success('Event added.'); setAddOpen(false); setEvents([]); api.get(`/marketing/events${campusSearchParams(campusId)}`).then(r => setEvents(r.data)); }
    catch { toast.error('Failed to save.'); }
  }

  const year = month.getFullYear(), mo = month.getMonth();
  const firstDay = new Date(year, mo, 1).getDay();
  const daysInMonth = new Date(year, mo + 1, 0).getDate();
  const monthName = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const EVENT_COLORS = { open_day: BRAND.electricBlue, enrolment_window: BRAND.gold, term_start: BRAND.gold, term_end: BRAND.lightBlue, sports_day: BRAND.silver, cultural_day: BRAND.electricBlue, other: BRAND.gold };

  function getEventsForDay(d) {
    const dateStr = `${year}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return events.filter(e => {
      const start = e.start_date?.slice(0,10);
      const end = (e.end_date || e.start_date)?.slice(0,10);
      return start && dateStr >= start && dateStr <= end;
    });
  }

  return (
    <Layout module="marketing">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: BRAND.black }}>Marketing calendar</h1>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setMonth(new Date(year, mo-1, 1))} style={{ background: `${BRAND.silver}14`, border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}><ChevronLeft size={16}/></button>
            <span style={{ fontSize: 14, fontWeight: 600, minWidth: 140, textAlign: 'center' }}>{monthName}</span>
            <button onClick={() => setMonth(new Date(year, mo+1, 1))} style={{ background: `${BRAND.silver}14`, border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}><ChevronRight size={16}/></button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/calendar" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: BRAND.electricBlue, alignSelf: 'center' }}>Website calendar</a>
          <Btn onClick={() => setAddOpen(true)}><Plus size={15}/>Add Event</Btn>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: `${BRAND.silver}0D`, borderBottom: `1px solid ${BRAND.silver}40` }}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} style={{ padding: '10px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: BRAND.silver }}>{d}</div>
          ))}
        </div>
        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {Array.from({ length: firstDay }).map((_,i) => <div key={`e${i}`} style={{ minHeight: 100, borderBottom: `1px solid ${BRAND.silver}26`, borderRight: `1px solid ${BRAND.silver}26`, background: `${BRAND.silver}0D` }}/>)}
          {Array.from({ length: daysInMonth }).map((_,i) => {
            const d = i+1;
            const dayEvents = getEventsForDay(d);
            const isToday = new Date().getDate() === d && new Date().getMonth() === mo && new Date().getFullYear() === year;
            return (
              <div key={d} style={{ minHeight: 100, padding: 6, borderBottom: `1px solid ${BRAND.silver}26`, borderRight: `1px solid ${BRAND.silver}26`, background: isToday ? `${BRAND.lightBlue}26` : 'white' }}>
                <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, marginBottom: 4,
                  width: 24, height: 24, borderRadius: '50%', background: isToday ? BRAND.electricBlue : 'transparent',
                  color: isToday ? 'white' : BRAND.black, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</div>
                {dayEvents.map(ev => (
                  <div key={ev.id} title={ev.title} style={{ fontSize: 10, padding: '2px 5px', borderRadius: 3, marginBottom: 2, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: (EVENT_COLORS[ev.event_type] || BRAND.silver) + '20', color: EVENT_COLORS[ev.event_type] || BRAND.silver }}>
                    {ev.is_public ? '● ' : ''}{ev.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {(() => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const upcoming = events
          .filter(e => (e.start_date || '').slice(0, 10) >= todayStr)
          .slice(0, 8);
        if (!upcoming.length) return null;
        return (
          <div style={{ marginTop: 20, background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.black, marginBottom: 10 }}>Upcoming marketing events</div>
            {upcoming.map(ev => (
              <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: `1px solid ${BRAND.silver}22`, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{ev.title}</span>
                <span style={{ color: BRAND.silver, whiteSpace: 'nowrap' }}>
                  {ev.start_date?.slice(0, 10)} · {ev.event_type?.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        );
      })()}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add School Event">
        <form onSubmit={save}>
          <Field label="Event Title" required><Input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} required /></Field>
          <Field label="Event Type">
            <Select value={form.event_type} onChange={e => setForm(f=>({...f,event_type:e.target.value}))}>
              {['enrolment_window','open_day','term_start','term_end'].map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
            </Select>
          </Field>
          <Field label="Start date" required><Input type="date" value={form.start_date} onChange={e => setForm(f=>({...f,start_date:e.target.value}))} required /></Field>
          <Field label="End date"><Input type="date" value={form.end_date} onChange={e => setForm(f=>({...f,end_date:e.target.value}))} /></Field>
          <Field label="Location"><Input value={form.location} onChange={e => setForm(f=>({...f,location:e.target.value}))} /></Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '8px 0' }}>
            <input type="checkbox" checked={!!form.is_public} onChange={e => setForm(f=>({...f,is_public:e.target.checked}))} />
            Show on the public website calendar
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
            <Btn type="submit">Add Event</Btn>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}

export { default as Team } from '@/components/pages/marketing/Team';

// ── REPORTS ───────────────────────────────────────────────────
export function Reports() {
  const [period, setPeriod] = useState('monthly');
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const campusId = useCampusFilterStore((s) => s.campusId);

  async function generate() {
    setLoading(true);
    try {
      const r = await api.get(`/marketing/reports/premium${campusSearchParams(campusId, { period })}`);
      setData(r.data);
    } catch { toast.error('Failed to load report.'); }
    finally { setLoading(false); }
  }

  function buildSections() {
    if (!data) return [];
    const live = data.live || {};
    const sheet = data.snapshot?.cluster || {};
    const campusRows = mergeCampusRows(live.campus_funnel || [], data.snapshot?.campus_funnel || {});

    return [
      {
        title: `Executive Summary — ${period}`,
        stats: [
          { label: 'Total leads (live)', value: live.total_leads },
          { label: 'Admission paid (live)', value: live.admission_paid },
          { label: 'Conversion rate', value: `${live.conversion_rate || 0}%` },
          { label: 'Dead leads', value: live.dead_leads },
          { label: '2026 target progress', value: `${data.enrollment?.progress_pct || 0}%` },
          { label: 'Passed interviews', value: live.passed_interview },
          { label: 'Failed interviews', value: live.failed_interview },
          { label: 'Registered', value: live.registered },
        ],
      },
      {
        title: 'Live vs Master Dashboard (Feb 2026)',
        stats: [
          { label: 'Leads variance', value: formatVariance(data.variance?.total_leads) },
          { label: 'Paid variance', value: formatVariance(data.variance?.admission_paid) },
          { label: 'Interested variance', value: formatVariance(data.variance?.interested) },
          { label: 'Dead variance', value: formatVariance(data.variance?.dead_leads) },
          { label: 'Sheet total leads', value: sheet.total_leads },
          { label: 'Sheet admission paid', value: sheet.enrolled_admission_paid },
        ],
      },
      {
        title: 'Campus Funnel (live)',
        columns: ['Campus', 'Leads', 'Interested', 'Paid', 'Dead', 'Passed Int.', 'Sheet Paid'],
        rows: campusRows.map(r => [
          `${r.code} ${r.name}`,
          r.live.total_leads || 0,
          r.live.interested || 0,
          r.live.admission_paid || 0,
          r.live.dead_leads || 0,
          r.live.passed_interview || 0,
          r.sheet.enrolled_admission_paid ?? '—',
        ]),
      },
      {
        title: 'Lead Sources (period)',
        columns: ['Source', 'Leads', 'Conversions'],
        rows: (data.period_stats?.sources || []).map(s => [s.source, s.count, s.conversions]),
      },
      {
        title: 'Campaign ROI',
        columns: ['Campaign', 'Type', 'Budget', 'Spent', 'Leads', 'Conversions', 'Status'],
        rows: (data.campaigns || []).map(c => [
          c.name, c.type,
          `TZS ${parseInt(c.budget || 0).toLocaleString()}`,
          `TZS ${parseInt(c.spent || 0).toLocaleString()}`,
          c.leads_generated, c.conversions, c.status,
        ]),
      },
      {
        title: 'Buffer Social KPI',
        stats: (live.buffer_kpi?.platforms || []).map(p => ({
          label: p.platform,
          value: `${parseInt(p.followers || 0).toLocaleString()} followers · ${p.posts_count || 0} posts MTD · ${p.engagement || 0}% eng.`,
        })),
      },
      {
        title: 'Leads CRUD Summary (live register)',
        stats: [
          { label: 'Total in register', value: data.leads_summary?.totals?.total },
          { label: 'Active funnel', value: data.leads_summary?.totals?.active },
          { label: 'Admission paid', value: data.leads_summary?.totals?.paid },
          { label: 'Dead', value: data.leads_summary?.totals?.dead },
          { label: 'Declined / lapsed', value: data.leads_summary?.totals?.declined },
        ],
      },
      {
        title: 'Leads by Stage',
        stats: (data.leads_summary?.stages || []).map(s => ({
          label: s.computed_stage?.replace(/_/g, ' '),
          value: s.count,
        })),
      },
      {
        title: 'Lead Register (latest 500)',
        columns: ['Parent', 'Child', 'Phone', 'Class', 'Stage', 'Source', 'Campus', 'Score', 'Created'],
        rows: (data.leads_register || []).slice(0, 100).map(l => [
          l.parent_name,
          l.child_name || '—',
          l.parent_phone,
          l.interested_class || '—',
          l.computed_stage?.replace(/_/g, ' '),
          l.source?.replace(/_/g, ' '),
          l.campus_name || '—',
          l.lead_score || 0,
          l.created_date || '—',
        ]),
      },
    ];
  }

  async function handleExport(format) {
    if (!data) return;
    const heading = `Silverleaf Marketing Report — ${period} · ${new Date(data.generated_at).toLocaleDateString('en-GB')}`;
    const sections = buildSections();
    const { exportReportPDF, exportReportExcel, exportReportWord } = await import('@/lib/reportExport');
    if (format === 'pdf') exportReportPDF(`marketing-report-${period}.pdf`, heading, sections);
    else if (format === 'excel') exportReportExcel(`marketing-report-${period}.xlsx`, heading, sections);
    else if (format === 'word') exportReportWord(`marketing-report-${period}.docx`, heading, sections);
  }

  const live = data?.live || {};
  const sheet = data?.snapshot?.cluster || {};
  const campusRows = mergeCampusRows(live.campus_funnel || [], data?.snapshot?.campus_funnel || {});

  return (
    <Layout module="marketing">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: BRAND.black }}>Marketing Reports</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: BRAND.silver }}>Premium workbook-aligned report · live data + Buffer KPIs</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <PeriodToggle value={period} onChange={setPeriod}/>
          <Btn onClick={generate} disabled={loading}>{loading ? 'Loading…' : 'Generate'}</Btn>
          {data && <ExportMenu onExport={handleExport} />}
        </div>
      </div>
      {data ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ background: `linear-gradient(135deg, ${BRAND.electricBlue}, ${BRAND.black})`, borderRadius: 14, padding: '24px 28px', color: 'white', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Generated {new Date(data.generated_at).toLocaleString('en-GB')}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Executive Summary · {period}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16 }}>
              {[
                ['Total Leads', live.total_leads],
                ['Admission Paid', live.admission_paid],
                ['Conversion', `${live.conversion_rate || 0}%`],
                ['Target Progress', `${data.enrollment?.progress_pct || 0}%`],
                ['Dead Leads', live.dead_leads],
                ['Passed Interview', live.passed_interview],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
            <Section title="Live Enrollment Funnel">
              <EnrollmentFunnel live={live} sheetCluster={sheet} showCompare />
            </Section>
            <Section title="Buffer Social KPI">
              <BufferSocialKpi
                bufferKpi={live.buffer_kpi}
                socialTargets={data.social_targets}
                socialOutput={data.social_output}
                onSynced={generate}
              />
            </Section>
          </div>

          <Section title="Campus Performance — live vs workbook">
            <Table cols={[
              { key: 'campus', label: 'Campus', render: r => `${r.code} · ${r.name}` },
              { key: 'leads', label: 'Leads (live)', render: r => r.live.total_leads || 0 },
              { key: 'paid', label: 'Paid (live)', render: r => r.live.admission_paid || 0 },
              { key: 'sheet_paid', label: 'Paid (sheet)', render: r => r.sheet.enrolled_admission_paid ?? '—' },
              { key: 'dead', label: 'Dead', render: r => r.live.dead_leads || 0 },
              { key: 'passed', label: 'Passed int.', render: r => r.live.passed_interview || 0 },
            ]} rows={campusRows} keyFn={r => r.code}/>
          </Section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Section title={`Lead Sources (${period})`}>
              <Table cols={[
                { key: 'source', label: 'Source', render: r => r.source?.replace(/_/g, ' ') },
                { key: 'count', label: 'Leads' },
                { key: 'conversions', label: 'Paid' },
              ]} rows={data.period_stats?.sources || []} keyFn={r => r.source}/>
            </Section>
            <Section title="Campaign ROI">
              <Table cols={[
                { key: 'name', label: 'Campaign' },
                { key: 'type', label: 'Type' },
                { key: 'spent', label: 'Spent', render: r => `TZS ${parseInt(r.spent||0).toLocaleString()}` },
                { key: 'leads_generated', label: 'Leads' },
                { key: 'conversions', label: 'Paid' },
              ]} rows={data.campaigns || []} keyFn={r => r.name}/>
            </Section>
          </div>

          {data.leads_summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              {[
                ['Total leads', data.leads_summary.totals?.total],
                ['Active', data.leads_summary.totals?.active],
                ['Paid', data.leads_summary.totals?.paid],
                ['Dead', data.leads_summary.totals?.dead],
                ['Declined', data.leads_summary.totals?.declined],
              ].map(([label, val]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: BRAND.black }}>{val ?? 0}</div>
                  <div style={{ fontSize: 11, color: BRAND.silver }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          <Section title={`Lead Register (${(data.leads_register || []).length} records · manage in Leads Funnel)`}>
            <Table cols={[
              { key: 'parent_name', label: 'Parent' },
              { key: 'child_name', label: 'Child', render: r => r.child_name || '—' },
              { key: 'parent_phone', label: 'Phone' },
              { key: 'interested_class', label: 'Class', render: r => r.interested_class || '—' },
              { key: 'computed_stage', label: 'Stage', render: r => <Badge status={r.computed_stage} /> },
              { key: 'source', label: 'Source', render: r => r.source?.replace(/_/g, ' ') },
              { key: 'campus_name', label: 'Campus', render: r => r.campus_name || '—' },
              { key: 'lead_score', label: 'Score' },
            ]} rows={(data.leads_register || []).slice(0, 50)} keyFn={r => `${r.parent_phone}-${r.parent_name}-${r.created_date}`}/>
            {(data.leads_register || []).length > 50 && (
              <p style={{ fontSize: 12, color: BRAND.silver, marginTop: 12 }}>
                Showing 50 of {data.leads_register.length} — export for full register.
              </p>
            )}
          </Section>

          <Section title={`Lead Trend (${period})`}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.period_stats?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${BRAND.silver}26`}/>
                <XAxis dataKey="period" tick={{ fontSize: 11 }} tickFormatter={v => v ? new Date(v).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) : ''}/>
                <YAxis tick={{ fontSize: 11 }}/>
                <Tooltip/>
                <Legend/>
                <Line type="monotone" dataKey="leads" stroke={BRAND.electricBlue} name="Leads" strokeWidth={2} dot={false}/>
                <Line type="monotone" dataKey="paid" stroke={BRAND.gold} name="Admission Paid" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </Section>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 80, color: BRAND.silver, background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <BarChart2 size={48} style={{ opacity: 0.3, marginBottom: 12 }}/>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Premium marketing report</div>
          <div>Select a period and click Generate for live funnel, campus breakdown, campaigns, and Buffer KPIs.</div>
        </div>
      )}
    </Layout>
  );
}

// ── PROFILE ───────────────────────────────────────────────────
export function MarketingProfile() { return <Layout module="marketing"><ProfileBase module="marketing"/></Layout>; }

export default Analytics;
