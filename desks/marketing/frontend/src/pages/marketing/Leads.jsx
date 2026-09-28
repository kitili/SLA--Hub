import { useEffect, useState } from 'react';
import { Plus, Search, Phone, Mail, Clock, X, ChevronDown, ChevronRight, MessageCircle, AlertTriangle } from 'lucide-react';
import api from '../../utils/api';
import Layout from '../../components/shared/Layout';
import { Modal, Badge, Btn, Field, Input, Select, Textarea, PageHeader, Empty, Spinner } from '../../components/shared/UI';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { BRAND } from '../../theme';
import { telHref, whatsappHref, isFollowUpOverdue } from '../../utils/phone';
import { computeLeadVitality, VITALITY_COLORS } from '../../utils/leadVitality';

const STAGES = [
  { key: 'interested_lead', label: 'Interested',     color: '#3498db' },
  { key: 'tour_booked',     label: 'Tour Booked',    color: '#f39c12' },
  { key: 'interview_booked',label: 'Interview',      color: '#16a085' },
  { key: 'form_filled',     label: 'Register',       color: '#8e44ad' },
  { key: 'enrolled',        label: 'Enrolled',       color: '#27ae60' },
  { key: 'admission_paid',  label: 'Admission Paid', color: '#c9a84c' },
  { key: 'dead_lead',       label: 'Dead Lead',      color: '#7f8c8d' },
];

const SOURCES = ['walk_in','phone_call','social_media','referral','radio_campaign','billboard','online_form','whatsapp','open_day','partner_school','other'];
const PAGE_SIZE = 200;
const CARDS_PER_COLUMN = 20;

async function fetchAllLeads() {
  let page = 1;
  let all = [];
  let total = 0;
  while (true) {
    const res = await api.get(`/marketing/leads?limit=${PAGE_SIZE}&page=${page}`);
    const batch = res.data?.data || [];
    total = res.data?.total ?? batch.length;
    all = all.concat(batch);
    if (batch.length < PAGE_SIZE || all.length >= total) break;
    page += 1;
  }
  return { all, total };
}

function ScoreDot({ score }) {
  const color = score >= 70 ? '#27ae60' : score >= 40 ? '#f39c12' : '#e74c3c';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }}/>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{score}</span>
    </div>
  );
}

