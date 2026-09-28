// All Dispensary pages

import { useEffect, useState } from 'react';
import { Plus, Pill, AlertTriangle, CheckCircle, FileText, BarChart2, Activity } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../utils/api';
import Layout from '../../components/shared/Layout';
import { KpiCard, Section, PageHeader, Btn, Badge, Modal, Field, Input, Select, Textarea, Table, PeriodToggle, Spinner, Empty, StudentPicker, ExportMenu } from '../../components/shared/UI';
import ProfileBase from '../../components/shared/ProfileBase';
import { useSocket } from '../../hooks/useSocket';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { BRAND } from '../../theme';
// Loaded on demand (not statically) — jsPDF/xlsx/docx are ~1MB combined, and most
// visits to this page never click Export.

// ── DISPENSARY DASHBOARD ──────────────────────────────────────
export function DispensaryDashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveVisits, setLiveVisits] = useState([]);

  useSocket({
    'dispensary-emergency': (d) => {
      setLiveVisits(prev => [{ ...d, ts: Date.now(), type: 'emergency' }, ...prev].slice(0, 3));
      toast.error(`🚨 Emergency: ${d.studentName}`, { duration: 10000 });
    },
    'low-stock-alert': (d) => {
      toast.custom(() => (
        <div style={{ background: '#fff7ed', border: '1px solid #f39c12', padding: '10px 14px', borderRadius: 8 }}>
          ⚠️ Low stock: {d.drugs?.map(x => x.drug_name).join(', ')}
        </div>
      ), { duration: 6000 });
    },
  });

  useEffect(() => { fetchDashboard(); }, []);

  async function fetchDashboard() {
    try { const r = await api.get('/dispensary/dashboard'); setData(r.data); }
    catch { toast.error('Failed to load dashboard.'); }
    finally { setLoading(false); }
  }

  if (loading) return <Layout module="dispensary"><Spinner /></Layout>;

  const today    = data?.today || {};
  const inv      = data?.inventory || {};
  const lowStock = data?.lowStock || [];
  const expiring = data?.expiring || [];
  const chronic  = data?.chronic || [];
  const quotations = data?.quotations || [];
  const topComplaints = data?.topComplaints || [];

  const expiringCount = expiring.filter(d => d.days_until_expiry <= 30).length;

  return (
    <Layout module="dispensary">
      {/* Live emergency banner */}
      {liveVisits.length > 0 && (
        <div style={{ background: '#7f0000', color: 'white', padding: '10px 16px', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={16}/><span style={{ fontWeight: 600, fontSize: 13 }}>🚨 Emergency: {liveVisits[0].studentName} — {liveVisits[0].complaint?.slice(0, 60)}</span>
          <button onClick={() => setLiveVisits([])} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
      )}

      <PageHeader title="Dispensary Dashboard" sub="Today's activity and inventory status" />

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard icon={Activity}      label="Visits Today"     value={today.total || 0}          sub={`${today.emergencies || 0} emergencies`} color={BRAND.electricBlue} />
        <KpiCard icon={AlertTriangle} label="Low Stock Items"  value={inv.low_count || 0}         sub="Below minimum"                          color="#e74c3c" />
        <KpiCard icon={Pill}          label="Expiring ≤30 Days" value={expiringCount}             sub="Needs attention"                        color="#e67e22" />
        <KpiCard icon={FileText}      label="Pending Quotations" value={quotations.filter(q=>q.status==='pending').length} sub="Awaiting SE approval" color="#c9a84c" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Low stock */}
        <Section title="⚠️ Low Stock Drugs" action={<a href="/dispensary/inventory" style={{ fontSize:12,color:BRAND.electricBlue,textDecoration:'none',fontWeight:600 }}>Manage →</a>}>
          {lowStock.length === 0 ? <div style={{ textAlign:'center',padding:24,color:BRAND.silver }}><CheckCircle size={28} style={{ opacity:0.4,marginBottom:8 }}/><div>All stock levels OK</div></div> :
            lowStock.map(d => (
              <div key={d.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${BRAND.silver}26` }}>
                <div>
                  <div style={{ fontSize:13,fontWeight:600,color:BRAND.black }}>{d.drug_name}</div>
                  <div style={{ fontSize:11,color:BRAND.silver }}>{d.campus_name}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:14,fontWeight:700,color:'#e74c3c' }}>{d.quantity}</div>
                  <div style={{ fontSize:10,color:BRAND.silver }}>min: {d.minimum_stock}</div>
                </div>
              </div>
            ))
          }
        </Section>

        {/* Top complaints */}
        <Section title="Most Common Complaints — Last 30 Days">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topComplaints.slice(0,8)} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fontSize:11 }}/>
              <YAxis type="category" dataKey="complaint" width={120} tick={{ fontSize:10 }}/>
              <Tooltip/>
              <Bar dataKey="count" fill={BRAND.electricBlue} radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Expiry alerts */}
      {expiring.length > 0 && (
        <Section title="Drug Expiry Alerts">
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10 }}>
            {expiring.map(d => (
              <div key={d.id} style={{ background: d.days_until_expiry<=30?'#fef2f2':d.days_until_expiry<=60?'#fff7ed':'#f0fdf4', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ fontSize:13,fontWeight:700,color:BRAND.black }}>{d.drug_name}</div>
                <div style={{ fontSize:11,color:BRAND.silver }}>Qty: {d.quantity} · {d.campus_name}</div>
                <div style={{ fontSize:12,fontWeight:600, color: d.days_until_expiry<=30?'#e74c3c':d.days_until_expiry<=60?'#e67e22':'#27ae60', marginTop:4 }}>
                  {d.days_until_expiry} days left
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Chronic flags */}
      {chronic.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Section title="🔴 Chronic Visit Flags (unacknowledged)">
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:10 }}>
              {chronic.map(c => (
                <div key={c.id} style={{ background:'#fef2f2',borderRadius:8,padding:'12px 14px',borderLeft:'3px solid #e74c3c' }}>
                  <div style={{ fontSize:13,fontWeight:700,color:BRAND.black }}>{c.first_name} {c.last_name}</div>
                  <div style={{ fontSize:12,color:BRAND.silver }}>Complaint: {c.complaint}</div>
                  <div style={{ fontSize:11,color:BRAND.silver,marginTop:2 }}>{c.visit_count} visits in 30 days · {c.campus_name}</div>
                  <Btn type="button" variant="secondary" small style={{ marginTop:8 }}
                    onClick={() => api.patch(`/dispensary/chronic/${c.id}/acknowledge`).then(() => { toast.success('Acknowledged.'); fetchDashboard(); })}>
                    Acknowledge
                  </Btn>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}
    </Layout>
  );
}

// ── VISITS ────────────────────────────────────────────────────
export function Visits() {
  const { user } = useAuthStore();
  const [visits, setVisits]     = useState([]);
  const [drugs, setDrugs]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [addOpen, setAddOpen]   = useState(false);
  const [dispensed, setDispensed] = useState([{ drug_id:'', quantity:1, instructions:'' }]);
  const [form, setForm] = useState({ student_id:'', visit_type:'walk_in', complaint:'', diagnosis:'', prescription:'', temperature:'', blood_pressure:'', weight:'', is_emergency:false, remarks:'' });

  useEffect(() => {
    Promise.all([api.get('/dispensary/visits'), api.get('/dispensary/inventory')]).then(([v, d]) => { setVisits(v.data); setDrugs(d.data); setLoading(false); });
  }, []);

  function addDrug()  { setDispensed(d => [...d, { drug_id:'', quantity:1, instructions:'' }]); }
  function rmDrug(i)  { setDispensed(d => d.filter((_,j)=>j!==i)); }
  function updDrug(i, k, v) { setDispensed(d => d.map((x,j)=>j===i?{...x,[k]:v}:x)); }

  async function save(e) {
    e.preventDefault();
    if (!form.student_id) { toast.error('Please select a student.'); return; }
    try {
      await api.post('/dispensary/visits', { ...form, campus_id: user?.campusId, drugs_dispensed: dispensed.filter(d=>d.drug_id) });
      toast.success('Visit recorded.');
      setAddOpen(false);
      setForm({ student_id:'', visit_type:'walk_in', complaint:'', diagnosis:'', prescription:'', temperature:'', blood_pressure:'', weight:'', is_emergency:false, remarks:'' });
      setDispensed([{ drug_id:'', quantity:1, instructions:'' }]);
      api.get('/dispensary/visits').then(r=>setVisits(r.data));
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to record visit.'); }
  }

  const cols = [
    { key:'visit_date', label:'Date', render:r=>new Date(r.visit_date).toLocaleDateString('en-GB') },
    { key:'name', label:'Student', render:r=>`${r.first_name} ${r.last_name}` },
    { key:'class_name', label:'Class' },
    { key:'visit_type', label:'Type', render:r=><Badge status={r.is_emergency?'emergency':'low'} label={r.is_emergency?'Emergency':r.visit_type?.replace('_',' ')}/> },
    { key:'complaint', label:'Complaint', render:r=>r.complaint?.slice(0,50) },
    { key:'campus_name', label:'Campus' },
  ];

  if (loading) return <Layout module="dispensary"><Spinner /></Layout>;

  return (
    <Layout module="dispensary">
      <PageHeader title="Patient Visits" sub={`${visits.length} records`} action={<Btn onClick={()=>setAddOpen(true)}><Plus size={15}/>New Visit</Btn>}/>
      <div style={{ background:'white',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.07)',overflow:'hidden' }}>
        <Table cols={cols} rows={visits} keyFn={r=>r.id}/>
      </div>
      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title="Record Patient Visit" width={660}>
        <form onSubmit={save}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <Field label="Student" required><StudentPicker basePath="/dispensary" onSelect={s=>setForm(f=>({...f,student_id:s?.id||''}))} /></Field>
            <Field label="Visit Type"><Select value={form.visit_type} onChange={e=>setForm(f=>({...f,visit_type:e.target.value}))}>
              {['walk_in','follow_up','emergency','routine_check'].map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
            </Select></Field>
            <Field label="Temperature (°C)"><Input type="number" step="0.1" value={form.temperature} onChange={e=>setForm(f=>({...f,temperature:e.target.value}))}/></Field>
            <Field label="Blood Pressure"><Input placeholder="e.g. 120/80" value={form.blood_pressure} onChange={e=>setForm(f=>({...f,blood_pressure:e.target.value}))}/></Field>
            <Field label="Weight (kg)"><Input type="number" step="0.1" value={form.weight} onChange={e=>setForm(f=>({...f,weight:e.target.value}))}/></Field>
          </div>
          <Field label="Complaint" required><Textarea required value={form.complaint} onChange={e=>setForm(f=>({...f,complaint:e.target.value}))} rows={2}/></Field>
          <Field label="Diagnosis"><Textarea value={form.diagnosis} onChange={e=>setForm(f=>({...f,diagnosis:e.target.value}))} rows={2}/></Field>
          <Field label="Prescription"><Textarea value={form.prescription} onChange={e=>setForm(f=>({...f,prescription:e.target.value}))} rows={2}/></Field>

          {/* Drugs dispensed */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontWeight:700,fontSize:14,color:BRAND.black,marginBottom:10 }}>Drugs Dispensed</div>
            {dispensed.map((d,i) => (
              <div key={i} style={{ display:'grid',gridTemplateColumns:'2fr 1fr 2fr auto',gap:8,marginBottom:8,alignItems:'center' }}>
                <Select value={d.drug_id} onChange={e=>updDrug(i,'drug_id',e.target.value)}>
                  <option value="">Select drug</option>
                  {drugs.map(dr=><option key={dr.id} value={dr.id}>{dr.drug_name} (qty: {dr.quantity})</option>)}
                </Select>
                <Input type="number" min="1" value={d.quantity} onChange={e=>updDrug(i,'quantity',e.target.value)} placeholder="Qty"/>
                <Input placeholder="Dosage instructions" value={d.instructions} onChange={e=>updDrug(i,'instructions',e.target.value)}/>
                <button type="button" onClick={()=>rmDrug(i)} style={{ background:'none',border:'none',cursor:'pointer',color:'#e74c3c',fontSize:18 }}>×</button>
              </div>
            ))}
            <Btn type="button" variant="secondary" small onClick={addDrug}><Plus size={13}/>Add Drug</Btn>
          </div>

          <label style={{ display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer',marginBottom:16 }}>
            <input type="checkbox" style={{ width:15,height:15 }} checked={form.is_emergency} onChange={e=>setForm(f=>({...f,is_emergency:e.target.checked}))}/>
            <span style={{ color:'#e74c3c',fontWeight:600 }}>⚠️ Mark as emergency — will notify parents and SE heads immediately</span>
          </label>

          <Field label="Additional Remarks"><Textarea value={form.remarks} onChange={e=>setForm(f=>({...f,remarks:e.target.value}))} rows={2}/></Field>
          <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:8 }}>
            <Btn variant="secondary" onClick={()=>setAddOpen(false)}>Cancel</Btn>
            <Btn type="submit" style={form.is_emergency?{ background:'#e74c3c' }:{}}>Record Visit</Btn>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}

// ── INVENTORY ─────────────────────────────────────────────────
export function Inventory() {
  const { user } = useAuthStore();
  const [inventory, setInventory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [form, setForm] = useState({ drug_name:'', category_id:'', quantity:'', unit:'tablets', expiry_date:'', minimum_stock:'10', reorder_quantity:'50', storage_location:'', supplier:'' });
  const [purchaseForm, setPurchaseForm] = useState({ quantity_purchased:'', unit_cost:'', supplier:'', invoice_number:'' });

  useEffect(() => {
    Promise.all([api.get('/dispensary/inventory'), api.get('/dispensary/categories')]).then(([i,c])=>{ setInventory(i.data); setCategories(c.data); setLoading(false); });
  }, []);

  async function addDrug(e) {
    e.preventDefault();
    try { await api.post('/dispensary/inventory', { ...form, campus_id: user?.campusId }); toast.success('Drug added.'); setAddOpen(false); api.get('/dispensary/inventory').then(r=>setInventory(r.data)); }
    catch { toast.error('Failed.'); }
  }

  async function recordPurchase(e) {
    e.preventDefault();
    try { await api.post('/dispensary/purchases', { ...purchaseForm, drug_id: selectedDrug?.id }); toast.success('Purchase recorded.'); setPurchaseOpen(false); api.get('/dispensary/inventory').then(r=>setInventory(r.data)); }
    catch { toast.error('Failed.'); }
  }

  const statusIcon = (d) => {
    if (d.expired) return { label: 'Expired', color: '#7f0000' };
    if (d.low_stock) return { label: 'Low Stock', color: '#e74c3c' };
    if (d.expiring_soon) return { label: 'Expiring Soon', color: '#f39c12' };
    return { label: 'OK', color: '#27ae60' };
  };

  if (loading) return <Layout module="dispensary"><Spinner /></Layout>;

  return (
    <Layout module="dispensary">
      <PageHeader title="Drug Inventory" sub={`${inventory.length} drugs · ${inventory.filter(d=>d.low_stock).length} low stock`} action={<Btn onClick={()=>setAddOpen(true)}><Plus size={15}/>Add Drug</Btn>}/>
      <div style={{ background:'white',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.07)',overflow:'hidden' }}>
        <Table cols={[
          { key:'drug_name', label:'Drug Name' },
          { key:'category_name', label:'Category' },
          { key:'quantity', label:'Qty', render:r=><span style={{ fontWeight:700,color:r.low_stock?'#e74c3c':BRAND.black }}>{r.quantity}</span> },
          { key:'unit', label:'Unit' },
          { key:'minimum_stock', label:'Min Stock' },
          { key:'expiry_date', label:'Expiry', render:r=>r.expiry_date?new Date(r.expiry_date).toLocaleDateString('en-GB'):'—' },
          { key:'status', label:'Status', render:r=>{ const s=statusIcon(r); return <Badge status={s.label.toLowerCase().replace(' ','_')} label={s.label}/>; } },
          { key:'storage_location', label:'Location' },
          { key:'actions', label:'', render:r=><Btn small variant="secondary" onClick={()=>{ setSelectedDrug(r); setPurchaseOpen(true); }}>Record Purchase</Btn> },
        ]} rows={inventory} keyFn={r=>r.id}/>
      </div>

      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title="Add Drug to Inventory">
        <form onSubmit={addDrug}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <Field label="Drug Name" required><Input value={form.drug_name} onChange={e=>setForm(f=>({...f,drug_name:e.target.value}))} required /></Field>
            <Field label="Category"><Select value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}>
              <option value="">Select category</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </Select></Field>
            <Field label="Initial Quantity"><Input type="number" value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))}/></Field>
            <Field label="Unit"><Input value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))} placeholder="tablets, bottles…"/></Field>
            <Field label="Expiry Date"><Input type="date" value={form.expiry_date} onChange={e=>setForm(f=>({...f,expiry_date:e.target.value}))}/></Field>
            <Field label="Minimum Stock"><Input type="number" value={form.minimum_stock} onChange={e=>setForm(f=>({...f,minimum_stock:e.target.value}))}/></Field>
            <Field label="Storage Location"><Input value={form.storage_location} onChange={e=>setForm(f=>({...f,storage_location:e.target.value}))}/></Field>
            <Field label="Supplier"><Input value={form.supplier} onChange={e=>setForm(f=>({...f,supplier:e.target.value}))}/></Field>
          </div>
          <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:8 }}>
            <Btn variant="secondary" onClick={()=>setAddOpen(false)}>Cancel</Btn>
            <Btn type="submit">Add Drug</Btn>
          </div>
        </form>
      </Modal>

      <Modal open={purchaseOpen} onClose={()=>setPurchaseOpen(false)} title={`Record Purchase — ${selectedDrug?.drug_name}`}>
        <form onSubmit={recordPurchase}>
          <Field label="Quantity Purchased" required><Input type="number" value={purchaseForm.quantity_purchased} onChange={e=>setPurchaseForm(f=>({...f,quantity_purchased:e.target.value}))} required /></Field>
          <Field label="Unit Cost (TZS)"><Input type="number" value={purchaseForm.unit_cost} onChange={e=>setPurchaseForm(f=>({...f,unit_cost:e.target.value}))}/></Field>
          <Field label="Supplier"><Input value={purchaseForm.supplier} onChange={e=>setPurchaseForm(f=>({...f,supplier:e.target.value}))}/></Field>
          <Field label="Invoice Number"><Input value={purchaseForm.invoice_number} onChange={e=>setPurchaseForm(f=>({...f,invoice_number:e.target.value}))}/></Field>
          <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:8 }}>
            <Btn variant="secondary" onClick={()=>setPurchaseOpen(false)}>Cancel</Btn>
            <Btn type="submit">Record Purchase</Btn>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}

// ── REFERRALS ─────────────────────────────────────────────────
export function Referrals() {
  const { user } = useAuthStore();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(null);
  const [form, setForm] = useState({ student_id:'', reason:'', referred_to:'', expected_return_date:'' });

  useEffect(() => { api.get('/dispensary/referrals').then(r=>{ setReferrals(r.data); setLoading(false); }); }, []);

  async function save(e) {
    e.preventDefault();
    if (!form.student_id) { toast.error('Please select a student.'); return; }
    try { await api.post('/dispensary/referrals', { ...form, campus_id: user?.campusId }); toast.success('Referral logged.'); setAddOpen(false); api.get('/dispensary/referrals').then(r=>setReferrals(r.data)); }
    catch { toast.error('Failed.'); }
  }

  async function recordOutcome(id, outcome, status) {
    try { await api.patch(`/dispensary/referrals/${id}`, { outcome, status, outcome_date: new Date().toISOString().slice(0,10) }); toast.success('Outcome recorded.'); setOutcomeOpen(null); api.get('/dispensary/referrals').then(r=>setReferrals(r.data)); }
    catch { toast.error('Failed.'); }
  }

  if (loading) return <Layout module="dispensary"><Spinner /></Layout>;

  return (
    <Layout module="dispensary">
      <PageHeader title="Hospital Referrals" sub={`${referrals.length} referrals`} action={<Btn onClick={()=>setAddOpen(true)}><Plus size={15}/>Log Referral</Btn>}/>
      <div style={{ background:'white',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.07)',overflow:'hidden' }}>
        <Table cols={[
          { key:'referral_date', label:'Date', render:r=>new Date(r.referral_date).toLocaleDateString('en-GB') },
          { key:'name', label:'Student', render:r=>`${r.first_name} ${r.last_name}` },
          { key:'referred_to', label:'Referred To' },
          { key:'reason', label:'Reason', render:r=>r.reason?.slice(0,60) },
          { key:'expected_return_date', label:'Expected Return', render:r=>r.expected_return_date?new Date(r.expected_return_date).toLocaleDateString('en-GB'):'—' },
          { key:'status', label:'Status', render:r=><Badge status={r.status}/> },
          { key:'actions', label:'', render:r=>r.status==='pending'&&<Btn small variant="secondary" onClick={()=>setOutcomeOpen(r)}>Record Outcome</Btn> },
        ]} rows={referrals} keyFn={r=>r.id}/>
      </div>
      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title="Log Hospital Referral">
        <form onSubmit={save}>
          <Field label="Student" required><StudentPicker basePath="/dispensary" onSelect={s=>setForm(f=>({...f,student_id:s?.id||''}))} /></Field>
          <Field label="Reason for Referral" required><Textarea value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} required rows={2}/></Field>
          <Field label="Referred To (Hospital/Specialist)" required><Input value={form.referred_to} onChange={e=>setForm(f=>({...f,referred_to:e.target.value}))} required /></Field>
          <Field label="Expected Return Date"><Input type="date" value={form.expected_return_date} onChange={e=>setForm(f=>({...f,expected_return_date:e.target.value}))}/></Field>
          <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:8 }}>
            <Btn variant="secondary" onClick={()=>setAddOpen(false)}>Cancel</Btn>
            <Btn type="submit">Log Referral</Btn>
          </div>
        </form>
      </Modal>
      {outcomeOpen && (
        <Modal open={!!outcomeOpen} onClose={()=>setOutcomeOpen(null)} title="Record Outcome">
          <p style={{ fontSize:13,color:BRAND.silver,marginBottom:16 }}>Recording outcome for {outcomeOpen.first_name} {outcomeOpen.last_name} referred to {outcomeOpen.referred_to}</p>
          <OutcomeForm onSave={(outcome,status)=>recordOutcome(outcomeOpen.id,outcome,status)} onCancel={()=>setOutcomeOpen(null)}/>
        </Modal>
      )}
    </Layout>
  );
}

function OutcomeForm({ onSave, onCancel }) {
  const [outcome, setOutcome] = useState('');
  const [status, setStatus]   = useState('returned');
  return (
    <form onSubmit={e=>{ e.preventDefault(); onSave(outcome,status); }}>
      <Field label="Outcome Notes" required><Textarea value={outcome} onChange={e=>setOutcome(e.target.value)} required rows={3}/></Field>
      <Field label="Status"><Select value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="returned">Returned to school</option>
        <option value="lost_to_followup">Lost to follow-up</option>
        <option value="pending">Still pending</option>
      </Select></Field>
      <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:8 }}>
        <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
        <Btn type="submit">Save Outcome</Btn>
      </div>
    </form>
  );
}

// ── QUOTATIONS ────────────────────────────────────────────────
export function Quotations() {
  const { user } = useAuthStore();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [items, setItems] = useState([{ drug_name:'', quantity_needed:'', unit:'tablets', estimated_unit_cost:'', notes:'' }]);
  const [form, setForm] = useState({ title:'', notes:'' });

  useEffect(() => { api.get('/dispensary/quotations').then(r=>{ setQuotations(r.data); setLoading(false); }); }, []);

  function addItem() { setItems(i=>[...i, { drug_name:'', quantity_needed:'', unit:'tablets', estimated_unit_cost:'', notes:'' }]); }
  function rmItem(i) { setItems(x=>x.filter((_,j)=>j!==i)); }
  function updItem(i,k,v) { setItems(x=>x.map((r,j)=>j===i?{...r,[k]:v}:r)); }

  const totalEstimated = items.reduce((s,i)=>s+(parseFloat(i.estimated_unit_cost||0)*parseInt(i.quantity_needed||0)),0);

  async function save(e) {
    e.preventDefault();
    try { await api.post('/dispensary/quotations', { ...form, items }); toast.success('Quotation submitted. SE Head will be notified.'); setAddOpen(false); api.get('/dispensary/quotations').then(r=>setQuotations(r.data)); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed.'); }
  }

  if (loading) return <Layout module="dispensary"><Spinner /></Layout>;

  return (
    <Layout module="dispensary">
      <PageHeader title="Drug Quotations" sub={`${quotations.length} total · ${quotations.filter(q=>q.status==='pending').length} pending`} action={<Btn onClick={()=>setAddOpen(true)}><Plus size={15}/>New Quotation</Btn>}/>
      <div style={{ display:'grid',gap:12 }}>
        {quotations.map(q => (
          <div key={q.id} style={{ background:'white',borderRadius:10,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,0.07)',borderLeft:`3px solid ${q.status==='pending'?'#f39c12':q.status==='approved'?'#27ae60':'#e74c3c'}` }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:15,fontWeight:700,color:BRAND.black }}>{q.title}</div>
                <div style={{ fontSize:13,color:BRAND.silver,marginTop:2 }}>TZS {parseInt(q.total_estimated_cost||0).toLocaleString()} · {q.item_count} items</div>
                <div style={{ fontSize:11,color:BRAND.silver,marginTop:2 }}>{new Date(q.created_at).toLocaleDateString('en-GB')}</div>
              </div>
              <Badge status={q.status}/>
            </div>
            {q.review_notes && <div style={{ marginTop:12,padding:'8px 12px',background:`${BRAND.silver}14`,borderRadius:6,fontSize:12,color:BRAND.silver }}><strong>Review note:</strong> {q.review_notes}</div>}
          </div>
        ))}
        {quotations.length===0&&<Empty icon={FileText} title="No quotations" sub="Submit a quotation for drug procurement approval."/>}
      </div>

      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title="New Drug Quotation" width={680}>
        <form onSubmit={save}>
          <Field label="Quotation Title" required><Input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required /></Field>
          <Field label="Notes"><Textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2}/></Field>
          <div style={{ fontWeight:700,fontSize:14,color:BRAND.black,marginBottom:10 }}>Drug Items</div>
          {items.map((item,i) => (
            <div key={i} style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:8,marginBottom:8,alignItems:'center' }}>
              <Input placeholder="Drug name" value={item.drug_name} onChange={e=>updItem(i,'drug_name',e.target.value)}/>
              <Input type="number" placeholder="Qty" value={item.quantity_needed} onChange={e=>updItem(i,'quantity_needed',e.target.value)}/>
              <Input placeholder="Unit" value={item.unit} onChange={e=>updItem(i,'unit',e.target.value)}/>
              <Input type="number" placeholder="Unit cost TZS" value={item.estimated_unit_cost} onChange={e=>updItem(i,'estimated_unit_cost',e.target.value)}/>
              <button type="button" onClick={()=>rmItem(i)} style={{ background:'none',border:'none',cursor:'pointer',color:'#e74c3c',fontSize:18 }}>×</button>
            </div>
          ))}
          <Btn type="button" variant="secondary" small onClick={addItem} style={{ marginBottom:12 }}><Plus size={13}/>Add Item</Btn>
          <div style={{ padding:'10px 14px',background:`${BRAND.silver}14`,borderRadius:7,fontSize:14,fontWeight:700,color:BRAND.black,marginBottom:12 }}>
            Estimated Total: TZS {totalEstimated.toLocaleString()}
          </div>
          <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
            <Btn variant="secondary" onClick={()=>setAddOpen(false)}>Cancel</Btn>
            <Btn type="submit">Submit Quotation</Btn>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}

// ── DISPENSARY REPORTS ────────────────────────────────────────
export function DispensaryReports() {
  const [period, setPeriod] = useState('monthly');
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try { const r = await api.get(`/admin/reports?module=dispensary&period=${period}`); setData(r.data); }
    catch { toast.error('Failed.'); }
    finally { setLoading(false); }
  }

  function buildSections() {
    const sections = [
      {
        title: 'Visit Types',
        columns: ['Visit Type', 'Count', 'Emergency'],
        rows: (data.data?.visits || []).map(v => [v.visit_type?.replace('_', ' '), v.count, v.is_emergency ? 'Yes' : 'No']),
      },
      {
        title: 'Top Drugs Dispensed',
        columns: ['Drug', 'Total Dispensed'],
        rows: (data.data?.topDrugs || []).map(d => [d.drug_name, d.total_dispensed]),
      },
    ];
    if (data.data?.referrals) {
      sections.push({
        title: 'Referral Summary',
        stats: [
          { label: 'Total', value: data.data.referrals.total },
          { label: 'Returned', value: data.data.referrals.returned },
          { label: 'Pending', value: data.data.referrals.pending },
        ],
      });
    }
    return sections;
  }

  async function handleExport(format) {
    if (!data) return;
    const heading = `Dispensary Report — ${period}`;
    const sections = buildSections();
    const { exportReportPDF, exportReportExcel, exportReportWord } = await import('../../utils/reportExport');
    if (format === 'pdf') exportReportPDF(`dispensary-report-${period}.pdf`, heading, sections);
    else if (format === 'excel') exportReportExcel(`dispensary-report-${period}.xlsx`, heading, sections);
    else if (format === 'word') exportReportWord(`dispensary-report-${period}.docx`, heading, sections);
  }

  return (
    <Layout module="dispensary">
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24 }}>
        <h1 style={{ margin:0,fontSize:22,fontWeight:700,color:BRAND.black }}>Dispensary Reports</h1>
        <div style={{ display:'flex',gap:10 }}>
          <PeriodToggle value={period} onChange={setPeriod}/>
          <Btn onClick={generate} disabled={loading}>{loading?'Loading…':'Generate'}</Btn>
          {data && <ExportMenu onExport={handleExport} />}
        </div>
      </div>
      {data ? (
        <div style={{ display:'grid',gap:16 }}>
          <Section title="Visit Types">
            <div style={{ display:'flex',gap:12,flexWrap:'wrap' }}>
              {(data.data?.visits||[]).map(v=>(
                <div key={v.visit_type} style={{ background:`${BRAND.silver}14`,borderRadius:8,padding:'10px 16px',minWidth:120,textAlign:'center' }}>
                  <div style={{ fontSize:22,fontWeight:700,color:BRAND.black }}>{v.count}</div>
                  <div style={{ fontSize:11,color:BRAND.silver }}>{v.visit_type?.replace('_',' ')} {v.is_emergency?'(Emergency)':''}</div>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Top Drugs Dispensed">
            <Table cols={[{ key:'drug_name',label:'Drug' },{ key:'total_dispensed',label:'Total Dispensed' }]} rows={data.data?.topDrugs||[]} keyFn={r=>r.drug_name}/>
          </Section>
          <Section title="Referral Summary">
            {data.data?.referrals && <div style={{ display:'flex',gap:24,fontSize:14 }}>
              <div>Total: <strong>{data.data.referrals.total}</strong></div>
              <div>Returned: <strong style={{ color:'#27ae60' }}>{data.data.referrals.returned}</strong></div>
              <div>Pending: <strong style={{ color:'#f39c12' }}>{data.data.referrals.pending}</strong></div>
            </div>}
          </Section>
        </div>
      ) : (
        <div style={{ textAlign:'center',padding:80,color:BRAND.silver }}>
          <BarChart2 size={48} style={{ opacity:0.3,marginBottom:12 }}/>
          <div>Select a period and click Generate.</div>
        </div>
      )}
    </Layout>
  );
}

// ── DISPENSARY PROFILE ────────────────────────────────────────
export function DispensaryProfile() { return <Layout module="dispensary"><ProfileBase module="dispensary"/></Layout>; }

export default DispensaryDashboard;
