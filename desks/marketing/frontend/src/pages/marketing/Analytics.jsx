// Marketing Analytics, Calendar, Team, Reports, Profile

import { useEffect, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../utils/api';
import Layout from '../../components/shared/Layout';
import { Section, PageHeader, PeriodToggle, Spinner, Modal, Field, Input, Select, Btn, Table, Badge, ExportMenu } from '../../components/shared/UI';
import ProfileBase from '../../components/shared/ProfileBase';
import { isMarketingTeamMember } from '../../utils/marketingTeam';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { BRAND } from '../../theme';
// Loaded on demand (not statically) — jsPDF/xlsx/docx are ~1MB combined, and most
// visits to this page never click Export.

// ── ANALYTICS ─────────────────────────────────────────────────
export function Analytics() {
  const [data, setData]     = useState(null);
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get(`/marketing/analytics?period=${period}`).then(r => { setData(r.data); setLoading(false); }).catch(() => toast.error('Failed to load.')); }, [period]);

  if (loading) return <Layout module="marketing"><Spinner /></Layout>;

  const conv = data?.conversion || {};
  const total = parseInt(conv.total_leads || 0);
  const funnelSteps = [
    { name: 'Interested Lead', value: total, fill: BRAND.electricBlue },
    { name: 'Tour Booked',     value: parseInt(conv.tour_rate || 0), fill: BRAND.gold },
    { name: 'Interview',       value: parseInt(conv.interview_rate || 0), fill: '#16a085' },
    { name: 'Register',       value: parseInt(conv.form_rate || 0), fill: BRAND.lightBlue },
    { name: 'Enrolled',       value: parseInt(conv.enrolled_rate || 0), fill: BRAND.silver },
    { name: 'Paid',           value: parseInt(conv.paid_rate || 0), fill: BRAND.electricBlue },
  ];

  return (
    <Layout module="marketing">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <PageHeader title="Analytics & Insights" sub="Funnel performance and trends" />
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Section title="Conversion Funnel">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {funnelSteps.map((s, i) => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 100, fontSize: 12, color: BRAND.silver, textAlign: 'right' }}>{s.name}</div>
                <div style={{ flex: 1, height: 28, background: `${BRAND.silver}14`, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${total > 0 ? (s.value/total)*100 : 0}%`, background: s.fill, borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 8, color: 'white', fontSize: 12, fontWeight: 700, transition: 'width 0.5s' }}>
                    {s.value > 0 ? s.value : ''}
                  </div>
                </div>
                <div style={{ width: 48, fontSize: 12, color: BRAND.silver, textAlign: 'right' }}>
                  {total > 0 ? ((s.value/total)*100).toFixed(0) : 0}%
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Lead Source Effectiveness">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data?.sources || []} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={`${BRAND.silver}26`}/>
              <XAxis dataKey="source" tick={{ fontSize: 10 }} tickFormatter={v => v?.replace('_',' ')}/>
              <YAxis tick={{ fontSize: 11 }}/>
              <Tooltip/>
              <Legend/>
              <Bar dataKey="count" name="Leads" fill={BRAND.electricBlue} radius={[3,3,0,0]}/>
              <Bar dataKey="conversions" name="Converted" fill={BRAND.gold} radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      <Section title="Lead Trend Over Time">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data?.trend || []}>
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
    </Layout>
  );
}

// ── CALENDAR ──────────────────────────────────────────────────
export function MarketingCalendar() {
  const [events, setEvents]   = useState([]);
  const [month, setMonth]     = useState(new Date());
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm]       = useState({ title:'', event_type:'open_day', start_date:'', location:'' });

  useEffect(() => { api.get('/marketing/events').then(r => setEvents(r.data)).catch(() => {}); }, []);

  async function save(e) {
    e.preventDefault();
    try { await api.post('/marketing/events', form); toast.success('Event added.'); setAddOpen(false); setEvents([]); api.get('/marketing/events').then(r => setEvents(r.data)); }
    catch { toast.error('Failed to save.'); }
  }

  const year = month.getFullYear(), mo = month.getMonth();
  const firstDay = new Date(year, mo, 1).getDay();
  const daysInMonth = new Date(year, mo + 1, 0).getDate();
  const monthName = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const EVENT_COLORS = { open_day: BRAND.electricBlue, term_start: BRAND.gold, term_end: BRAND.lightBlue, sports_day: BRAND.silver, cultural_day: BRAND.electricBlue, other: BRAND.gold };

  function getEventsForDay(d) {
    const dateStr = `${year}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return events.filter(e => e.start_date?.slice(0,10) === dateStr);
  }

  return (
    <Layout module="marketing">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: BRAND.black }}>School Events</h1>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setMonth(new Date(year, mo-1, 1))} style={{ background: `${BRAND.silver}14`, border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}><ChevronLeft size={16}/></button>
            <span style={{ fontSize: 14, fontWeight: 600, minWidth: 140, textAlign: 'center' }}>{monthName}</span>
            <button onClick={() => setMonth(new Date(year, mo+1, 1))} style={{ background: `${BRAND.silver}14`, border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}><ChevronRight size={16}/></button>
          </div>
        </div>
        <Btn onClick={() => setAddOpen(true)}><Plus size={15}/>Add Event</Btn>
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
                    {ev.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add School Event">
        <form onSubmit={save}>
          <Field label="Event Title" required><Input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} required /></Field>
          <Field label="Event Type">
            <Select value={form.event_type} onChange={e => setForm(f=>({...f,event_type:e.target.value}))}>
              {['open_day','term_start','term_end','sports_day','cultural_day','club_event','trip','welfare_day','public_holiday','other'].map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
            </Select>
          </Field>
          <Field label="Date" required><Input type="date" value={form.start_date} onChange={e => setForm(f=>({...f,start_date:e.target.value}))} required /></Field>
          <Field label="Location"><Input value={form.location} onChange={e => setForm(f=>({...f,location:e.target.value}))} /></Field>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
            <Btn type="submit">Add Event</Btn>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}

// ── TEAM ──────────────────────────────────────────────────────
export function Team() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.get('/admin/users').then(r => setUsers((r.data || []).filter(isMarketingTeamMember))).catch(() => {});
  }, []);

  async function deactivate(id) {
    if (!confirm('Deactivate this user?')) return;
    try { await api.patch(`/admin/users/${id}`, { is_active: false }); api.get('/admin/users').then(r => setUsers((r.data || []).filter(isMarketingTeamMember))); }
    catch { toast.error('Failed.'); }
  }

  async function resetPwd(id) {
    if (!confirm('Reset this user to the default password?')) return;
    try { const { data } = await api.patch(`/auth/reset-password/${id}`); toast.success(`Password reset to: ${data.defaultPassword}`); }
    catch { toast.error('Failed.'); }
  }

  const cols = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: r => <Badge status={r.is_active ? 'active' : 'declined'} label={r.role?.replace(/_/g,' ')} /> },
    { key: 'campus_name', label: 'Campus' },
    { key: 'last_login', label: 'Last Login', render: r => r.last_login ? new Date(r.last_login).toLocaleDateString('en-GB') : 'Never' },
    { key: 'actions', label: '', render: r => (
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn variant="secondary" small onClick={() => resetPwd(r.id)}>Reset Pwd</Btn>
        {r.is_active ? <Btn variant="danger" small onClick={() => deactivate(r.id)}>Deactivate</Btn> : <span style={{ fontSize: 11, color: BRAND.silver }}>Inactive</span>}
      </div>
    )},
  ];

  if (user?.role !== 'global_marketing_head') return <Layout module="marketing"><div style={{ padding: 40, color: BRAND.silver, textAlign: 'center' }}>Only the Global Marketing Head can manage team members.</div></Layout>;

  return (
    <Layout module="marketing">
      <PageHeader title="Team Management" sub={`${users.length} team member${users.length === 1 ? '' : 's'} · Eric & Mariam only`}/>
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <Table cols={cols} rows={users} keyFn={r => r.id}/>
      </div>
    </Layout>
  );
}

