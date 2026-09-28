import { useEffect, useState } from 'react';
import { AlertTriangle, Shield, Pill, CheckCircle, XCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../../utils/api';
import Layout from '../../components/shared/Layout';
import { KpiCard, Section, Badge, PeriodToggle, PageHeader, Spinner } from '../../components/shared/UI';
import { useSocket } from '../../hooks/useSocket';
import toast from 'react-hot-toast';
import { BRAND } from '../../theme';

const C = { green: '#27ae60', red: '#e74c3c', orange: '#e67e22', blue: '#3498db', navy: BRAND.electricBlue, gold: BRAND.gold, purple: '#8e44ad' };

const SEV_COLOR = { low: C.blue, medium: C.orange, high: C.red, critical: '#7f0000' };

export default function SEDashboard() {
  const [data, setData]         = useState(null);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [period, setPeriod]     = useState('monthly');
  const [loading, setLoading]   = useState(true);

  useEffect(() => { fetchDashboard(); }, [period]);

  // Real-time alerts via Socket.IO
  useSocket({
    'incident-alert': (alert) => {
      setLiveAlerts(prev => [{ ...alert, ts: Date.now() }, ...prev].slice(0, 5));
      toast.custom((t) => (
        <div style={{ background: alert.severity === 'critical' ? '#7f0000' : '#e74c3c', color: 'white', padding: '12px 18px', borderRadius: 10, maxWidth: 300 }}>
          <strong>{alert.severity?.toUpperCase()} INCIDENT</strong><br/>
          {alert.studentName} — {alert.incident_location?.replace('_',' ')}
        </div>
      ), { duration: 8000 });
    },
    'dispensary-emergency': (alert) => {
      setLiveAlerts(prev => [{ ...alert, type: 'emergency', ts: Date.now() }, ...prev].slice(0, 5));
      toast.error(`🚨 Emergency: ${alert.studentName}`, { duration: 10000 });
    },
    'critical-walkthrough': () => {
      toast.error('⚠️ Critical safety finding reported', { duration: 8000 });
    },
  });

  async function fetchDashboard() {
    try {
      const r = await api.get('/se/dashboard');
      setData(r.data);
    } catch { toast.error('Failed to load SE dashboard.'); }
    finally { setLoading(false); }
  }

  if (loading) return <Layout module="se"><Spinner /></Layout>;

  const incSummary  = data?.incidentSummary || [];
  const openWalk    = data?.openWalkthroughs || [];
  const emergencies = data?.recentEmergencies || [];
  const quotations  = data?.pendingQuotations || [];
  const events      = data?.upcomingEvents || [];
  const campuses    = data?.campusBreakdown || [];

  const totalIncidents = incSummary.reduce((s, i) => s + parseInt(i.count || 0), 0);
  const criticalInc    = incSummary.filter(i => i.severity === 'critical').reduce((s, i) => s + parseInt(i.count || 0), 0);
  const openItems      = openWalk.length;

  const incByLoc = data?.incidentByLocation || [];
  const locationData = [...new Set(incByLoc.map(i => i.incident_location))].map(loc => ({
    name: loc?.replace('_', ' '), value: incByLoc.filter(i => i.incident_location === loc).reduce((s, i) => s + parseInt(i.count || 0), 0),
  }));

  const PIE_COLORS = [BRAND.electricBlue, BRAND.gold, BRAND.lightBlue, BRAND.silver, BRAND.electricBlue, BRAND.gold, BRAND.lightBlue, BRAND.silver];

  return (
    <Layout module="se">
      {/* Live alert ticker */}
      {liveAlerts.length > 0 && (
        <div style={{ background: '#7f0000', color: 'white', padding: '10px 16px', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={16}/>
          <span style={{ fontSize: 13, fontWeight: 600 }}>LIVE ALERT: {liveAlerts[0].studentName || 'Unknown'} — {liveAlerts[0].incident_location?.replace('_',' ') || liveAlerts[0].complaint || 'Emergency'}</span>
          <button onClick={() => setLiveAlerts([])} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <PageHeader title="Student Experience" sub="Welfare, safety and behaviour overview" />
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard icon={AlertTriangle} label="Total Incidents"    value={totalIncidents} sub="All campuses"           color={BRAND.electricBlue}    />
        <KpiCard icon={XCircle}       label="Critical Incidents" value={criticalInc}    sub="Requires immediate attention" color="#7f0000" />
        <KpiCard icon={Shield}        label="Open Safety Items"  value={openItems}      sub="Awaiting resolution"    color={C.orange} />
        <KpiCard icon={Pill}          label="Pending Quotations" value={quotations.length} sub="Awaiting your approval" color={BRAND.lightBlue} />
      </div>

      {/* Incidents by location + behaviour */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Section title="Incident Heatmap by Location">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={locationData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {locationData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
              </Pie>
              <Tooltip/>
            </PieChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Incidents by Severity">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={['low','medium','high','critical'].map(sev => ({
              severity: sev, count: incSummary.filter(i=>i.severity===sev).reduce((s,i)=>s+parseInt(i.count||0),0)
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={`${BRAND.silver}26`}/>
              <XAxis dataKey="severity" tick={{ fontSize: 12 }}/>
              <YAxis tick={{ fontSize: 11 }}/>
              <Tooltip/>
              <Bar dataKey="count" radius={[4,4,0,0]}>
                {['low','medium','high','critical'].map((sev,i) => <Cell key={i} fill={SEV_COLOR[sev]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Open safety items + emergencies */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Section title="🔴 Open High-Risk Safety Items" action={<a href="/se/walkthroughs" style={{ fontSize: 12, color: C.navy, textDecoration: 'none', fontWeight: 600 }}>View all →</a>}>
          {openWalk.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: BRAND.silver }}><CheckCircle size={28} style={{ opacity: 0.4, marginBottom: 8 }}/><div>No open critical items</div></div>
          ) : openWalk.slice(0, 6).map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: `1px solid ${BRAND.silver}26` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.risk_level === 'critical' ? C.red : C.orange, flexShrink: 0, marginTop: 4 }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.black }}>{item.area?.replace('_',' ')}</div>
                <div style={{ fontSize: 11, color: BRAND.silver }}>{item.campus_name} · {item.findings?.slice(0,60)}{item.findings?.length > 60 ? '…' : ''}</div>
                {item.deadline && <div style={{ fontSize: 11, color: new Date(item.deadline) < new Date() ? C.red : BRAND.silver, marginTop: 2 }}>Due: {new Date(item.deadline).toLocaleDateString('en-GB')}</div>}
              </div>
              <Badge status={item.risk_level}/>
            </div>
          ))}
        </Section>

        <Section title="🚨 Recent Emergencies">
          {emergencies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: BRAND.silver }}>No recent emergencies</div>
          ) : emergencies.map(e => (
            <div key={e.id} style={{ padding: '10px 0', borderBottom: `1px solid ${BRAND.silver}26` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.red }}>{e.first_name} {e.last_name}</div>
              <div style={{ fontSize: 12, color: BRAND.silver }}>{e.complaint?.slice(0, 80)}</div>
              <div style={{ fontSize: 11, color: BRAND.silver, marginTop: 2 }}>{e.campus_name} · {new Date(e.created_at).toLocaleString('en-GB')}</div>
            </div>
          ))}
        </Section>
      </div>

      {/* Pending quotations */}
      {quotations.length > 0 && (
        <Section title="Drug Quotations Awaiting Approval" action={<a href="/se/dispensary" style={{ fontSize: 12, color: C.navy, textDecoration: 'none', fontWeight: 600 }}>Review →</a>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 12 }}>
            {quotations.map(q => (
              <div key={q.id} style={{ background: `${BRAND.gold}14`, borderRadius: 9, padding: '12px 14px', borderLeft: `3px solid ${BRAND.gold}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.black }}>{q.title}</div>
                <div style={{ fontSize: 12, color: BRAND.silver, marginTop: 2 }}>{q.campus_name} · TZS {parseInt(q.total_estimated_cost||0).toLocaleString()}</div>
                <div style={{ fontSize: 11, color: BRAND.silver, marginTop: 2 }}>{new Date(q.created_at).toLocaleDateString('en-GB')}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Campus comparison (global head) */}
      {campuses.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Section title="Campus Comparison — Last 30 Days">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={campuses}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${BRAND.silver}26`}/>
                <XAxis dataKey="name" tick={{ fontSize: 11 }}/>
                <YAxis tick={{ fontSize: 11 }}/>
                <Tooltip/>
                <Legend/>
                <Bar dataKey="incidents"          fill={C.red}    name="Incidents"     radius={[4,4,0,0]}/>
                <Bar dataKey="critical_incidents"  fill="#7f0000"  name="Critical"      radius={[4,4,0,0]}/>
                <Bar dataKey="behaviour_reports"   fill={C.orange} name="Behaviour"     radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Section>
        </div>
      )}
    </Layout>
  );
}
