import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { BRAND } from '../../theme';
import api from '../../utils/api';
import Layout from '../../components/shared/Layout';
import { PageHeader, Btn, Badge, Modal, Field, Input, Select, Textarea, Table, Spinner, Empty, StudentPicker, CampusField } from '../../components/shared/UI';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

const INCIDENT_TYPES     = ['behaviour','safeguarding','medical','bullying','accident','property_damage','other'];
const INCIDENT_LOCATIONS = ['dormitory','dispensary','field','trip','games','classroom','canteen','transport','laboratory','office','other'];
const SEVERITIES         = ['low','medium','high','critical'];
const STATUSES           = ['open','investigating','resolved','escalated'];
const SEV_COLOR          = { low: '#3498db', medium: '#f39c12', high: '#e74c3c', critical: '#7f0000' };

export default function Incidents() {
  const { user } = useAuthStore();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [addOpen, setAddOpen]     = useState(false);
  const [selected, setSelected]   = useState(null);
  const [filters, setFilters]     = useState({ severity: '', status: '', location: '' });
  const [form, setForm] = useState({ student_id:'', campus_id:'', incident_type:'behaviour', incident_location:'classroom', severity:'low', description:'', action_taken:'', follow_up_required:false, parent_notified:false, parent_meeting_required:false, referral_required:false });

  useEffect(() => { fetchAll(); }, [filters]);

  async function fetchAll() {
    try {
      const params = new URLSearchParams({ limit: 200, ...Object.fromEntries(Object.entries(filters).filter(([,v])=>v)) }).toString();
      const inc = await api.get(`/se/incidents?${params}`);
      setIncidents(inc.data);
    } catch { toast.error('Failed to load incidents.'); }
    finally { setLoading(false); }
  }

  async function save(e) {
    e.preventDefault();
    if (!form.student_id) { toast.error('Please select a student.'); return; }
    try {
      await api.post('/se/incidents', { ...form, campus_id: user?.campusId || form.campus_id });
      toast.success('Incident logged.');
      setAddOpen(false);
      setForm({ student_id:'', campus_id:'', incident_type:'behaviour', incident_location:'classroom', severity:'low', description:'', action_taken:'', follow_up_required:false, parent_notified:false, parent_meeting_required:false, referral_required:false });
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to log incident.'); }
  }

  async function updateStatus(id, status) {
    try { await api.patch(`/se/incidents/${id}`, { status }); fetchAll(); toast.success('Status updated.'); }
    catch { toast.error('Update failed.'); }
  }

  const cols = [
    { key: 'created_at', label: 'Date', nowrap: true, render: r => new Date(r.created_at).toLocaleDateString('en-GB') },
    { key: 'name', label: 'Student', render: r => `${r.first_name} ${r.last_name}` },
    { key: 'class_name', label: 'Class' },
    { key: 'incident_type', label: 'Type', render: r => r.incident_type?.replace('_',' ') },
    { key: 'incident_location', label: 'Location', render: r => r.incident_location?.replace('_',' ') },
    { key: 'severity', label: 'Severity', render: r => <Badge status={r.severity}/> },
    { key: 'status', label: 'Status', render: r => <Badge status={r.status}/> },
    { key: 'campus_name', label: 'Campus' },
    { key: 'actions', label: '', render: r => (
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => setSelected(r)} style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${BRAND.silver}40`, background: 'white', cursor: 'pointer', fontSize: 12 }}>View</button>
        {r.status !== 'resolved' && <button onClick={() => updateStatus(r.id, 'resolved')} style={{ padding: '4px 10px', borderRadius: 5, border: 'none', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Resolve</button>}
      </div>
    )},
  ];

  if (loading) return <Layout module="se"><Spinner /></Layout>;

  return (
    <Layout module="se">
      <PageHeader
        title="Incident Reports"
        sub={`${incidents.length} records`}
        action={<Btn onClick={() => setAddOpen(true)}><Plus size={15}/>Log Incident</Btn>}
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'severity', options: ['', ...SEVERITIES], label: 'Severity' },
          { key: 'status',   options: ['', ...STATUSES],   label: 'Status' },
          { key: 'location', options: ['', ...INCIDENT_LOCATIONS], label: 'Location' },
        ].map(f => (
          <select key={f.key} value={filters[f.key]} onChange={e => setFilters(x=>({...x,[f.key]:e.target.value}))}
            style={{ padding: '7px 12px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13, color: BRAND.black, background: 'white' }}>
            <option value="">{f.label}: All</option>
            {f.options.filter(Boolean).map(o => <option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}
          </select>
        ))}
        <button onClick={() => setFilters({ severity:'', status:'', location:'' })} style={{ padding: '7px 12px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13, background: 'white', cursor: 'pointer', color: BRAND.silver }}>Clear</button>
      </div>

      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <Table cols={cols} rows={incidents} keyFn={r => r.id} />
      </div>

      {/* New Incident Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Log New Incident" width={640}>
        <form onSubmit={save}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CampusField value={form.campus_id} onChange={v => setForm(f=>({...f,campus_id:v}))} />
            <Field label="Student" required>
              <StudentPicker basePath="/se" onSelect={s => setForm(f=>({...f,student_id:s?.id||''}))} />
            </Field>
            <Field label="Incident Type">
              <Select value={form.incident_type} onChange={e => setForm(f=>({...f,incident_type:e.target.value}))}>
                {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
              </Select>
            </Field>
            <Field label="Location">
              <Select value={form.incident_location} onChange={e => setForm(f=>({...f,incident_location:e.target.value}))}>
                {INCIDENT_LOCATIONS.map(l => <option key={l} value={l}>{l.replace('_',' ')}</option>)}
              </Select>
            </Field>
            <Field label="Severity">
              <Select value={form.severity} onChange={e => setForm(f=>({...f,severity:e.target.value}))}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Description of Incident" required>
            <Textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} required rows={3} />
          </Field>
          <Field label="Immediate Action Taken">
            <Textarea value={form.action_taken} onChange={e => setForm(f=>({...f,action_taken:e.target.value}))} rows={2} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Follow-up Date">
              <Input type="date" value={form.follow_up_date || ''} onChange={e => setForm(f=>({...f,follow_up_date:e.target.value}))} />
            </Field>
          </div>
          {/* Checkboxes */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { key: 'follow_up_required',      label: 'Follow-up required' },
              { key: 'parent_notified',          label: 'Parent notified' },
              { key: 'parent_meeting_required',  label: 'Parent meeting required' },
              { key: 'referral_required',        label: 'Referral required' },
            ].map(c => (
              <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={form[c.key]} onChange={e => setForm(f=>({...f,[c.key]:e.target.checked}))} style={{ width: 15, height: 15 }}/>{c.label}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
            <Btn type="submit">Log Incident</Btn>
          </div>
        </form>
      </Modal>

      {/* Detail view modal */}
      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title="Incident Detail" width={560}>
          <div style={{ display: 'grid', gap: 12 }}>
            {[
              ['Student', `${selected.first_name} ${selected.last_name} (${selected.class_name})`],
              ['Parent', `${selected.parent_name} · ${selected.parent_phone}`],
              ['Type', selected.incident_type?.replace('_',' ')],
              ['Location', selected.incident_location?.replace('_',' ')],
              ['Severity', <Badge status={selected.severity}/>],
              ['Status',   <Badge status={selected.status}/>],
              ['Reported', new Date(selected.created_at).toLocaleString('en-GB')],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 13, minWidth: 90, color: BRAND.silver }}>{k}</span>
                <span style={{ fontSize: 13, color: BRAND.black }}>{v}</span>
              </div>
            ))}
            <div><span style={{ fontWeight: 600, fontSize: 13, color: BRAND.silver }}>Description</span><p style={{ fontSize: 13, marginTop: 4 }}>{selected.description}</p></div>
            {selected.action_taken && <div><span style={{ fontWeight: 600, fontSize: 13, color: BRAND.silver }}>Action Taken</span><p style={{ fontSize: 13, marginTop: 4 }}>{selected.action_taken}</p></div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {STATUSES.map(s => s !== selected.status && (
                <Btn key={s} variant={s==='resolved'?'success':s==='escalated'?'danger':'secondary'} small onClick={() => { updateStatus(selected.id, s); setSelected(null); }}>Mark {s}</Btn>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
