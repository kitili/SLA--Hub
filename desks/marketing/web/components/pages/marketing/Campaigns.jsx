'use client';

import { useEffect, useState } from 'react';
import { Plus, Radio, MapPin, Share2, TrendingUp, DollarSign } from 'lucide-react';
import api from '@/lib/api';
import Layout from '@/components/shared/Layout';
import { Section, PageHeader, Badge, Btn, Field, Input, Select, Textarea, Modal, Empty, Spinner } from '@/components/shared/UI';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCampusFilterStore, campusSearchParams } from '@/lib/campusFilter';
import { BRAND } from '@/theme';

const TYPE_META = {
  radio:       { icon: Radio,     color: BRAND.electricBlue, label: 'Radio' },
  billboard:   { icon: MapPin,    color: BRAND.gold, label: 'Billboard' },
  social_media:{ icon: Share2, color: BRAND.lightBlue, label: 'Social Media' },
  email:       { icon: TrendingUp,color: BRAND.silver, label: 'Email' },
  other:       { icon: TrendingUp,color: BRAND.silver, label: 'Other' },
};

function BudgetBar({ spent, budget }) {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const color = pct > 90 ? '#e74c3c' : pct > 70 ? '#f39c12' : '#27ae60';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: BRAND.silver, marginBottom: 3 }}>
        <span>TZS {parseInt(spent||0).toLocaleString()} spent</span>
        <span>of TZS {parseInt(budget||0).toLocaleString()}</span>
      </div>
      <div style={{ height: 6, background: `${BRAND.silver}14`, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: color, width: `${pct}%`, borderRadius: 3, transition: 'width 0.5s' }}/>
      </div>
    </div>
  );
}