// ── REPORTS ───────────────────────────────────────────────────
export function Reports() {
  const [period, setPeriod] = useState('monthly');
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try { const r = await api.get(`/admin/reports?module=marketing&period=${period}`); setData(r.data); }
    catch { toast.error('Failed to load.'); }
    finally { setLoading(false); }
  }

  function buildSections() {
    return [
      {
        title: `Funnel Summary — ${period}`,
        stats: (data.data?.funnel || []).map(f => ({ label: f.computed_stage?.replace(/_/g, ' '), value: f.count })),
      },
      {
        title: 'Campaign Summary',
        columns: ['Campaign', 'Type', 'Budget', 'Spent', 'Leads', 'Conversions'],
        rows: (data.data?.campaigns || []).map(c => [
          c.name, c.type,
          `TZS ${parseInt(c.budget || 0).toLocaleString()}`,
          `TZS ${parseInt(c.spent || 0).toLocaleString()}`,
          c.leads_generated, c.conversions,
        ]),
      },
    ];
  }

  async function handleExport(format) {
    if (!data) return;
    const heading = `Marketing Report — ${period}`;
    const sections = buildSections();
    const { exportReportPDF, exportReportExcel, exportReportWord } = await import('../../utils/reportExport');
    if (format === 'pdf') exportReportPDF(`marketing-report-${period}.pdf`, heading, sections);
    else if (format === 'excel') exportReportExcel(`marketing-report-${period}.xlsx`, heading, sections);
    else if (format === 'word') exportReportWord(`marketing-report-${period}.docx`, heading, sections);
  }

  return (
    <Layout module="marketing">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: BRAND.black }}>Reports</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <PeriodToggle value={period} onChange={setPeriod}/>
          <Btn onClick={generate} disabled={loading}>{loading ? 'Loading…' : 'Generate'}</Btn>
          {data && <ExportMenu onExport={handleExport} />}
        </div>
      </div>
      {data ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <h3 style={{ marginTop: 0 }}>Funnel Summary — {period}</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {(data.data?.funnel || []).map(f => (
                <div key={f.computed_stage} style={{ background: `${BRAND.silver}0D`, borderRadius: 8, padding: '10px 16px', textAlign: 'center', minWidth: 100 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: BRAND.black }}>{f.count}</div>
                  <div style={{ fontSize: 11, color: BRAND.silver, textTransform: 'capitalize' }}>{f.computed_stage?.replace(/_/g,' ')}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <h3 style={{ marginTop: 0 }}>Campaign Summary</h3>
            <Table cols={[
              { key: 'name', label: 'Campaign' },
              { key: 'type', label: 'Type' },
              { key: 'budget', label: 'Budget', render: r => `TZS ${parseInt(r.budget||0).toLocaleString()}` },
              { key: 'spent', label: 'Spent', render: r => `TZS ${parseInt(r.spent||0).toLocaleString()}` },
              { key: 'leads_generated', label: 'Leads' },
              { key: 'conversions', label: 'Conversions' },
            ]} rows={data.data?.campaigns || []} keyFn={r=>r.name}/>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 80, color: BRAND.silver }}>
          <BarChart2 size={48} style={{ opacity: 0.3, marginBottom: 12 }}/>
          <div>Select a period and click Generate to load the report.</div>
        </div>
      )}
    </Layout>
  );
}

// ── PROFILE ───────────────────────────────────────────────────
export function MarketingProfile() { return <Layout module="marketing"><ProfileBase module="marketing"/></Layout>; }

export default Analytics;
