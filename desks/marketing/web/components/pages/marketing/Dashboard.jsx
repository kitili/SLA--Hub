'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Users, TrendingUp, DollarSign, Megaphone, ArrowRight, Radio, MapPin, Share2, Target, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import Layout from '@/components/shared/Layout';
import EnrollmentFunnel from '@/components/marketing/EnrollmentFunnel';
import BufferSocialKpi from '@/components/marketing/BufferSocialKpi';
import toast from 'react-hot-toast';
import { BRAND } from '@/theme';
import { formatTrendTick, formatVariance, mergeCampusRows } from '@/lib/marketingFunnel';
import { useCampusFilterStore, campusSearchParams } from '@/lib/campusFilter';
import { useAuthStore } from '@/store/authStore';
import WorkbookOps from '@/components/marketing/WorkbookOps';
import ReadinessBanner from '@/components/marketing/ReadinessBanner';

const C = { navy: BRAND.black, gold: BRAND.gold, blue: BRAND.electricBlue, green: '#27ae60', red: '#e74c3c', purple: BRAND.lightBlue, teal: '#16a085', orange: '#e67e22' };
const SOURCE_COLORS = [BRAND.electricBlue, BRAND.gold, BRAND.lightBlue, BRAND.silver, BRAND.electricBlue, BRAND.gold, BRAND.lightBlue, BRAND.silver];
const PERIODS = ['daily','weekly','monthly','yearly'];
const LIVE_REFRESH_MS = 60000;

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
  const [master, setMaster]   = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [period, setPeriod]   = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const campusId = useCampusFilterStore((s) => s.campusId);
  const campuses = useCampusFilterStore((s) => s.campuses);
  const setCampusId = useCampusFilterStore((s) => s.setCampusId);
  const user = useAuthStore((s) => s.user);
  const isGlobal = Boolean(user && !user.campusId);

  const fetchDashboard = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      const q = campusSearchParams(campusId);
      const [dash, analytics, snap, ready] = await Promise.all([
        api.get(`/marketing/dashboard${q}`),
        api.get(`/marketing/analytics${campusSearchParams(campusId, { period })}`),
        api.get(`/marketing/master-snapshot${q}`),
        api.get('/marketing/readiness'),
      ]);
      setData({ ...dash.data, analytics: analytics.data });
      setMaster(snap.data);
      setReadiness(ready.data);
    } catch {
      if (!silent) toast.error('Failed to load dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, campusId]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  useEffect(() => {
    const id = setInterval(() => fetchDashboard(true), LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchDashboard]);

  if (loading) return (
    <Layout module="marketing">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ color: BRAND.silver }}>Loading dashboard…</div>
      </div>
    </Layout>
  );

  const sources     = data?.sources || [];
  const campaigns   = data?.activeCampaigns || [];
  const events      = data?.upcomingEvents || [];
  const analytics   = data?.analytics || {};
  const live        = master?.live || {};
  const sheet       = master?.snapshot?.cluster || {};
  const variance    = master?.variance || {};
  const enrollment  = master?.enrollment || {};
  const campusRows  = mergeCampusRows(live.campus_funnel || [], master?.snapshot?.campus_funnel || {});
  const selectedCampus = campuses.find((c) => String(c.id) === String(campusId));
  const campusSheet = selectedCampus ? (master?.snapshot?.campus_funnel || {})[selectedCampus.code] : null;

  const totalLeads  = live.total_leads || 0;
  const totalPaid   = live.admission_paid || 0;
  const convRate    = live.conversion_rate ?? (totalLeads ? ((totalPaid / totalLeads) * 100).toFixed(1) : '0.0');
  const totalBudget = campaigns.reduce((s, c) => s + parseFloat(c.budget || 0), 0);
  const totalSpent  = campaigns.reduce((s, c) => s + parseFloat(c.spent || 0), 0);
  const refreshedAt = live.refreshed_at ? new Date(live.refreshed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
  const socialTargets = master?.snapshot?.social_following?.filter(r => r.month === 2 && r.year === 2026) || [];
  const socialOutput = master?.snapshot?.social_output?.filter(r => r.month === 2) || [];

  return (
    <Layout module="marketing">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: BRAND.black }}>Marketing Dashboard</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: BRAND.silver }}>
            {selectedCampus
              ? `${selectedCampus.name} · live enrollment funnel`
              : 'Live enrollment funnel · synced with Master Dashboard workbook'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: BRAND.silver, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }}/>
            Live · {refreshedAt}
          </span>
          <button onClick={() => fetchDashboard(true)} disabled={refreshing} style={{
            padding: '6px 12px', borderRadius: 8, border: `1px solid ${BRAND.silver}40`, cursor: 'pointer',
            background: 'white', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <RefreshCw size={14} style={{ opacity: refreshing ? 0.5 : 1 }}/> Refresh
          </button>
          <button onClick={() => router.push('/marketing/agent')} style={{
            padding: '8px 14px', borderRadius: 8, border: `1px solid ${BRAND.electricBlue}`, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, background: 'white', color: BRAND.electricBlue,
          }}>Agent queue</button>
          <button onClick={() => router.push('/marketing/leads')} style={{
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
      <ReadinessBanner readiness={readiness} />

      {sheet.total_leads != null && !campusId && (
        <div style={{ marginBottom: 20, padding: '14px 18px', background: `linear-gradient(135deg, ${BRAND.electricBlue}08, ${BRAND.gold}08)`, border: `1px solid ${BRAND.electricBlue}22`, borderRadius: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.electricBlue, marginBottom: 10 }}>
            Master Dashboard (Feb 2026) · live variance
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, fontSize: 13 }}>
            {[
              ['Leads', totalLeads, sheet.total_leads, variance.total_leads],
              ['Admission paid', totalPaid, sheet.enrolled_admission_paid, variance.admission_paid],
              ['Currently interested', live.interested, sheet.interested_leads, variance.interested],
              ['Tour booked', live.tour_booked, sheet.tour_booked ?? '—', sheet.tour_booked == null ? 0 : (live.tour_booked || 0) - sheet.tour_booked],
              ['Dead leads', live.dead_leads, sheet.dead_leads, variance.dead_leads],
              ['In interview (passed)', live.passed_interview, sheet.passed_interview, variance.passed_interview],
              ['Registered', live.registered, sheet.registered_form_filled, variance.registered],
            ].map(([label, app, sh, diff]) => (
              <div key={label}>
                <span style={{ color: BRAND.silver, fontSize: 11 }}>{label}</span>
                <div><strong>{app}</strong> live · {sh} sheet</div>
                <div style={{ fontSize: 11, color: diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : BRAND.silver }}>{formatVariance(diff)} vs sheet</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enrollment target progress */}
      {enrollment.target_2026 > 0 && (
        <div style={{ marginBottom: 20, padding: '16px 20px', background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Target size={18} color={BRAND.gold}/>
              <span style={{ fontSize: 14, fontWeight: 700 }}>2026 Enrollment Target</span>
            </div>
            <span style={{ fontSize: 13, color: BRAND.silver }}>
              {totalPaid} / {(campusSheet?.target_enrollment || enrollment.target_2026)} seats · <strong style={{ color: BRAND.black }}>{
                (campusSheet?.target_enrollment
                  ? Math.round((totalPaid / campusSheet.target_enrollment) * 1000) / 10
                  : enrollment.progress_pct)
              }%</strong>
            </span>
          </div>
          <div style={{ height: 10, background: `${BRAND.silver}26`, borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(campusSheet?.target_enrollment ? (totalPaid / campusSheet.target_enrollment) * 100 : enrollment.progress_pct, 100)}%`, background: `linear-gradient(90deg, ${BRAND.electricBlue}, ${BRAND.gold})`, borderRadius: 5, transition: 'width 0.6s' }}/>
          </div>
          <div style={{ fontSize: 11, color: BRAND.silver, marginTop: 6 }}>
            Sheet baseline: {enrollment.sheet_paid} paid · Company occupancy {Math.round((enrollment.company_occupancy_pct || 0) * 100)}% ({enrollment.company_total_enrolled} enrolled)
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard icon={Users} label="Total Leads (live)" value={totalLeads.toLocaleString()} sub={`${live.active_leads || 0} active in funnel`} color={BRAND.electricBlue}/>
        <KpiCard icon={TrendingUp} label="Conversion Rate" value={`${convRate}%`} sub="Lead → admission paid" color={BRAND.gold}/>
        <KpiCard icon={DollarSign} label="Admission Paid" value={totalPaid.toLocaleString()} sub={`Target ${enrollment.target_2026 || '—'}`} color={BRAND.lightBlue}/>
        <KpiCard icon={Megaphone} label="Campaign Spend" value={`TZS ${(totalSpent/1000000).toFixed(1)}M`} sub={`of ${(totalBudget/1000000).toFixed(1)}M budget`} color={BRAND.silver}/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 20 }}>
        <Section title="Enrollment Funnel (live)" action={
          <button onClick={() => router.push('/marketing/leads')} style={btnStyle}>Work leads <ArrowRight size={14}/></button>
        }>
          <EnrollmentFunnel live={live} sheetCluster={sheet} showCompare />
        </Section>

        <Section title="Lead Sources">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={sources} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={90} label={({ source, percent }) => `${source?.replace('_',' ')} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {sources.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}/>)}
              </Pie>
              <Tooltip/>
            </PieChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {campusRows.length > 0 && (
        <div style={{ marginBottom: 20 }}>
        <Section title="Campus Funnel — live vs workbook" action={<span style={{ fontSize: 11, color: BRAND.silver }}>{isGlobal ? 'Click a campus to filter' : 'Updates as leads move'}</span>}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: `${BRAND.silver}14`, textAlign: 'left' }}>
                  {['Campus', 'Leads (live)', 'Leads (sheet)', 'Interested', 'Paid (live)', 'Paid (sheet)', 'Dead', 'Passed int.', 'Target'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', fontWeight: 700, color: BRAND.silver }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campusRows.map(row => {
                  const match = campuses.find((c) => c.code === row.code);
                  const active = match && String(match.id) === String(campusId);
                  return (
                  <tr
                    key={row.code}
                    onClick={() => {
                      if (!isGlobal || !match) return;
                      setCampusId(active ? '' : String(match.id));
                    }}
                    style={{
                      borderBottom: `1px solid ${BRAND.silver}22`,
                      cursor: isGlobal ? 'pointer' : 'default',
                      background: active ? `${BRAND.electricBlue}10` : 'transparent',
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: isGlobal ? BRAND.electricBlue : BRAND.black }}>{row.code} · {row.name}</td>
                    <td style={{ padding: '10px 12px' }}>{row.live.total_leads || 0}</td>
                    <td style={{ padding: '10px 12px', color: BRAND.silver }}>{row.sheet.total_leads ?? '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{row.live.interested || 0}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: BRAND.gold }}>{row.live.admission_paid || 0}</td>
                    <td style={{ padding: '10px 12px', color: BRAND.silver }}>{row.sheet.enrolled_admission_paid ?? '—'}</td>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 20 }}>
        <Section title={`Lead Trend (${period})`}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={analytics.trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke={`${BRAND.silver}26`}/>
              <XAxis dataKey="period" tick={{ fontSize: 11 }} minTickGap={28} interval="preserveStartEnd" tickFormatter={(v) => formatTrendTick(v, period)}/>
              <YAxis tick={{ fontSize: 11 }}/>
              <Tooltip/>
              <Legend/>
              <Line type="monotone" dataKey="leads" stroke={BRAND.electricBlue} name="Leads" strokeWidth={2} dot={false}/>
              <Line type="monotone" dataKey="paid" stroke={BRAND.gold} name="Admission Paid" strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Buffer Social KPI">
          <BufferSocialKpi
            bufferKpi={live.buffer_kpi}
            socialTargets={socialTargets}
            socialOutput={socialOutput}
            onSynced={() => fetchDashboard(true)}
          />
        </Section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Section title="Active Campaigns" action={<button onClick={() => router.push('/marketing/campaigns')} style={btnStyle}>All campaigns <ArrowRight size={14}/></button>}>
          {campaigns.length === 0 ? <div style={{ color: BRAND.silver, fontSize: 13, textAlign: 'center', padding: 24 }}>No active campaigns</div> : campaigns.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${BRAND.silver}26` }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: c.type === 'radio' ? `${BRAND.electricBlue}18` : c.type === 'billboard' ? `${BRAND.gold}18` : `${BRAND.lightBlue}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {c.type === 'radio' ? <Radio size={15} color={BRAND.electricBlue}/> : c.type === 'billboard' ? <MapPin size={15} color={BRAND.gold}/> : <Share2 size={15} color={BRAND.lightBlue}/>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.black }}>{c.name}</div>
                <div style={{ fontSize: 11, color: BRAND.silver }}>{c.leads_generated} leads · TZS {parseInt(c.spent||0).toLocaleString()} spent</div>
                <div style={{ height: 4, background: `${BRAND.silver}26`, borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: C.gold, width: `${Math.min((c.spent/c.budget)*100,100)||0}%`, borderRadius: 2 }}/>
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

      {master?.ops && (
        <div style={{ marginBottom: 20 }}>
          <WorkbookOps ops={master.ops} />
        </div>
      )}
    </Layout>
  );
}

const btnStyle = {
  display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
  background: `${BRAND.silver}14`, border: 'none', borderRadius: 6, cursor: 'pointer',
  fontSize: 12, color: BRAND.silver, fontWeight: 500,
};
