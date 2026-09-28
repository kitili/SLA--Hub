// SE Walkthroughs, Behaviour, EventReports, DispensaryView, Calendar, Team, Reports, Profile

import { useEffect, useState } from 'react';
import { Plus, Shield, AlertTriangle, FileText, UserPlus, BarChart2, ChevronLeft, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../utils/api';
import Layout from '../../components/shared/Layout';
import { PageHeader, Btn, Badge, Modal, Field, Input, Select, Textarea, Table, Section, KpiCard, Spinner, PeriodToggle, Empty, StudentPicker, CampusField, ExportMenu } from '../../components/shared/UI';
import ProfileBase from '../../components/shared/ProfileBase';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { BRAND } from '../../theme';
// Loaded on demand (not statically) — jsPDF/xlsx/docx are ~1MB combined, and most
// visits to this page never click Export.

const AREAS = ['dormitories','classrooms','kitchen_canteen','toilets_bathrooms','sports_fields','science_lab','transport_bay','administration_block','medical_room','perimeter_fencing','other'];
const RISK_LEVELS = ['low','medium','high','critical'];
const SETTINGS_BW = ['classroom','break_time','dormitory','sports','assembly','canteen','transport','other'];
const INTERVENTIONS = ['verbal_warning','mediation','counselling_referral','parent_contact','isolation','commendation','other'];

// ── WALKTHROUGHS ──────────────────────────────────────────────
export function Walkthroughs() {
  const { user } = useAuthStore();
  const [walkthroughs, setWalkthroughs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState({ campus_id: '', walkthrough_date: new Date().toISOString().slice(0,10), overall_notes: '', findings: AREAS.slice(0,3).map(a => ({ area: a, condition_rating: 3, findings: '', risk_level: 'low', corrective_action: '', responsible_person: '', deadline: '' })) });

  useEffect(() => { api.get('/se/walkthroughs').then(r => { setWalkthroughs(r.data); setLoading(false); }).catch(() => setLoading(false)); }, []);

  function addArea() { setForm(f => ({ ...f, findings: [...f.findings, { area: AREAS[0], condition_rating: 3, findings: '', risk_level: 'low', corrective_action: '', responsible_person: '', deadline: '' }] })); }
  function removeArea(i) { setForm(f => ({ ...f, findings: f.findings.filter((_,j)=>j!==i) })); }
  function updateFinding(i, key, val) { setForm(f => ({ ...f, findings: f.findings.map((x,j)=>j===i?{...x,[key]:val}:x) })); }

  async function save(e) {
    e.preventDefault();
    if (form.walkthrough_date > new Date().toISOString().slice(0,10)) { toast.error('Walkthrough date cannot be in the future.'); return; }
    try {
      await api.post('/se/walkthroughs', { ...form, campus_id: user?.campusId || form.campus_id });
      toast.success('Walkthrough logged.');
      setAddOpen(false);
      api.get('/se/walkthroughs').then(r => setWalkthroughs(r.data));
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save.'); }
  }

  async function resolve(findingId) {
    try { await api.patch(`/se/walkthroughs/findings/${findingId}`, { status: 'resolved' }); toast.success('Marked resolved.'); api.get('/se/walkthroughs').then(r => setWalkthroughs(r.data)); }
    catch { toast.error('Failed.'); }
  }

  if (loading) return <Layout module="se"><Spinner /></Layout>;

  const openCount = walkthroughs.reduce((s, w) => s + parseInt(w.open_items || 0), 0);
  const critCount = walkthroughs.reduce((s, w) => s + parseInt(w.critical_open || 0), 0);

  return (
    <Layout module="se">
      <PageHeader title="Safety Walkthroughs" sub={`${walkthroughs.length} sessions · ${openCount} open items`} action={<Btn onClick={() => setAddOpen(true)}><Plus size={15}/>New Walkthrough</Btn>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <KpiCard icon={Shield} label="Total Sessions" value={walkthroughs.length} color={BRAND.electricBlue} />
        <KpiCard icon={AlertTriangle} label="Open Items" value={openCount} color="#f39c12" />
        <KpiCard icon={AlertTriangle} label="Critical Open" value={critCount} color="#e74c3c" />
      </div>

      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <Table
          cols={[
            { key: 'walkthrough_date', label: 'Date', render: r => new Date(r.walkthrough_date).toLocaleDateString('en-GB') },
            { key: 'campus_name', label: 'Campus' },
            { key: 'conducted_by_name', label: 'Conducted By' },
            { key: 'total_areas', label: 'Areas Checked' },
            { key: 'open_items', label: 'Open Items', render: r => <span style={{ color: parseInt(r.open_items)>0?'#e74c3c':'#27ae60', fontWeight: 700 }}>{r.open_items}</span> },
            { key: 'critical_open', label: 'Critical', render: r => parseInt(r.critical_open)>0 ? <Badge status="critical" label={r.critical_open}/> : <span style={{ color: BRAND.silver }}>0</span> },
            { key: 'actions', label: '', render: r => <Btn small variant="secondary" onClick={() => api.get(`/se/walkthroughs/${r.id}`).then(res=>setViewing(res.data))}>View</Btn> },
          ]}
          rows={walkthroughs} keyFn={r=>r.id}
        />
      </div>

      {/* New Walkthrough Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New Safety Walkthrough" width={700}>
        <form onSubmit={save}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <Field label="Date"><Input type="date" max={new Date().toISOString().slice(0,10)} value={form.walkthrough_date} onChange={e => setForm(f=>({...f,walkthrough_date:e.target.value}))} /></Field>
            <CampusField value={form.campus_id} onChange={v => setForm(f=>({...f,campus_id:v}))} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: BRAND.black, marginBottom: 10 }}>Area Findings</div>
            {form.findings.map((finding, i) => (
              <div key={i} style={{ background: `${BRAND.silver}14`, borderRadius: 9, padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <Select style={{ flex: 1 }} value={finding.area} onChange={e => updateFinding(i,'area',e.target.value)}>
                    {AREAS.map(a => <option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}
                  </Select>
                  <Select style={{ width: 120 }} value={finding.risk_level} onChange={e => updateFinding(i,'risk_level',e.target.value)}>
                    {RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
                  </Select>
                  <Input type="number" min="1" max="5" style={{ width: 60 }} value={finding.condition_rating} onChange={e => updateFinding(i,'condition_rating',e.target.value)} placeholder="1-5" />
                  <button type="button" onClick={() => removeArea(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', fontSize: 18 }}>×</button>
                </div>
                <Textarea rows={2} placeholder="Findings…" value={finding.findings} onChange={e => updateFinding(i,'findings',e.target.value)} style={{ marginBottom: 8 }}/>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <Input placeholder="Corrective action" value={finding.corrective_action} onChange={e => updateFinding(i,'corrective_action',e.target.value)}/>
                  <Input placeholder="Responsible person" value={finding.responsible_person} onChange={e => updateFinding(i,'responsible_person',e.target.value)}/>
                  <Input type="date" value={finding.deadline} onChange={e => updateFinding(i,'deadline',e.target.value)}/>
                </div>
              </div>
            ))}
            <Btn type="button" variant="secondary" small onClick={addArea}><Plus size={13}/>Add Area</Btn>
          </div>
          <Field label="Overall Notes"><Textarea value={form.overall_notes} onChange={e => setForm(f=>({...f,overall_notes:e.target.value}))} /></Field>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
            <Btn type="submit">Save Walkthrough</Btn>
          </div>
        </form>
      </Modal>

      {/* View walkthrough modal */}
      {viewing && (
        <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Walkthrough — ${new Date(viewing.walkthrough_date).toLocaleDateString('en-GB')}`} width={640}>
          <div style={{ marginBottom: 12, fontSize: 13, color: BRAND.silver }}>Conducted by: {viewing.conducted_by_name} · {viewing.campus_name}</div>
          {viewing.findings?.map(f => (
            <div key={f.id} style={{ background: `${BRAND.silver}14`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{f.area?.replace(/_/g,' ')}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Badge status={f.risk_level}/>
                  <Badge status={f.status}/>
                </div>
              </div>
              <div style={{ fontSize: 12, color: BRAND.silver, marginBottom: 6 }}>Rating: {f.condition_rating}/5 · {f.findings}</div>
              {f.corrective_action && <div style={{ fontSize: 12, color: BRAND.silver }}>Action: {f.corrective_action} ({f.responsible_person})</div>}
              {f.deadline && <div style={{ fontSize: 11, color: BRAND.silver }}>Due: {new Date(f.deadline).toLocaleDateString('en-GB')}</div>}
              {f.status !== 'resolved' && <Btn type="button" variant="success" small style={{ marginTop: 8 }} onClick={() => resolve(f.id)}>Mark Resolved</Btn>}
            </div>
          ))}
        </Modal>
      )}
    </Layout>
  );
}

// ── BEHAVIOUR ─────────────────────────────────────────────────
export function Behaviour() {
  const { user } = useAuthStore();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ campus_id:'', student_id:'', setting:'classroom', behaviour_categories:[], description:'', frequency:'first_time', trigger_identified:false, intervention:'verbal_warning', parent_contacted:false, escalated:false });

  useEffect(() => { api.get('/se/behaviour').then(r => { setRecords(r.data); setLoading(false); }); }, []);

  async function save(e) {
    e.preventDefault();
    if (!form.student_id) { toast.error('Please select a student.'); return; }
    try { await api.post('/se/behaviour', { ...form, campus_id: user?.campusId || form.campus_id }); toast.success('Report logged.'); setAddOpen(false); api.get('/se/behaviour').then(r => setRecords(r.data)); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to save.'); }
  }

  const cols = [
    { key: 'observed_at', label: 'Date', render: r => new Date(r.observed_at).toLocaleDateString('en-GB') },
    { key: 'name', label: 'Student', render: r => `${r.first_name} ${r.last_name}` },
    { key: 'class_name', label: 'Class' },
    { key: 'setting', label: 'Setting', render: r => r.setting?.replace('_',' ') },
    { key: 'frequency', label: 'Frequency', render: r => r.frequency?.replace('_',' ') },
    { key: 'intervention', label: 'Intervention', render: r => r.intervention?.replace('_',' ') },
    { key: 'escalated', label: 'Escalated', render: r => r.escalated ? <Badge status="critical" label="Yes"/> : <span style={{ color: BRAND.silver, fontSize: 12 }}>No</span> },
    { key: 'campus_name', label: 'Campus' },
  ];

  if (loading) return <Layout module="se"><Spinner /></Layout>;

  const BC = ['academic_engagement','peer_interaction','attitude_to_authority','emotional_regulation','language_use','physical_conduct'];

  return (
    <Layout module="se">
      <PageHeader title="Behavioural Walkthroughs" sub={`${records.length} records`} action={<Btn onClick={() => setAddOpen(true)}><Plus size={15}/>Log Behaviour</Btn>}/>
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <Table cols={cols} rows={records} keyFn={r=>r.id}/>
      </div>
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Log Behavioural Walkthrough" width={640}>
        <form onSubmit={save}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CampusField value={form.campus_id} onChange={v => setForm(f=>({...f,campus_id:v}))} />
            <Field label="Student" required><StudentPicker basePath="/se" onSelect={s=>setForm(f=>({...f,student_id:s?.id||''}))} /></Field>
            <Field label="Setting"><Select value={form.setting} onChange={e=>setForm(f=>({...f,setting:e.target.value}))}>
              {SETTINGS_BW.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </Select></Field>
            <Field label="Frequency"><Select value={form.frequency} onChange={e=>setForm(f=>({...f,frequency:e.target.value}))}>
              {['first_time','recurring','established_pattern'].map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </Select></Field>
            <Field label="Intervention"><Select value={form.intervention} onChange={e=>setForm(f=>({...f,intervention:e.target.value}))}>
              {INTERVENTIONS.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </Select></Field>
          </div>
          <Field label="Behaviour Categories">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {BC.map(c => (
                <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', padding: '4px 10px', borderRadius: 20, background: form.behaviour_categories.includes(c) ? BRAND.electricBlue : `${BRAND.silver}14`, color: form.behaviour_categories.includes(c) ? 'white' : BRAND.silver }}>
                  <input type="checkbox" style={{ display:'none' }} checked={form.behaviour_categories.includes(c)} onChange={e => setForm(f=>({ ...f, behaviour_categories: e.target.checked ? [...f.behaviour_categories,c] : f.behaviour_categories.filter(x=>x!==c) }))}/>
                  {c.replace(/_/g,' ')}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Description" required><Textarea required value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={3}/></Field>
          <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
            {[['parent_contacted','Parent contacted'],['escalated','Escalate to global head'],['trigger_identified','Trigger identified']].map(([k,label]) => (
              <label key={k} style={{ display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer' }}>
                <input type="checkbox" checked={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.checked}))}/>{label}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
            <Btn type="submit">Save Report</Btn>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}

// ── EVENT REPORTS ─────────────────────────────────────────────
export function EventReports() {
  const { user } = useAuthStore();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ campus_id:'', event_name:'', report_date:new Date().toISOString().slice(0,10), venue:'', student_count:'', staff_count:'', activities_conducted:'', engagement_level:'good', overall_rating:'4', health_safety_notes:'', recommendations:'' });

  useEffect(() => { api.get('/se/event-reports').then(r=>{ setReports(r.data); setLoading(false); }); }, []);

  async function save(e) {
    e.preventDefault();
    if (form.report_date > new Date().toISOString().slice(0,10)) { toast.error('Event report date cannot be in the future.'); return; }
    try { await api.post('/se/event-reports', { ...form, campus_id: user?.campusId || form.campus_id }); toast.success('Report saved.'); setAddOpen(false); api.get('/se/event-reports').then(r=>setReports(r.data)); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed.'); }
  }

  if (loading) return <Layout module="se"><Spinner /></Layout>;

  return (
    <Layout module="se">
      <PageHeader title="Event & Activity Reports" sub={`${reports.length} reports`} action={<Btn onClick={()=>setAddOpen(true)}><Plus size={15}/>New Report</Btn>}/>
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <Table cols={[
          { key:'event_name', label:'Event' },
          { key:'report_date', label:'Date', render:r=>new Date(r.report_date).toLocaleDateString('en-GB') },
          { key:'student_count', label:'Students' },
          { key:'supervision_ratio', label:'Ratio', render:r=>`1:${r.supervision_ratio||'?'}` },
          { key:'engagement_level', label:'Engagement', render:r=><Badge status={r.engagement_level||'good'} label={r.engagement_level}/> },
          { key:'overall_rating', label:'Rating', render:r=>`${r.overall_rating}/5` },
          { key:'campus_name', label:'Campus' },
        ]} rows={reports} keyFn={r=>r.id}/>
      </div>
      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title="New Event Report" width={620}>
        <form onSubmit={save}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <Field label="Event Name" required><Input value={form.event_name} onChange={e=>setForm(f=>({...f,event_name:e.target.value}))} required /></Field>
            <Field label="Date"><Input type="date" max={new Date().toISOString().slice(0,10)} value={form.report_date} onChange={e=>setForm(f=>({...f,report_date:e.target.value}))}/></Field>
            <CampusField value={form.campus_id} onChange={v => setForm(f=>({...f,campus_id:v}))} />
            <Field label="Venue"><Input value={form.venue} onChange={e=>setForm(f=>({...f,venue:e.target.value}))}/></Field>
            <Field label="Student Count"><Input type="number" value={form.student_count} onChange={e=>setForm(f=>({...f,student_count:e.target.value}))}/></Field>
            <Field label="Staff Count"><Input type="number" value={form.staff_count} onChange={e=>setForm(f=>({...f,staff_count:e.target.value}))}/></Field>
            <Field label="Engagement Level"><Select value={form.engagement_level} onChange={e=>setForm(f=>({...f,engagement_level:e.target.value}))}>
              {['poor','fair','good','excellent'].map(l=><option key={l} value={l}>{l}</option>)}
            </Select></Field>
            <Field label="Overall Rating (1-5)"><Input type="number" min="1" max="5" value={form.overall_rating} onChange={e=>setForm(f=>({...f,overall_rating:e.target.value}))}/></Field>
          </div>
          <Field label="Activities Conducted"><Textarea value={form.activities_conducted} onChange={e=>setForm(f=>({...f,activities_conducted:e.target.value}))} rows={2}/></Field>
          <Field label="Health & Safety Observations"><Textarea value={form.health_safety_notes} onChange={e=>setForm(f=>({...f,health_safety_notes:e.target.value}))} rows={2}/></Field>
          <Field label="Recommendations"><Textarea value={form.recommendations} onChange={e=>setForm(f=>({...f,recommendations:e.target.value}))} rows={2}/></Field>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
            <Btn variant="secondary" onClick={()=>setAddOpen(false)}>Cancel</Btn>
            <Btn type="submit">Save Report</Btn>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}

// ── DISPENSARY VIEW (read-only for SE) ────────────────────────
export function SEDispensary() {
  const [visits, setVisits]       = useState([]);
  const [inventory, setInventory] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [tab, setTab]             = useState('visits');
  const [loading, setLoading]     = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    Promise.all([
      api.get('/se/dispensary/visits'),
      api.get('/se/dispensary/inventory'),
      api.get('/dispensary/quotations'),
    ]).then(([v, inv, q]) => { setVisits(v.data); setInventory(inv.data); setQuotations(q.data); setLoading(false); });
  }, []);

  async function approveQuotation(id, status) {
    try { await api.patch(`/se/dispensary/quotations/${id}/status`, { status }); toast.success(`Quotation ${status}.`); api.get('/dispensary/quotations').then(r=>setQuotations(r.data)); }
    catch { toast.error('Failed.'); }
  }

  if (loading) return <Layout module="se"><Spinner /></Layout>;

  const TABS = [{ key:'visits', label:'Visits', count:visits.length }, { key:'inventory', label:'Inventory', count:inventory.length }, { key:'quotations', label:'Quotations', count:quotations.filter(q=>q.status==='pending').length }];

  return (
    <Layout module="se">
      <PageHeader title="Dispensary Overview" sub="Read-only view — all dispensary activity" />
      <div style={{ display:'flex',gap:6,marginBottom:16 }}>
        {TABS.map(t => <button key={t.key} onClick={()=>setTab(t.key)} style={{ padding:'7px 16px',borderRadius:20,border:'none',cursor:'pointer',fontSize:13,fontWeight:500, background:tab===t.key?BRAND.electricBlue:`${BRAND.silver}14`, color:tab===t.key?'white':BRAND.silver }}>{t.label} ({t.count})</button>)}
      </div>
      {tab === 'visits' && (
        <div style={{ background:'white',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.07)',overflow:'hidden' }}>
          <Table cols={[
            { key:'visit_date', label:'Date', render:r=>new Date(r.visit_date).toLocaleDateString('en-GB') },
            { key:'name', label:'Student', render:r=>`${r.first_name} ${r.last_name}` },
            { key:'class_name', label:'Class' },
            { key:'visit_type', label:'Type', render:r=><Badge status={r.is_emergency?'emergency':'low'} label={r.is_emergency?'Emergency':r.visit_type?.replace('_',' ')}/> },
            { key:'complaint', label:'Complaint' },
            { key:'campus_name', label:'Campus' },
          ]} rows={visits.slice(0,100)} keyFn={r=>r.id}/>
        </div>
      )}
      {tab === 'inventory' && (
        <div style={{ background:'white',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.07)',overflow:'hidden' }}>
          <Table cols={[
            { key:'drug_name', label:'Drug' },
            { key:'category_name', label:'Category' },
            { key:'quantity', label:'Qty', render:r=><span style={{ color:r.low_stock?'#e74c3c':BRAND.black, fontWeight:r.low_stock?700:400 }}>{r.quantity}</span> },
            { key:'minimum_stock', label:'Min Stock' },
            { key:'expiry_date', label:'Expiry', render:r=>r.expiry_date ? new Date(r.expiry_date).toLocaleDateString('en-GB') : '—' },
            { key:'status', label:'', render:r=>r.expiry_date && new Date(r.expiry_date)<=new Date()?<Badge status="critical" label="Expired"/>:r.low_stock?<Badge status="high" label="Low"/>:<Badge status="resolved" label="OK"/> },
            { key:'campus_name', label:'Campus' },
          ]} rows={inventory} keyFn={r=>r.id}/>
        </div>
      )}
      {tab === 'quotations' && (
        <div style={{ display:'grid',gap:12 }}>
          {quotations.map(q => (
            <div key={q.id} style={{ background:'white',borderRadius:10,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,0.07)', borderLeft:`3px solid ${q.status==='pending'?'#f39c12':q.status==='approved'?'#27ae60':'#e74c3c'}` }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontSize:15,fontWeight:700,color:BRAND.black }}>{q.title}</div>
                  <div style={{ fontSize:13,color:BRAND.silver,marginTop:2 }}>{q.campus_name} · {q.created_by_name} · TZS {parseInt(q.total_estimated_cost||0).toLocaleString()}</div>
                  <div style={{ fontSize:11,color:BRAND.silver,marginTop:2 }}>{new Date(q.created_at).toLocaleDateString('en-GB')}</div>
                </div>
                <Badge status={q.status}/>
              </div>
              {q.status === 'pending' && user?.role === 'global_student_exp_head' && (
                <div style={{ display:'flex',gap:8,marginTop:14 }}>
                  <Btn variant="success" small onClick={()=>approveQuotation(q.id,'approved')}>Approve</Btn>
                  <Btn variant="danger"  small onClick={()=>approveQuotation(q.id,'rejected')}>Reject</Btn>
                </div>
              )}
            </div>
          ))}
          {quotations.length === 0 && <Empty icon={FileText} title="No quotations" sub="No drug quotations submitted yet." />}
        </div>
      )}
    </Layout>
  );
}

// ── SE Calendar ───────────────────────────────────────────────
export function SECalendar() {
  const { user } = useAuthStore();
  const [events, setEvents] = useState([]);
  const [month, setMonth]   = useState(new Date());
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ campus_id:'', title:'', event_type:'welfare_day', start_date:'', location:'' });

  useEffect(() => { api.get('/se/events').then(r=>setEvents(r.data)).catch(()=>{}); }, []);

  async function save(e) {
    e.preventDefault();
    try { await api.post('/se/events', { ...form, campus_id: user?.campusId || form.campus_id || null }); toast.success('Event added.'); setAddOpen(false); api.get('/se/events').then(r=>setEvents(r.data)); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed.'); }
  }

  const year = month.getFullYear(), mo = month.getMonth();
  const firstDay = new Date(year, mo, 1).getDay();
  const daysInMonth = new Date(year, mo+1, 0).getDate();
  const EVENT_COLORS = { welfare_day:BRAND.electricBlue, sports_day:BRAND.gold, cultural_day:BRAND.lightBlue, open_day:BRAND.silver, club_event:BRAND.electricBlue, other:BRAND.gold };

  function getEventsForDay(d) {
    const ds = `${year}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return events.filter(e=>e.start_date?.slice(0,10)===ds);
  }

  return (
    <Layout module="se">
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20 }}>
        <div style={{ display:'flex',alignItems:'center',gap:12 }}>
          <h1 style={{ margin:0,fontSize:22,fontWeight:700,color:BRAND.black }}>School Calendar</h1>
          <div style={{ display:'flex',gap:6,alignItems:'center' }}>
            <button onClick={()=>setMonth(new Date(year,mo-1,1))} style={{ background:`${BRAND.silver}14`,border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer' }}><ChevronLeft size={16}/></button>
            <span style={{ fontSize:14,fontWeight:600,minWidth:140,textAlign:'center' }}>{month.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</span>
            <button onClick={()=>setMonth(new Date(year,mo+1,1))} style={{ background:`${BRAND.silver}14`,border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer' }}><ChevronRight size={16}/></button>
          </div>
        </div>
        <Btn onClick={()=>setAddOpen(true)}><Plus size={15}/>Add Event</Btn>
      </div>
      <div style={{ background:'white',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.07)',overflow:'hidden' }}>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',background:`${BRAND.silver}14`,borderBottom:`1px solid ${BRAND.silver}40` }}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} style={{ padding:'10px',textAlign:'center',fontSize:12,fontWeight:700,color:BRAND.silver }}>{d}</div>)}
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)' }}>
          {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`} style={{ minHeight:90,borderBottom:`1px solid ${BRAND.silver}26`,borderRight:`1px solid ${BRAND.silver}26`,background:`${BRAND.silver}0D` }}/>)}
          {Array.from({length:daysInMonth}).map((_,i)=>{
            const d=i+1, dayEvents=getEventsForDay(d), isToday=new Date().getDate()===d&&new Date().getMonth()===mo&&new Date().getFullYear()===year;
            return <div key={d} style={{ minHeight:90,padding:5,borderBottom:`1px solid ${BRAND.silver}26`,borderRight:`1px solid ${BRAND.silver}26`,background:isToday?`${BRAND.lightBlue}26`:'white' }}>
              <div style={{ fontSize:12,width:22,height:22,borderRadius:'50%',background:isToday?BRAND.electricBlue:'transparent',color:isToday?'white':BRAND.black,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:3 }}>{d}</div>
              {dayEvents.map(ev=><div key={ev.id} title={ev.title} style={{ fontSize:10,padding:'1px 5px',borderRadius:3,marginBottom:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',background:(EVENT_COLORS[ev.event_type]||BRAND.silver)+'22',color:EVENT_COLORS[ev.event_type]||BRAND.silver,fontWeight:600 }}>{ev.title}</div>)}
            </div>;
          })}
        </div>
      </div>
      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title="Add School Event">
        <form onSubmit={save}>
          <Field label="Title" required><Input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required /></Field>
          <Field label="Type"><Select value={form.event_type} onChange={e=>setForm(f=>({...f,event_type:e.target.value}))}>
            {['welfare_day','sports_day','cultural_day','open_day','club_event','trip','public_holiday','other'].map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
          </Select></Field>
          <Field label="Date" required><Input type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} required /></Field>
          <Field label="Location"><Input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))}/></Field>
          <CampusField value={form.campus_id} onChange={v => setForm(f=>({...f,campus_id:v}))} required={false} />
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
            <Btn variant="secondary" onClick={()=>setAddOpen(false)}>Cancel</Btn>
            <Btn type="submit">Add Event</Btn>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}

// ── SE Team ───────────────────────────────────────────────────
export function SETeam() {
  const { user } = useAuthStore();
  const [users, setUsers]     = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name:'', email:'', role:'campus_student_exp_head', campus_id:'' });

  useEffect(() => { api.get('/admin/users').then(r=>setUsers(r.data)); api.get('/admin/campuses').then(r=>setCampuses(r.data)); }, []);

  async function addUser(e) {
    e.preventDefault();
    try {
      const { data } = await api.post('/admin/users', { ...form, department: form.role === 'nurse' ? 'dispensary' : 'student_experience' });
      toast.success(`User created. Default password: ${data.defaultPassword}`);
      setAddOpen(false); api.get('/admin/users').then(r=>setUsers(r.data));
    } catch (err) { toast.error(err.response?.data?.error || 'Failed.'); }
  }

  if (user?.role !== 'global_student_exp_head') return <Layout module="se"><div style={{ padding:40,textAlign:'center',color:BRAND.silver }}>Only the Global SE Head can manage team members.</div></Layout>;

  return (
    <Layout module="se">
      <PageHeader title="Team Management" sub={`${users.length} users`} action={<Btn onClick={()=>setAddOpen(true)}><UserPlus size={15}/>Add User</Btn>}/>
      <div style={{ background:'white',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.07)',overflow:'hidden' }}>
        <Table cols={[
          { key:'name',label:'Name' },
          { key:'email',label:'Email' },
          { key:'role',label:'Role',render:r=><Badge status={r.is_active?'active':'declined'} label={r.role?.replace(/_/g,' ')}/> },
          { key:'campus_name',label:'Campus' },
          { key:'last_login',label:'Last Login',render:r=>r.last_login?new Date(r.last_login).toLocaleDateString('en-GB'):'Never' },
          { key:'actions',label:'',render:r=><div style={{display:'flex',gap:6}}><Btn variant="secondary" small onClick={()=>api.patch(`/auth/reset-password/${r.id}`).then(({data})=>toast.success(`Password reset to: ${data.defaultPassword}`))}>Reset Pwd</Btn>{r.is_active&&<Btn variant="danger" small onClick={()=>api.patch(`/admin/users/${r.id}`,{is_active:false}).then(()=>api.get('/admin/users').then(r=>setUsers(r.data)))}>Deactivate</Btn>}</div> },
        ]} rows={users} keyFn={r=>r.id}/>
      </div>
      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title="Add Team Member">
        <form onSubmit={addUser}>
          <Field label="Full Name" required><Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required /></Field>
          <Field label="Email" required hint="Must be @silverleaf.co.tz"><Input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} required /></Field>
          <Field label="Role"><Select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
            <option value="campus_student_exp_head">Campus SE Head</option>
            <option value="nurse">Nurse</option>
          </Select></Field>
          <Field label="Campus"><Select value={form.campus_id} onChange={e=>setForm(f=>({...f,campus_id:e.target.value}))}>
            <option value="">Select campus</option>
            {campuses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </Select></Field>
          <p style={{ fontSize:12,color:BRAND.silver,marginBottom:12 }}>The default password will be shown after creating the user — they'll be asked to change it on first login.</p>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
            <Btn variant="secondary" onClick={()=>setAddOpen(false)}>Cancel</Btn>
            <Btn type="submit">Create User</Btn>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}

// ── SE Reports ────────────────────────────────────────────────
export function SEReports() {
  const [period, setPeriod] = useState('monthly');
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try { const r = await api.get(`/admin/reports?module=se&period=${period}`); setData(r.data); }
    catch { toast.error('Failed.'); }
    finally { setLoading(false); }
  }

  function buildSections() {
    return [
      {
        title: 'Incidents by Severity',
        columns: ['Severity', 'Count'],
        rows: (data.data?.incidents || []).map(i => [i.severity, i.count]),
      },
      {
        title: 'Walkthrough Findings',
        columns: ['Risk Level', 'Area', 'Status', 'Count'],
        rows: (data.data?.walkthroughs || []).map(w => [w.risk_level, w.area?.replace(/_/g, ' '), w.status, w.count]),
      },
    ];
  }

  async function handleExport(format) {
    if (!data) return;
    const heading = `SE Report — ${period}`;
    const sections = buildSections();
    const { exportReportPDF, exportReportExcel, exportReportWord } = await import('../../utils/reportExport');
    if (format === 'pdf') exportReportPDF(`se-report-${period}.pdf`, heading, sections);
    else if (format === 'excel') exportReportExcel(`se-report-${period}.xlsx`, heading, sections);
    else if (format === 'word') exportReportWord(`se-report-${period}.docx`, heading, sections);
  }

  return (
    <Layout module="se">
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24 }}>
        <h1 style={{ margin:0,fontSize:22,fontWeight:700,color:BRAND.black }}>SE Reports</h1>
        <div style={{ display:'flex',gap:10 }}>
          <PeriodToggle value={period} onChange={setPeriod}/>
          <Btn onClick={generate} disabled={loading}>{loading?'Loading…':'Generate'}</Btn>
          {data && <ExportMenu onExport={handleExport} />}
        </div>
      </div>
      {data ? (
        <div style={{ display:'grid',gap:16 }}>
          <div style={{ background:'white',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
            <h3 style={{ marginTop:0 }}>Incidents by Severity</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.data?.incidents||[]}>
                <XAxis dataKey="severity" tick={{ fontSize:12 }}/>
                <YAxis tick={{ fontSize:11 }}/>
                <Tooltip/>
                <Bar dataKey="count" fill={BRAND.electricBlue} radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background:'white',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
            <h3 style={{ marginTop:0 }}>Walkthrough Findings</h3>
            <Table cols={[
              { key:'risk_level',label:'Risk Level',render:r=><Badge status={r.risk_level}/> },
              { key:'area',label:'Area',render:r=>r.area?.replace(/_/g,' ') },
              { key:'status',label:'Status',render:r=><Badge status={r.status}/> },
              { key:'count',label:'Count' },
            ]} rows={data.data?.walkthroughs||[]} keyFn={(_,i)=>i}/>
          </div>
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

// ── SE Profile ────────────────────────────────────────────────
export function SEProfile() { return <Layout module="se"><ProfileBase module="se"/></Layout>; }

export default Walkthroughs;
