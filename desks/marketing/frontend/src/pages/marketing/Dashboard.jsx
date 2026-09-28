import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Users, TrendingUp, DollarSign, Megaphone, ArrowRight, Radio, MapPin, Share2 } from 'lucide-react';
import api from '../../utils/api';
import Layout from '../../components/shared/Layout';
import toast from 'react-hot-toast';
import { BRAND } from '../../theme';

const C = { navy: BRAND.black, gold: BRAND.gold, blue: BRAND.electricBlue, green: '#27ae60', red: '#e74c3c', purple: BRAND.lightBlue, teal: '#16a085', orange: '#e67e22' };
const FUNNEL_COLORS = { interested_lead: '#3498db', dead_lead: '#7f8c8d', tour_booked: '#f39c12', interview_booked: '#16a085', form_filled: '#8e44ad', enrolled: '#27ae60', admission_paid: '#c9a84c', declined: '#e74c3c', lapsed: '#95a5a6' };
const FUNNEL_LABELS = { interested_lead: 'Interested Leads', dead_lead: 'Dead Lead', tour_booked: 'Tour Booked', interview_booked: 'Interview', form_filled: 'Register', enrolled: 'Enrolled', admission_paid: 'Admission Paid', declined: 'Declined', lapsed: 'Lapsed' };
const SOURCE_COLORS = [BRAND.electricBlue, BRAND.gold, BRAND.lightBlue, BRAND.silver, BRAND.electricBlue, BRAND.gold, BRAND.lightBlue, BRAND.silver];

const PERIODS = ['daily','weekly','monthly','yearly'];