function VitalityChip({ lead }) {
  const v = computeLeadVitality(lead);
  const color = VITALITY_COLORS[v.status] || VITALITY_COLORS.warm;
  return (
    <span title={v.reasons?.join(' · ') || v.label} style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`, padding: '2px 7px', borderRadius: 10 }}>
      {v.label}
    </span>
  );
}

function LeadCard({ lead, onClick }) {
  const daysSince = Math.floor((Date.now() - new Date(lead.updated_at)) / 86400000);
  const overdue = isFollowUpOverdue(lead);
  return (
    <div onClick={() => onClick(lead)} style={{ background: 'white', borderRadius: 10, padding: '12px 14px', marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', cursor: 'pointer', borderLeft: overdue ? '3px solid #e74c3c' : lead.sibling_flag ? `3px solid ${BRAND.gold}` : '3px solid transparent', transition: 'box-shadow 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.07)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.black }}>{lead.parent_name}</div>
        <ScoreDot score={lead.lead_score || 0} />
      </div>
      {lead.child_name && <div style={{ fontSize: 12, color: BRAND.silver, marginBottom: 4 }}>{lead.child_name} · {lead.interested_class || '—'}</div>}
      <div style={{ marginBottom: 4 }}><VitalityChip lead={lead} /></div>
      {overdue && (
        <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={10}/> Needs follow-up
        </div>
      )}
      {lead.interview_outcome === 'passed' && <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>✔ Interview Passed</span>}
      {lead.interview_outcome === 'failed' && <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>✘ Interview Failed</span>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: BRAND.silver }}>{lead.source?.replace('_', ' ')}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {lead.sibling_flag && <span title="Sibling" style={{ fontSize: 10, background: `${BRAND.gold}26`, color: BRAND.gold, padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>Sibling</span>}
          <span style={{ fontSize: 11, color: daysSince > 7 ? '#e74c3c' : BRAND.silver, display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={10}/>{daysSince}d
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Leads() {
  const { user } = useAuthStore();
  const [leads, setLeads]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState(null);
  const [addOpen, setAddOpen]   = useState(false);
  const [declined, setDeclined] = useState([]);
  const [showDeclined, setShowDeclined] = useState(false);
  const [needsFollowUpOnly, setNeedsFollowUpOnly] = useState(false);
  const [campuses, setCampuses] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [newLead, setNewLead]   = useState({ parent_name:'', parent_phone:'', parent_email:'', whatsapp_number:'', child_name:'', child_age:'', interested_class:'', source:'walk_in', campaign_id:'', campus_id:'', boarding_day:'day', notes:'' });
  const [admissionForm, setAdmissionForm] = useState(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [uploadingForm, setUploadingForm] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineTargetId, setDeclineTargetId] = useState(null);
  const [expandedStages, setExpandedStages] = useState({});

  useEffect(() => { fetchAll(); fetchAdmissionForm(); }, []);

  async function fetchAll() {
    try {
      const [{ all, total }, campRes, campRes2] = await Promise.all([
        fetchAllLeads(),
        api.get('/admin/campuses'),
        api.get('/marketing/campaigns'),
      ]);
      if (all.length < total) {
        toast.error(`Loaded ${all.length} of ${total} leads — refresh or contact support if counts look wrong.`);
      }
      const active = all.filter(l => !['declined','lapsed'].includes(l.computed_stage));
      setLeads(active);
      setDeclined(all.filter(l => ['declined','lapsed'].includes(l.computed_stage)));
      setCampuses(campRes.data || []);
      setCampaigns(campRes2.data || []);
      setExpandedStages({});
      setSelected(prev => (prev ? active.find(l => l.id === prev.id) || null : null));
    } catch { toast.error('Failed to load leads.'); }
    finally { setLoading(false); }
  }

  async function fetchAdmissionForm() {
    try { const r = await api.get('/marketing/admission-form'); setAdmissionForm(r.data); }
    catch { /* no form uploaded yet */ }
  }

  async function uploadAdmissionForm(file) {
    const data = new FormData();
    data.append('file', file);
    setUploadingForm(true);
    try {
      const r = await api.post('/marketing/admission-form', data);
      setAdmissionForm(r.data);
      toast.success('Admission form uploaded.');
    } catch (err) { toast.error(err.response?.data?.error || 'Upload failed.'); }
    finally { setUploadingForm(false); }
  }

  async function saveLead(e) {
    e.preventDefault();
    if (!newLead.parent_name.trim()) {
      toast.error('Parent name is required.');
      return;
    }
    if (!newLead.parent_phone.trim()) {
      toast.error('Parent phone is required — we cannot convert without a way to reach them.');
      return;
    }
    if (!newLead.child_name.trim() || !newLead.interested_class.trim()) {
      toast.error('Child name and class are required.');
      return;
    }
    if (!user?.campusId && !newLead.campus_id) {
      toast.error('Select a campus for this lead.');
      return;
    }
    try {
      await api.post('/marketing/leads', {
        ...newLead,
        child_age: newLead.child_age === '' ? null : newLead.child_age,
        campaign_id: newLead.campaign_id || null,
      });
      toast.success('Lead added — book a campus tour while interest is hot.');
      setAddOpen(false);
      setNewLead({ parent_name:'', parent_phone:'', parent_email:'', whatsapp_number:'', child_name:'', child_age:'', interested_class:'', source:'walk_in', campaign_id:'', campus_id:'', boarding_day:'day', notes:'' });
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add lead.'); }
  }

  async function updateLead(id, data) {
    try {
      await api.patch(`/marketing/leads/${id}`, data);
      toast.success('Lead updated.');
      fetchAll();
    }
    catch { toast.error('Update failed.'); }
  }

  function openDecline(id) {
    setDeclineTargetId(id);
    setDeclineReason('');
    setDeclineOpen(true);
  }

  async function confirmDecline() {
    if (!declineReason.trim()) {
      toast.error('Add a short reason — it helps coaching and campaign insight.');
      return;
    }
    try {
      await api.patch(`/marketing/leads/${declineTargetId}/status`, {
        status: 'declined',
        reason: declineReason.trim(),
      });
      toast.success('Lead marked declined.');
      setDeclineOpen(false);
      setSelected(null);
      fetchAll();
    } catch { toast.error('Update failed.'); }
  }

  async function bookTour(lead, tour_date, tour_time) {
    try {
      await api.post('/marketing/tours', {
        lead_id: lead.id,
        campus_id: lead.campus_id,
        booked_by_name: lead.parent_name,
        booked_by_phone: lead.parent_phone,
        booked_by_email: lead.parent_email,
        whatsapp_number: lead.whatsapp_number,
        tour_date, tour_time,
      });
      toast.success('Tour booked — parent notified by email/WhatsApp.');
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to book tour.'); }
  }

  async function bookInterview(lead, interview_date, interview_time, campus_id) {
    try {
      await api.post(`/marketing/leads/${lead.id}/interviews`, { interview_date, interview_time, campus_id });
      toast.success('Interview booked — parent notified by email/WhatsApp.');
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to book interview.'); }
  }

  async function interviewOutcome(interviewId, outcome) {
    try {
      await api.patch(`/marketing/interviews/${interviewId}/outcome`, { outcome });
      toast.success(outcome === 'passed' ? 'Marked as passed — parent sent the Ed Admin application link.' : 'Marked as failed — parent notified.');
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to record interview outcome.'); }
  }

  async function sendFormLink(id) {
    try {
      await api.post(`/marketing/leads/${id}/send-form-link`);
      toast.success('Ed Admin application link resent to the parent.');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to send the application link.'); }
  }

  async function markEnrolled(id) {
    try {
      await api.patch(`/marketing/leads/${id}/mark-enrolled`);
      toast.success('Lead marked as enrolled — parent notified.');
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to mark as enrolled.'); }
  }

  async function recordPayment(lead, amount, payment_method, reference_number) {
    try {
      await api.post('/marketing/payments', {
        lead_id: lead.id,
        campus_id: lead.campus_id,
        amount, payment_method, reference_number,
      });
      toast.success('Payment recorded — receipt sent to parent.');
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to record payment.'); }
  }

  const filtered = leads.filter(l => {
    if (needsFollowUpOnly && !isFollowUpOverdue(l)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return [l.parent_name, l.child_name, l.parent_phone].some(v => v?.toLowerCase().includes(q));
  });
  const overdueCount = leads.filter(isFollowUpOverdue).length;

  if (loading) return <Layout module="marketing"><Spinner /></Layout>;

  return (
    <Layout module="marketing">
      <PageHeader
        title="Leads Funnel"
        sub={`${leads.length} active · ${overdueCount} need follow-up`}
        action={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: BRAND.silver }}/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads…"
                style={{ padding: '8px 12px 8px 32px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13, width: 200 }}/>
            </div>
            <Btn
              variant={needsFollowUpOnly ? 'primary' : 'secondary'}
              onClick={() => setNeedsFollowUpOnly(v => !v)}
            >
              <AlertTriangle size={15}/>
              {needsFollowUpOnly ? 'Showing overdue' : `Needs follow-up (${overdueCount})`}
            </Btn>
            <Btn variant="secondary" onClick={() => setFormModalOpen(true)}>📄 Admission Form</Btn>
            <Btn onClick={() => setAddOpen(true)}><Plus size={15}/>Add Lead</Btn>
          </div>
        }
      />

      {overdueCount > 0 && !needsFollowUpOnly && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#991b1b' }}>
            <strong>{overdueCount}</strong> parent{overdueCount === 1 ? '' : 's'} waiting — every day without a call costs enrolment.
          </div>
          <Btn small variant="danger" onClick={() => setNeedsFollowUpOnly(true)}>Review now</Btn>
        </div>
      )}
      {/* Kanban board — horizontal scroll keeps columns readable; cap cards per column for performance */}
      <div style={{ overflowX: 'auto', paddingBottom: 8, WebkitOverflowScrolling: 'touch' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${STAGES.length}, minmax(240px, 1fr))`,
          gap: 12,
          minWidth: STAGES.length * 252,
        }}>
          {STAGES.map(stage => {
            const stageleads = filtered.filter(l => l.computed_stage === stage.key);
            const expanded = !!expandedStages[stage.key] || !!search || needsFollowUpOnly;
            const visibleLeads = expanded ? stageleads : stageleads.slice(0, CARDS_PER_COLUMN);
            const hiddenCount = stageleads.length - visibleLeads.length;
            return (
              <div key={stage.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px', background: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color }}/>
                  <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.black }}>{stage.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: stage.color, background: stage.color + '15', padding: '1px 8px', borderRadius: 10 }}>{stageleads.length}</span>
                </div>
                <div style={{ minHeight: 100, maxHeight: expanded ? 'none' : 640, overflowY: expanded ? 'visible' : 'auto' }}>
                  {visibleLeads.map(lead => <LeadCard key={lead.id} lead={lead} onClick={setSelected}/>)}
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedStages(prev => ({ ...prev, [stage.key]: true }))}
                      style={{
                        width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8,
                        border: `1px dashed ${stage.color}55`, background: `${stage.color}10`,
                        color: stage.color, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      Show {hiddenCount} more
                    </button>
                  )}
                  {stageleads.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 12px', color: `${BRAND.silver}80`, fontSize: 12 }}>No leads</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Declined/Lapsed sidebar toggle */}
      <div style={{ marginTop: 20, background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <button onClick={() => setShowDeclined(!showDeclined)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: BRAND.silver }}>
          {showDeclined ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
          Declined & Lapsed ({declined.length})
        </button>
        {showDeclined && (
          <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 8 }}>
            {declined.map(lead => (
              <div key={lead.id} style={{ padding: '10px 12px', background: `${BRAND.silver}14`, borderRadius: 8, borderLeft: `3px solid ${lead.computed_stage === 'declined' ? '#e74c3c' : BRAND.silver}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.black }}>{lead.parent_name}</div>
                <div style={{ fontSize: 11, color: BRAND.silver, marginTop: 2 }}>{lead.decline_reason || lead.computed_stage}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admission Form Modal */}
      <Modal open={formModalOpen} onClose={() => setFormModalOpen(false)} title="Admission Form Document">
        <p style={{ fontSize: 13, color: BRAND.silver, marginBottom: 14 }}>
          Optional reference copy only — parents who pass their interview are sent the official Ed Admin online application link directly and no longer receive this file.
        </p>
        {admissionForm ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `${BRAND.silver}10`, padding: '10px 12px', borderRadius: 8, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.black }}>{admissionForm.file_name}</div>
              <div style={{ fontSize: 11, color: BRAND.silver, marginTop: 2 }}>
                Uploaded {new Date(admissionForm.uploaded_at).toLocaleDateString('en-GB')}{admissionForm.uploaded_by_name ? ` by ${admissionForm.uploaded_by_name}` : ''}
              </div>
            </div>
            <a href={admissionForm.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: BRAND.gold, fontWeight: 600 }}>View</a>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: BRAND.silver, marginBottom: 14, fontStyle: 'italic' }}>No reference file uploaded yet.</div>
        )}
        <Field label={admissionForm ? 'Replace with a new file' : 'Upload file'} hint="PDF, Word, or HTML page, up to 10MB">
          <input type="file" accept=".pdf,.doc,.docx,.html,.htm" disabled={uploadingForm}
            onChange={e => { if (e.target.files[0]) uploadAdmissionForm(e.target.files[0]); e.target.value = ''; }}
            style={{ fontSize: 13 }}/>
        </Field>
        {uploadingForm && <div style={{ fontSize: 12, color: BRAND.silver }}>Uploading…</div>}
      </Modal>

      {/* Add Lead Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add New Lead" width={620}>
        <form onSubmit={saveLead}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Parent Name" required><Input value={newLead.parent_name} onChange={e => setNewLead(f=>({...f,parent_name:e.target.value}))} required /></Field>
            <Field label="Phone Number" required hint="Required — primary way to convert"><Input value={newLead.parent_phone} onChange={e => setNewLead(f=>({...f,parent_phone:e.target.value}))} placeholder="07XX XXX XXX" required /></Field>
            <Field label="Email"><Input type="email" value={newLead.parent_email} onChange={e => setNewLead(f=>({...f,parent_email:e.target.value}))} /></Field>
            <Field label="WhatsApp Number"><Input value={newLead.whatsapp_number} onChange={e => setNewLead(f=>({...f,whatsapp_number:e.target.value}))} /></Field>
            <Field label="Child Name" required><Input value={newLead.child_name} onChange={e => setNewLead(f=>({...f,child_name:e.target.value}))} required /></Field>
            <Field label="Child Age"><Input type="number" value={newLead.child_age} onChange={e => setNewLead(f=>({...f,child_age:e.target.value}))} /></Field>
            <Field label="Interested Class" required><Input value={newLead.interested_class} onChange={e => setNewLead(f=>({...f,interested_class:e.target.value}))} required /></Field>
            <Field label="Boarding / Day">
              <Select value={newLead.boarding_day} onChange={e => setNewLead(f=>({...f,boarding_day:e.target.value}))}>
                <option value="day">Day Scholar</option>
                <option value="boarding">Boarding</option>
              </Select>
            </Field>
            <Field label="Lead Source">
              <Select value={newLead.source} onChange={e => setNewLead(f=>({...f,source:e.target.value}))}>
                {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </Select>
            </Field>
            <Field label="Campaign (optional)">
              <Select value={newLead.campaign_id} onChange={e => setNewLead(f=>({...f,campaign_id:e.target.value}))}>
                <option value="">None</option>
                {campaigns.filter(c=>c.status==='active').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            {!user?.campusId && (
              <Field label="Campus" required>
                <Select value={newLead.campus_id} onChange={e => setNewLead(f=>({...f,campus_id:e.target.value}))} required>
                  <option value="">Select campus</option>
                  {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            )}
          </div>
          <Field label="Notes"><Textarea value={newLead.notes} onChange={e => setNewLead(f=>({...f,notes:e.target.value}))} /></Field>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
            <Btn type="submit">Save Lead</Btn>
          </div>
        </form>
      </Modal>

      {/* Decline reason */}
      <Modal open={declineOpen} onClose={() => setDeclineOpen(false)} title="Mark lead declined" width={480}>
        <p style={{ fontSize: 13, color: BRAND.silver, marginBottom: 12 }}>
          Capture why the family dropped out — fees, distance, chose another school, timing, etc.
        </p>
        <Field label="Reason" required>
          <Textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={3} placeholder="e.g. Chose a school closer to home" />
        </Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
          <Btn variant="secondary" onClick={() => setDeclineOpen(false)}>Cancel</Btn>
          <Btn variant="danger" onClick={confirmDecline}>Confirm declined</Btn>
        </div>
      </Modal>

      {/* Lead Detail Drawer */}
      <LeadDrawer lead={selected} campuses={campuses} isGlobal={!user?.campusId} onClose={() => setSelected(null)} onUpdate={updateLead} onDecline={openDecline} onBookTour={bookTour} onBookInterview={bookInterview} onInterviewOutcome={interviewOutcome} onSendFormLink={sendFormLink} onMarkEnrolled={markEnrolled} onRecordPayment={recordPayment} />
    </Layout>
  );
}

function LeadDrawer({ lead, campuses, isGlobal, onClose, onUpdate, onDecline, onBookTour, onBookInterview, onInterviewOutcome, onSendFormLink, onMarkEnrolled, onRecordPayment }) {
  const [notes, setNotes]   = useState('');
  const [followUp, setFollowUp] = useState('');
  const [tourOpen, setTourOpen] = useState(false);
  const [tourDate, setTourDate] = useState('');
  const [tourTime, setTourTime] = useState('');
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');
  const [interviewCampusId, setInterviewCampusId] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentRef, setPaymentRef] = useState('');

  useEffect(() => {
    if (lead) {
      setNotes(lead.notes || ''); setFollowUp(lead.follow_up_date?.slice(0,10) || '');
      setTourOpen(false); setTourDate(''); setTourTime('');
      setInterviewOpen(false); setInterviewDate(''); setInterviewTime(''); setInterviewCampusId(lead.campus_id || '');
      setPaymentOpen(false); setPaymentAmount(''); setPaymentMethod('bank_transfer'); setPaymentRef('');
    }
  }, [lead]);

  if (!lead) return null;

  const TIMELINE = [
    { label: 'Interested Lead', done: true, date: lead.created_at },
    { label: 'Tour Booked',     done: lead.has_tour, date: null },
    { label: 'Interview',       done: lead.has_interview, date: lead.interview_date },
    { label: 'Register (Form Filled)', done: lead.has_application, date: null },
    { label: 'Admission Paid',  done: lead.has_payment, date: null },
  ];

  // Can (re)book: tour done, and either no interview yet or the latest one failed.
  const canBookInterview = lead.has_tour && (!lead.has_interview || lead.interview_outcome === 'failed');
  const awaitingOutcome  = lead.has_interview && lead.interview_outcome === 'pending';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(15,45,94,0.3)' }}/>
      <div style={{ width: 420, background: 'white', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${BRAND.silver}26`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: BRAND.black }}>{lead.parent_name}</div>
            <div style={{ fontSize: 13, color: BRAND.silver, marginTop: 2 }}>{lead.child_name} · {lead.interested_class || '—'}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge status={lead.computed_stage} />
              <VitalityChip lead={lead} />
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BRAND.silver }}><X size={20}/></button>
        </div>

        <div style={{ padding: 24, flex: 1 }}>
          {/* Contact */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.silver, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Contact</div>
            {lead.parent_phone && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <a href={telHref(lead.parent_phone)} onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: BRAND.electricBlue, fontWeight: 600, textDecoration: 'none' }}>
                  <Phone size={13}/>{lead.parent_phone}
                </a>
                {(whatsappHref(lead.whatsapp_number || lead.parent_phone, `Habari ${lead.parent_name?.split(' ')[0] || ''}, this is Silverleaf Academy regarding ${lead.child_name || 'your child'}'s admission.`) ) && (
                  <a
                    href={whatsappHref(lead.whatsapp_number || lead.parent_phone, `Habari ${lead.parent_name?.split(' ')[0] || ''}, this is Silverleaf Academy regarding ${lead.child_name || 'your child'}'s admission.`)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '4px 10px', borderRadius: 20, textDecoration: 'none' }}
                  >
                    <MessageCircle size={12}/> WhatsApp
                  </a>
                )}
              </div>
            )}
            {lead.parent_email && <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: 13, color: BRAND.black }}><Mail size={13} color={BRAND.silver}/><a href={`mailto:${lead.parent_email}`} style={{ color: BRAND.electricBlue, textDecoration: 'none' }}>{lead.parent_email}</a></div>}
            {lead.sibling_flag && <div style={{ marginTop: 6, fontSize: 12, background: `${BRAND.gold}26`, color: BRAND.gold, padding: '4px 10px', borderRadius: 20, display: 'inline-block', fontWeight: 600 }}>⭐ Sibling / Returning Family</div>}
          </div>

          {(() => {
            const v = computeLeadVitality(lead);
            return (
              <div style={{ marginBottom: 20, padding: 12, background: `${(VITALITY_COLORS[v.status] || '#6b7280')}12`, borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.silver, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Auto signal — {v.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.black, marginBottom: 6 }}>{v.next}</div>
                {v.reasons?.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: BRAND.silver }}>
                    {v.reasons.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                )}
              </div>
            );
          })()}

          {/* Milestone timeline */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.silver, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Milestone Timeline</div>
            <div style={{ position: 'relative', paddingLeft: 20 }}>
              <div style={{ position: 'absolute', left: 6, top: 0, bottom: 0, width: 2, background: `${BRAND.silver}40`, borderRadius: 2 }}/>
              {TIMELINE.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12, position: 'relative' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: t.done ? '#27ae60' : `${BRAND.silver}40`, border: '2px solid white', position: 'absolute', left: -14, top: 2, zIndex: 1 }}/>
                  <div style={{ paddingLeft: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.done ? BRAND.black : BRAND.silver }}>{t.label}</div>
                    {t.date && <div style={{ fontSize: 11, color: BRAND.silver }}>{new Date(t.date).toLocaleDateString('en-GB')}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.silver, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Notes</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              style={{ width: '100%', padding: '8px 10px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13, resize: 'vertical' }}/>
          </div>

          {/* Follow-up */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.silver, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Follow-up Date</div>
            <input type="date" value={followUp} onChange={e => setFollowUp(e.target.value)}
              style={{ padding: '8px 10px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13, width: '100%' }}/>
          </div>

          {/* Stage actions */}
          {!['admission_paid', 'declined', 'lapsed', 'dead_lead'].includes(lead.computed_stage) && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.silver, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Next step to enrol</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lead.computed_stage !== 'enrolled' && !lead.has_tour && (
                  tourOpen ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: `${BRAND.silver}10`, padding: 10, borderRadius: 8 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input type="date" value={tourDate} onChange={e => setTourDate(e.target.value)}
                          style={{ flex: 1, padding: '8px 10px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13 }}/>
                        <input type="time" value={tourTime} onChange={e => setTourTime(e.target.value)}
                          style={{ flex: 1, padding: '8px 10px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13 }}/>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn small onClick={() => { if (!tourDate) { toast.error('Pick a tour date.'); return; } onBookTour(lead, tourDate, tourTime); setTourOpen(false); }}>Confirm Tour</Btn>
                        <Btn variant="secondary" small onClick={() => setTourOpen(false)}>Cancel</Btn>
                      </div>
                    </div>
                  ) : (
                    <Btn small onClick={() => setTourOpen(true)}>📅 Book Campus Tour</Btn>
                  )
                )}
                {lead.computed_stage !== 'enrolled' && canBookInterview && (
                  interviewOpen ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: `${BRAND.silver}10`, padding: 10, borderRadius: 8 }}>
                      {isGlobal && (
                        <select value={interviewCampusId} onChange={e => setInterviewCampusId(e.target.value)}
                          style={{ padding: '8px 10px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13 }}>
                          {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input type="date" value={interviewDate} onChange={e => setInterviewDate(e.target.value)}
                          style={{ flex: 1, padding: '8px 10px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13 }}/>
                        <input type="time" value={interviewTime} onChange={e => setInterviewTime(e.target.value)}
                          style={{ flex: 1, padding: '8px 10px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13 }}/>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn small onClick={() => { if (!interviewDate) { toast.error('Pick an interview date.'); return; } onBookInterview(lead, interviewDate, interviewTime, interviewCampusId); setInterviewOpen(false); }}>Confirm Interview</Btn>
                        <Btn variant="secondary" small onClick={() => setInterviewOpen(false)}>Cancel</Btn>
                      </div>
                    </div>
                  ) : (
                    <Btn small onClick={() => setInterviewOpen(true)}>🎤 {lead.interview_outcome === 'failed' ? 'Rebook Interview' : 'Book Interview'}</Btn>
                  )
                )}
                {awaitingOutcome && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn small onClick={() => onInterviewOutcome(lead.interview_id, 'passed')}>✅ Mark Interview Passed</Btn>
                    <Btn small variant="danger" onClick={() => onInterviewOutcome(lead.interview_id, 'failed')}>❌ Mark Interview Failed</Btn>
                  </div>
                )}
                {lead.computed_stage !== 'enrolled' && !lead.has_application && lead.interview_outcome === 'passed' && (
                  <Btn small variant="secondary" onClick={() => onSendFormLink(lead.id)}>📨 Resend Application Link</Btn>
                )}
                {lead.computed_stage === 'form_filled' && (
                  <Btn small onClick={() => onMarkEnrolled(lead.id)}>🎓 Mark as Enrolled</Btn>
                )}
                {lead.computed_stage === 'enrolled' && (
                  paymentOpen ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: `${BRAND.silver}10`, padding: 10, borderRadius: 8 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input type="number" placeholder="Amount (TZS)" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                          style={{ flex: 1, padding: '8px 10px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13 }}/>
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                          style={{ flex: 1, padding: '8px 10px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13 }}>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="mobile_money">Mobile Money</option>
                          <option value="cash">Cash</option>
                          <option value="cheque">Cheque</option>
                        </select>
                      </div>
                      <input type="text" placeholder="Reference number (optional)" value={paymentRef} onChange={e => setPaymentRef(e.target.value)}
                        style={{ padding: '8px 10px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13 }}/>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn small onClick={() => { if (!paymentAmount) { toast.error('Enter the amount paid.'); return; } onRecordPayment(lead, paymentAmount, paymentMethod, paymentRef); setPaymentOpen(false); }}>Confirm Payment</Btn>
                        <Btn variant="secondary" small onClick={() => setPaymentOpen(false)}>Cancel</Btn>
                      </div>
                    </div>
                  ) : (
                    <Btn small onClick={() => setPaymentOpen(true)}>💳 Record Payment</Btn>
                  )
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => { onUpdate(lead.id, { notes, follow_up_date: followUp || null }); onClose(); }}>Save Changes</Btn>
            <Btn variant="danger" small onClick={() => onDecline(lead.id)}>Mark Declined</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