function CampaignCard({ c, onEdit }) {
  const meta = TYPE_META[c.type] || TYPE_META.other;
  const Icon = meta.icon;
  const roi  = c.conversions > 0 && c.spent > 0 ? ((c.conversions * 500000 - c.spent) / c.spent * 100).toFixed(0) : null;
  const cpl  = c.leads_generated > 0 ? (c.spent / c.leads_generated).toFixed(0) : null;

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderTop: `3px solid ${meta.color}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: meta.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={17} color={meta.color}/>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.black }}>{c.name}</div>
            <div style={{ fontSize: 11, color: BRAND.silver }}>{meta.label}{c.campus_name ? ' · ' + c.campus_name : ' · All campuses'}{c.slug ? ` · ${c.slug}` : ''}</div>
          </div>
        </div>
        <Badge status={c.status} />
      </div>

      <BudgetBar spent={c.spent} budget={c.budget} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14 }}>
        {[
          { label: 'Leads', value: c.leads_generated || 0 },
          { label: 'Conversions', value: c.conversions || 0 },
          { label: 'Cost/Lead', value: cpl ? `TZS ${parseInt(cpl).toLocaleString()}` : '—' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center', background: `${BRAND.silver}14`, borderRadius: 7, padding: '8px 4px' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: BRAND.black }}>{s.value}</div>
            <div style={{ fontSize: 10, color: BRAND.silver }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Type-specific details */}
      {c.type === 'radio' && c.station_name && <div style={{ marginTop: 12, fontSize: 12, color: BRAND.silver }}>📻 {c.station_name}{c.air_times ? ' · ' + c.air_times : ''}</div>}
      {c.type === 'billboard' && c.location_desc && <div style={{ marginTop: 12, fontSize: 12, color: BRAND.silver }}>📍 {c.location_desc}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <Btn variant="secondary" small onClick={() => onEdit(c)}>Edit</Btn>
      </div>
    </div>
  );
}

export default function Campaigns() {
  const { user } = useAuthStore();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('all');
  const [addOpen, setAddOpen]     = useState(false);
  const [editing, setEditing]     = useState(null);
  const [campuses, setCampuses]   = useState([]);
  const [form, setForm]           = useState({ name:'', type:'radio', description:'', start_date:'', end_date:'', budget:'', campus_id:'', station_name:'', air_times:'', location_desc:'', platform:'facebook', status:'active' });

  const campusId = useCampusFilterStore((s) => s.campusId);

  useEffect(() => { fetchAll(); }, [campusId]);

  async function fetchAll() {
    try {
      const [c, camp] = await Promise.all([api.get(`/marketing/campaigns${campusSearchParams(campusId)}`), api.get('/admin/campuses')]);
      setCampaigns(c.data); setCampuses(camp.data);
    } catch { toast.error('Failed to load campaigns.'); }
    finally { setLoading(false); }
  }

  function openEdit(c) {
    setEditing(c);
    setForm({ ...c, campus_id: c.campus_id || '', budget: c.budget || '', spent: c.spent || '' });
    setAddOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    try {
      if (editing) { await api.patch(`/marketing/campaigns/${editing.id}`, form); }
      else          { await api.post('/marketing/campaigns', form); }
      toast.success(editing ? 'Campaign updated.' : 'Campaign created.');
      setAddOpen(false); setEditing(null);
      setForm({ name:'', type:'radio', description:'', start_date:'', end_date:'', budget:'', campus_id:'', station_name:'', air_times:'', location_desc:'', platform:'facebook', status:'active' });
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save.'); }
  }

  const TABS = [
    { key: 'all',          label: 'All' },
    { key: 'radio',        label: '📻 Radio' },
    { key: 'billboard',    label: '📍 Billboard' },
    { key: 'social_media', label: '📱 Social' },
  ];

  const filtered = tab === 'all' ? campaigns : campaigns.filter(c => c.type === tab);

  if (loading) return <Layout module="marketing"><Spinner /></Layout>;

  return (
    <Layout module="marketing">
      <PageHeader
        title="Campaigns"
        sub={`${campaigns.length} campaigns`}
        action={<Btn onClick={() => { setEditing(null); setAddOpen(true); }}><Plus size={15}/>New Campaign</Btn>}
      />

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Budget',  value: `TZS ${(campaigns.reduce((s,c)=>s+parseFloat(c.budget||0),0)/1e6).toFixed(1)}M`, icon: DollarSign, color: BRAND.electricBlue },
          { label: 'Total Spent',   value: `TZS ${(campaigns.reduce((s,c)=>s+parseFloat(c.spent||0),0)/1e6).toFixed(1)}M`,  icon: TrendingUp, color: BRAND.gold },
          { label: 'Total Leads',   value: campaigns.reduce((s,c)=>s+(c.leads_generated||0),0), icon: TrendingUp, color: BRAND.lightBlue },
          { label: 'Conversions',   value: campaigns.reduce((s,c)=>s+(c.conversions||0),0),     icon: TrendingUp, color: BRAND.silver },
        ].map(k => (
          <div key={k.label} style={{ background: 'white', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 12, color: BRAND.silver, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: BRAND.black }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            background: tab === t.key ? BRAND.electricBlue : `${BRAND.silver}14`,
            color: tab === t.key ? 'white' : BRAND.silver,
          }}>{t.label} <span style={{ opacity: 0.7, fontSize: 11 }}>({tab === t.key ? filtered.length : campaigns.filter(c => t.key==='all'?true:c.type===t.key).length})</span></button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Empty icon={TrendingUp} title="No campaigns" sub={`No ${tab === 'all' ? '' : tab + ' '}campaigns yet.`} action={<Btn onClick={() => setAddOpen(true)}>Create first campaign</Btn>}/>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: 16 }}>
          {filtered.map(c => <CampaignCard key={c.id} c={c} onEdit={openEdit}/>)}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={addOpen} onClose={() => { setAddOpen(false); setEditing(null); }} title={editing ? 'Edit Campaign' : 'New Campaign'} width={600}>
        <form onSubmit={save}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Campaign Name" required><Input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required /></Field>
            <Field label="Type" required>
              <Select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}>
                {['radio','billboard','social_media','email','whatsapp','event','other'].map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
              </Select>
            </Field>
            {!user?.campusId && <Field label="Campus"><Select value={form.campus_id} onChange={e => setForm(f=>({...f,campus_id:e.target.value}))}>
              <option value="">All campuses</option>
              {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select></Field>}
            <Field label="Status"><Select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}>
              {['draft','active','paused','completed'].map(s => <option key={s} value={s}>{s}</option>)}
            </Select></Field>
            <Field label="Start Date"><Input type="date" value={form.start_date} onChange={e => setForm(f=>({...f,start_date:e.target.value}))} /></Field>
            <Field label="End Date"><Input type="date" value={form.end_date} onChange={e => setForm(f=>({...f,end_date:e.target.value}))} /></Field>
            <Field label="UTM / apply slug" hint="Used on /apply?utm_campaign=">
              <Input value={form.slug || ''} onChange={e => setForm(f=>({...f,slug:e.target.value}))} placeholder="october-2026-intake" />
            </Field>
            <Field label="Budget (TZS)"><Input type="number" value={form.budget} onChange={e => setForm(f=>({...f,budget:e.target.value}))} /></Field>
            {editing && <Field label="Spent So Far (TZS)"><Input type="number" value={form.spent} onChange={e => setForm(f=>({...f,spent:e.target.value}))} /></Field>}
            {form.type === 'radio'     && <><Field label="Station Name"><Input value={form.station_name} onChange={e => setForm(f=>({...f,station_name:e.target.value}))} /></Field><Field label="Air Times"><Input value={form.air_times} onChange={e => setForm(f=>({...f,air_times:e.target.value}))} /></Field></>}
            {form.type === 'billboard' && <Field label="Location Description"><Input value={form.location_desc} onChange={e => setForm(f=>({...f,location_desc:e.target.value}))} /></Field>}
            {form.type === 'social_media' && <Field label="Platform"><Select value={form.platform} onChange={e => setForm(f=>({...f,platform:e.target.value}))}>
              {['facebook','instagram','tiktok','twitter','youtube'].map(p=><option key={p} value={p}>{p}</option>)}
            </Select></Field>}
          </div>
          <Field label="Description"><Textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} /></Field>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
            <Btn type="submit">{editing ? 'Save Changes' : 'Create Campaign'}</Btn>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