function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderTop: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color={color}/>
        </div>
        <span style={{ fontSize: 13, color: BRAND.silver, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: BRAND.black }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: BRAND.silver, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children, action }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: BRAND.black }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function MarketingDashboard() {
  const [data, setData]       = useState(null);
  const [period, setPeriod]   = useState('monthly');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { fetchDashboard(); }, [period]);

  async function fetchDashboard() {
    try {
      setLoading(true);
      const [dash, analytics] = await Promise.all([
        api.get('/marketing/dashboard'),
        api.get(`/marketing/analytics?period=${period}`),
      ]);
      setData({ ...dash.data, analytics: analytics.data });
    } catch (err) {
      toast.error('Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <Layout module="marketing">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ color: BRAND.silver }}>Loading dashboard…</div>
      </div>
    </Layout>
  );

  const funnel      = data?.funnel || [];
  const sources     = data?.sources || [];
  const campaigns   = data?.activeCampaigns || [];
  const events      = data?.upcomingEvents || [];
  const campuses    = data?.campusBreakdown || [];
  const analytics   = data?.analytics || {};
  const social      = data?.social || [];

  const funnelData  = ['interested_lead','tour_booked','interview_booked','form_filled','enrolled','admission_paid']
    .map(stage => ({ name: FUNNEL_LABELS[stage], count: parseInt(funnel.find(f => f.computed_stage === stage)?.count || 0), color: FUNNEL_COLORS[stage] }));

  const totalLeads  = funnelData.reduce((s, f) => s + f.count, 0);
  const totalPaid   = funnelData.find(f => f.name === 'Admission Paid')?.count || 0;
  const convRate    = totalLeads ? ((totalPaid / totalLeads) * 100).toFixed(1) : '0.0';

  const totalBudget = campaigns.reduce((s, c) => s + parseFloat(c.budget || 0), 0);
  const totalSpent  = campaigns.reduce((s, c) => s + parseFloat(c.spent || 0), 0);

  return (
    <Layout module="marketing">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: BRAND.black }}>Marketing Dashboard</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: BRAND.silver }}>Leads, campaigns and performance overview</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => navigate('/marketing/leads')} style={{
            padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
            background: BRAND.gold, color: BRAND.black,
          }}>Add / work leads</button>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              background: period === p ? C.navy : `${BRAND.silver}14`, color: period === p ? 'white' : BRAND.silver,
            }}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard icon={Users}      label="Total Leads"       value={totalLeads}               sub={`${period} period`}        color={BRAND.electricBlue}  />
        <KpiCard icon={TrendingUp} label="Conversion Rate"   value={`${convRate}%`}            sub="Lead to admission paid"     color={BRAND.gold} />
        <KpiCard icon={DollarSign} label="Admission Paid"    value={totalPaid}                 sub="This period"                color={BRAND.lightBlue}  />
        <KpiCard icon={Megaphone}  label="Campaign Spend"    value={`TZS ${(totalSpent/1000000).toFixed(1)}M`} sub={`of ${(totalBudget/1000000).toFixed(1)}M budget`} color={BRAND.silver}/>
      </div>

      {/* Funnel + Sources row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Section title="Lead Funnel" action={<button onClick={() => navigate('/marketing/leads')} style={btnStyle}>View Kanban <ArrowRight size={14}/></button>}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fontSize: 11 }}/>
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }}/>
              <Tooltip formatter={(v) => [v, 'Leads']}/>
              <Bar dataKey="count" radius={[0,4,4,0]}>
                {funnelData.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Lead Sources">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={sources} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={80} label={({ source, percent }) => `${source?.replace('_',' ')} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {sources.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}/>)}
              </Pie>
              <Tooltip/>
            </PieChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Trend + Social row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 20 }}>
        <Section title="Lead Trend">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={analytics.trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke={`${BRAND.silver}26`}/>
              <XAxis dataKey="period" tick={{ fontSize: 11 }} tickFormatter={v => v ? new Date(v).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) : ''}/>
              <YAxis tick={{ fontSize: 11 }}/>
              <Tooltip/>
              <Legend/>
              <Line type="monotone" dataKey="leads" stroke={BRAND.electricBlue}  name="Leads"         strokeWidth={2} dot={false}/>
              <Line type="monotone" dataKey="paid"  stroke={BRAND.gold}  name="Admission Paid" strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Social Media Performance">
          {social.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: BRAND.silver, fontSize: 14 }}>
              <Share2 size={32} style={{ marginBottom: 8, opacity: 0.4 }}/>
              <div>Connect Buffer or add manual social data</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {social.map(s => (
                <div key={s.platform} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: `${BRAND.silver}0D`, borderRadius: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: BRAND.black, textTransform: 'capitalize' }}>{s.platform}</span>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: BRAND.silver }}>
                    <span><strong style={{ color: BRAND.black }}>{parseInt(s.followers || 0).toLocaleString()}</strong> followers</span>
                    <span><strong style={{ color: C.gold }}>{s.engagement}%</strong> eng.</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Campaigns + Events row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Section title="Active Campaigns" action={<button onClick={() => navigate('/marketing/campaigns')} style={btnStyle}>All campaigns <ArrowRight size={14}/></button>}>
          {campaigns.length === 0 ? <div style={{ color: BRAND.silver, fontSize: 13, textAlign: 'center', padding: 24 }}>No active campaigns</div> : campaigns.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${BRAND.silver}26` }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: c.type === 'radio' ? `${BRAND.electricBlue}18` : c.type === 'billboard' ? `${BRAND.gold}18` : `${BRAND.lightBlue}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {c.type === 'radio' ? <Radio size={15} color={BRAND.electricBlue}/> : c.type === 'billboard' ? <MapPin size={15} color={BRAND.gold}/> : <Share2 size={15} color={BRAND.lightBlue}/>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.black }}>{c.name}</div>
                <div style={{ fontSize: 11, color: BRAND.silver }}>{c.leads_generated} leads · TZS {parseInt(c.spent||0).toLocaleString()} spent</div>
                <div style={{ height: 4, background: `${BRAND.silver}26`, borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: C.gold, width: `${Math.min((c.spent/c.budget)*100,100)||0}%`, borderRadius: 2, transition: 'width 0.5s' }}/>
                </div>
              </div>
            </div>
          ))}
        </Section>

        <Section title="Upcoming Events">
          {events.length === 0 ? <div style={{ color: BRAND.silver, fontSize: 13, textAlign: 'center', padding: 24 }}>No upcoming events</div> : events.map(e => (
            <div key={e.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: `1px solid ${BRAND.silver}26` }}>
              <div style={{ minWidth: 48, textAlign: 'center', background: `${BRAND.silver}26`, borderRadius: 8, padding: '6px 4px' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>{new Date(e.start_date).getDate()}</div>
                <div style={{ fontSize: 10, color: BRAND.silver }}>{new Date(e.start_date).toLocaleDateString('en-GB',{month:'short'})}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.black }}>{e.title}</div>
                <div style={{ fontSize: 11, color: BRAND.silver }}>{e.event_type?.replace('_',' ')} {e.location ? '· ' + e.location : ''}</div>
              </div>
            </div>
          ))}
        </Section>
      </div>

      {/* Campus breakdown (global head only) */}
      {campuses.length > 0 && (
        <Section title="Campus Performance Comparison">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={campuses}>
              <CartesianGrid strokeDasharray="3 3" stroke={`${BRAND.silver}26`}/>
              <XAxis dataKey="name" tick={{ fontSize: 11 }}/>
              <YAxis tick={{ fontSize: 11 }}/>
              <Tooltip/>
              <Legend/>
              <Bar dataKey="total_leads" fill={BRAND.electricBlue}  name="Total Leads"  radius={[4,4,0,0]}/>
              <Bar dataKey="paid"         fill={BRAND.gold}  name="Paid"         radius={[4,4,0,0]}/>
              <Bar dataKey="total_tours"  fill={BRAND.lightBlue} name="Tours"        radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}
    </Layout>
  );
}

const btnStyle = {
  display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
  background: `${BRAND.silver}14`, border: 'none', borderRadius: 6, cursor: 'pointer',
  fontSize: 12, color: BRAND.silver, fontWeight: 500,
};
