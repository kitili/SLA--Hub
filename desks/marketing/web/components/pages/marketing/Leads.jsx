'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Phone, Mail, Clock, X, ChevronDown, ChevronRight, MessageCircle, AlertTriangle, Pencil, Trash2, LayoutGrid, List as ListIcon, Columns3, Eye, Download, WifiOff, CloudUpload } from 'lucide-react';
import api from '@/lib/api';
import Layout from '@/components/shared/Layout';
import { Modal, Badge, Btn, Field, Input, Select, Textarea, PageHeader, Empty, Spinner, Table, ExportMenu, Pagination } from '@/components/shared/UI';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCampusFilterStore } from '@/lib/campusFilter';
import { BRAND } from '@/theme';
import { telHref, whatsappHref, isFollowUpOverdue } from '@/lib/phone';
import { computeLeadVitality, VITALITY_COLORS } from '@/lib/leadVitality';
import { CLASSES, SOURCES, HOW_HEARD, TERMS, CHILD_AGES, FAMILY_SIZES, REGIONS, RESIDENCES, OCCUPATIONS, CONTACT_CHANNELS, CONTACT_OUTCOMES, EMPTY_LEAD, leadToForm, validateLeadCreate } from '@/lib/leadFields';
import { isBrowserOffline, isNetworkError } from '@/lib/network';
import {
  buildLeadCreatePayload,
  cacheLeadsList,
  enqueueOfflineLead,
  loadLeadLookups,
  loadLeadsList,
  pendingLeadToRow,
  saveLeadLookups,
  SYNCED_EVENT,
  useOfflineLeadQueue,
} from '@/lib/offlineLeads';

const STAGES = [
  { key: 'interested_lead', label: 'Interested',     color: '#3498db' },
  { key: 'tour_booked',     label: 'Tour Booked',    color: '#f39c12' },
  { key: 'interview_booked',label: 'Interview',      color: '#16a085' },
  { key: 'form_filled',     label: 'Register',       color: '#8e44ad' },
  { key: 'enrolled',        label: 'Enrolled',       color: '#27ae60' },
  { key: 'admission_paid',  label: 'Admission Paid', color: '#c9a84c' },
  { key: 'dead_lead',       label: 'Dead Lead',      color: '#7f8c8d' },
];

const LIST_PAGE_SIZE = 25;
const KANBAN_PAGE_SIZE = 20;
const DECLINED_PAGE_SIZE = 25;

const OTHER_SENTINEL = '__other__';

function ChoiceSelect({ value, onChange, options, required, placeholder }) {
  const isSentinel = value === OTHER_SENTINEL;
  const extraOption = value && !isSentinel && !options.includes(value) ? value : null;
  const selectValue = isSentinel ? 'Other' : (value || '');
  return (
    <>
      <Select
        value={selectValue}
        required={required}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next === 'Other' ? OTHER_SENTINEL : next);
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        {extraOption ? <option value={extraOption}>{extraOption}</option> : null}
        <option value="Other">Other</option>
      </Select>
      {(isSentinel || extraOption) && (
        <Input
          style={{ marginTop: 8 }}
          value={isSentinel ? '' : value}
          required={required}
          placeholder="Type it here"
          onChange={(e) => onChange(e.target.value.trim() ? e.target.value : OTHER_SENTINEL)}
        />
      )}
    </>
  );
}

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('en-GB');
}

function sheetDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function sheetDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-GB');
}

function sheetYesNo(value) {
  return value ? 'Yes' : '';
}

function sheetText(value) {
  if (value == null || value === '') return '';
  return String(value).replace(/_/g, ' ');
}

const LEAD_SHEET_COLUMNS = [
  'ID', 'Parent', 'Phone', 'Phone 2', 'WhatsApp', 'Email',
  'Child', 'Age', 'Gender', 'Class', 'Boarding / Day',
  'Stage', 'Signal', 'Score', 'Source', 'How heard', 'Source detail',
  'Campus', 'Head', 'Entered by', 'Follow-up', 'Last contacted',
  'Occupation', 'Residence', 'Region', 'Children in family', 'Intended term',
  'Campaign', 'Notes', 'Tour', 'Application', 'Payment', 'Interview', 'Interview outcome',
  'Created',
];

function leadToSheetRow(lead) {
  return [
    lead.id,
    lead.parent_name || '',
    lead.parent_phone || '',
    lead.parent_phone2 || '',
    lead.whatsapp_number || '',
    lead.parent_email || '',
    lead.child_name || '',
    lead.child_age ?? '',
    lead.child_gender || '',
    lead.interested_class || '',
    sheetText(lead.boarding_day),
    sheetText(lead.computed_stage),
    lead.vitality?.status || computeLeadVitality(lead).status || '',
    lead.lead_score || 0,
    sheetText(lead.source),
    lead.how_heard || '',
    lead.source_detail || '',
    lead.campus_name || '',
    lead.assigned_name || '',
    lead.created_by_name || 'Unknown / online form',
    sheetDate(lead.follow_up_date),
    sheetDateTime(lead.last_contacted_at),
    lead.occupation || '',
    lead.residence || '',
    lead.region || '',
    lead.num_children ?? '',
    lead.intended_term || '',
    lead.campaign_name || '',
    lead.notes || '',
    sheetYesNo(lead.has_tour),
    sheetYesNo(lead.has_application),
    sheetYesNo(lead.has_payment),
    sheetYesNo(lead.has_interview),
    sheetText(lead.interview_outcome),
    sheetDateTime(lead.created_at),
  ];
}

function LeadFormFields({ form, setForm, campuses, campaigns, campusHeads = [], user, showFollowUp, create }) {
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setValue = (k) => (value) => setForm(f => ({ ...f, [k]: value }));
  const extra = !!create;
  return (
    <>
      {create && (
        <p style={{ fontSize: 12, color: BRAND.silver, margin: '0 0 14px' }}>
          Fields marked * are required. Notes, campaign, second phone, and email can stay blank.
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Parent Name" required><Input value={form.parent_name} onChange={set('parent_name')} required /></Field>
        <Field label="Phone Number" required hint="Required — primary way to convert"><Input value={form.parent_phone} onChange={set('parent_phone')} placeholder="07XX XXX XXX" required /></Field>
        <Field label="Second phone"><Input value={form.parent_phone2 || ''} onChange={set('parent_phone2')} /></Field>
        <Field label="WhatsApp Number" required={extra}><Input value={form.whatsapp_number} onChange={set('whatsapp_number')} required={extra} /></Field>
        <Field label="Email"><Input type="email" value={form.parent_email} onChange={set('parent_email')} /></Field>
        <Field label="Occupation" required={extra}>
          <ChoiceSelect value={form.occupation || ''} onChange={setValue('occupation')} options={OCCUPATIONS} required={extra} placeholder="Select occupation" />
        </Field>
        <Field label="Residence" required={extra} hint="Area or neighbourhood">
          <ChoiceSelect value={form.residence || ''} onChange={setValue('residence')} options={RESIDENCES} required={extra} placeholder="Select residence" />
        </Field>
        <Field label="Region" required={extra}>
          <ChoiceSelect value={form.region || ''} onChange={setValue('region')} options={REGIONS} required={extra} placeholder="Select region" />
        </Field>
        <Field label="Child Name" required><Input value={form.child_name} onChange={set('child_name')} required /></Field>
        <Field label="Interested Class" required>
          <Select value={form.interested_class} onChange={set('interested_class')} required>
            <option value="">Select class</option>
            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Child Age" required={extra}>
          <Select value={form.child_age === 0 || form.child_age === '0' ? '0' : (form.child_age || '')} onChange={set('child_age')} required={extra}>
            <option value="">Select age</option>
            {CHILD_AGES.map((age) => <option key={age} value={age}>{age}</option>)}
          </Select>
        </Field>
        <Field label="Child gender" required={extra}>
          <Select value={form.child_gender || ''} onChange={set('child_gender')} required={extra}>
            <option value="">Select gender</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </Select>
        </Field>
        <Field label="Children in family" required={extra}>
          <Select value={String(form.num_children ?? '')} onChange={set('num_children')} required={extra}>
            <option value="">Select number</option>
            {FAMILY_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>
        <Field label="Boarding / Day" required={extra}>
          <Select value={form.boarding_day} onChange={set('boarding_day')} required={extra}>
            <option value="day">Day Scholar</option>
            <option value="boarding">Boarding</option>
          </Select>
        </Field>
        <Field label="Intended term" required={extra}>
          <Select value={form.intended_term || ''} onChange={set('intended_term')} required={extra}>
            <option value="">Select term</option>
            {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Lead Source" required={extra}>
          <Select value={form.source} onChange={set('source')} required={extra}>
            <option value="">Select source</option>
            {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
          </Select>
        </Field>
        <Field label="How they heard" required={extra}>
          <Select value={form.how_heard || ''} onChange={set('how_heard')} required={extra}>
            <option value="">Select how they heard</option>
            {HOW_HEARD.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Who referred / school" required={extra} hint="Staff name, feeder school, or N/A if none">
          <Input value={form.source_detail || ''} onChange={set('source_detail')} placeholder="e.g. Staff name or feeder school" required={extra} />
        </Field>
        <Field label="Campaign (optional)">
          <Select value={form.campaign_id} onChange={set('campaign_id')}>
            <option value="">None</option>
            {campaigns.filter(c=>c.status==='active').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        {!user?.campusId && (
          <Field label="Campus" required>
            <Select value={form.campus_id} onChange={set('campus_id')} required>
              <option value="">Select campus</option>
              {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        {campusHeads.length > 0 && (
          <Field label="Assigned head of school">
            <Select value={form.assigned_to || ''} onChange={set('assigned_to')}>
              <option value="">Unassigned</option>
              {campusHeads
                .filter((h) => !form.campus_id || String(h.campus_id) === String(form.campus_id))
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}{h.campus_name ? ` · ${h.campus_name}` : ''}
                  </option>
                ))}
            </Select>
          </Field>
        )}
        {showFollowUp && (
          <Field label="Follow-up Date">
            <Input type="date" value={form.follow_up_date || ''} onChange={set('follow_up_date')} />
          </Field>
        )}
      </div>
      <Field label="Notes"><Textarea value={form.notes} onChange={set('notes')} /></Field>
    </>
  );
}

function withQuery(path, extra = {}) {
  const q = new URLSearchParams();
  Object.entries(extra).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}

function leadQuery(extra = {}) {
  return withQuery('/marketing/leads', extra);
}

const FILTER_SELECT = {
  padding: '8px 12px',
  border: `1.5px solid ${BRAND.silver}40`,
  borderRadius: 7,
  fontSize: 13,
  color: BRAND.black,
  background: 'white',
  minWidth: 168,
};

function ScoreDot({ score }) {
  const color = score >= 70 ? '#27ae60' : score >= 40 ? '#f39c12' : '#e74c3c';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }}/>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{score}</span>
    </div>
  );
}

function ContactLog({ lead }) {
  const [rows, setRows] = useState([]);
  const [channel, setChannel] = useState('whatsapp');
  const [outcome, setOutcome] = useState('left_message');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await api.get(`/marketing/leads/${lead.id}/contacts`);
      setRows(r.data || []);
    } catch { /* table may not exist until migrate */ }
  }

  useEffect(() => { if (lead?.id) load(); }, [lead?.id]);

  async function save() {
    setBusy(true);
    try {
      await api.post(`/marketing/leads/${lead.id}/contacts`, { channel, outcome, notes: note });
      toast.success('Contact logged — vitality will use this, not just last edit.');
      setNote('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not log contact. Run the latest DB migration.');
    } finally { setBusy(false); }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.silver, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Log a contact</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <select value={channel} onChange={e => setChannel(e.target.value)} style={{ padding: '8px 10px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13 }}>
          {CONTACT_CHANNELS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select value={outcome} onChange={e => setOutcome(e.target.value)} style={{ padding: '8px 10px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13 }}>
          {CONTACT_OUTCOMES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="What did they say?"
        style={{ width: '100%', padding: '8px 10px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13, marginBottom: 8 }} />
      <Btn small disabled={busy} onClick={save}>Save contact</Btn>
      {rows.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: BRAND.silver }}>
          {rows.slice(0, 6).map(r => (
            <div key={r.id} style={{ padding: '4px 0', borderBottom: `1px solid ${BRAND.silver}22` }}>
              {new Date(r.created_at).toLocaleString('en-GB')} · {r.channel} · {r.outcome.replace('_', ' ')}
              {r.notes ? ` — ${r.notes}` : ''}
            </div>
          ))}
        </div>
      )}
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

function LeadCard({ lead, onClick, stacked = true, onEdit, onDelete }) {
  const daysSince = Math.floor((Date.now() - new Date(lead.updated_at || lead.created_at || Date.now())) / 86400000);
  const overdue = !lead.offlineId && isFollowUpOverdue(lead);
  const queued = !!lead.offlineId;
  return (
    <div onClick={() => onClick?.(lead)} style={{ background: 'white', borderRadius: 10, padding: '12px 14px', marginBottom: stacked ? 8 : 0, height: stacked ? undefined : '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', cursor: onClick ? 'pointer' : 'default', borderLeft: queued ? '3px solid #d97706' : overdue ? '3px solid #e74c3c' : lead.sibling_flag ? `3px solid ${BRAND.gold}` : '3px solid transparent', transition: 'box-shadow 0.15s', display: 'flex', flexDirection: 'column' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.07)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.black }}>{lead.parent_name}</div>
        {queued
          ? <span style={{ fontSize: 10, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 7px', borderRadius: 10 }}>{lead.offlineStatus === 'error' ? 'Sync failed' : 'On this device'}</span>
          : <ScoreDot score={lead.lead_score || 0} />}
      </div>
      <div style={{ fontSize: 12, color: BRAND.silver, marginBottom: 4 }}>
        {lead.child_name || '—'} · {lead.interested_class || '—'}
        {lead.campus_name ? ` · ${lead.campus_name}` : ''}
      </div>
      {lead.parent_phone && (
        <div style={{ fontSize: 12, color: BRAND.electricBlue, marginBottom: 4, fontWeight: 600 }}>{lead.parent_phone}</div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <Badge status={lead.computed_stage} />
        <VitalityChip lead={lead} />
      </div>
      <div style={{ fontSize: 11, color: BRAND.silver, marginBottom: 4 }}>
        {lead.assigned_name ? `Head: ${lead.assigned_name}` : 'Unassigned'}
        {lead.follow_up_date ? ` · Follow-up ${fmtDate(lead.follow_up_date)}` : ''}
      </div>
      <div style={{ fontSize: 11, color: BRAND.electricBlue, marginBottom: 4, fontWeight: 600 }}>
        Entered by {lead.created_by_name || (lead.offlineId ? 'you (this device)' : 'Unknown / online form')}
      </div>
      {overdue && (
        <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={10}/> Needs follow-up
        </div>
      )}
      {queued && lead.offlineError && (
        <div style={{ fontSize: 11, color: '#b91c1c', marginBottom: 4 }}>{lead.offlineError}</div>
      )}
      {lead.interview_outcome === 'passed' && <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>✔ Interview Passed</span>}
      {lead.interview_outcome === 'failed' && <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>✘ Interview Failed</span>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 6 }}>
        <span style={{ fontSize: 11, color: BRAND.silver }}>{lead.source?.replace('_', ' ')}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {lead.sibling_flag && <span title="Sibling" style={{ fontSize: 10, background: `${BRAND.gold}26`, color: BRAND.gold, padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>Sibling</span>}
          <span style={{ fontSize: 11, color: daysSince > 7 ? '#e74c3c' : BRAND.silver, display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={10}/>{daysSince}d
          </span>
        </div>
      </div>
      {(onClick || onEdit || onDelete) && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }} onClick={e => e.stopPropagation()}>
          {onClick && <Btn variant="secondary" small onClick={() => onClick(lead)}><Eye size={12}/> View</Btn>}
          {onEdit && <Btn variant="secondary" small onClick={() => onEdit(lead)}><Pencil size={12}/></Btn>}
          {onDelete && <Btn variant="danger" small onClick={() => onDelete(lead)}><Trash2 size={12}/></Btn>}
        </div>
      )}
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
  const [vitalityFilter, setVitalityFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const campusFilter = useCampusFilterStore((s) => s.campusId);
  const setCampusFilter = useCampusFilterStore((s) => s.setCampusId);
  const [headFilter, setHeadFilter] = useState('');
  const [enteredByFilter, setEnteredByFilter] = useState('');
  const [enteredBy, setEnteredBy] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [campusHeads, setCampusHeads] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [newLead, setNewLead]   = useState(EMPTY_LEAD);
  const [admissionForm, setAdmissionForm] = useState(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [uploadingForm, setUploadingForm] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineTargetId, setDeclineTargetId] = useState(null);
  const [viewMode, setViewMode] = useState('cards');
  const [editOpen, setEditOpen] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_LEAD);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [summary, setSummary] = useState(null);
  const [overdueTotal, setOverdueTotal] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listTotal, setListTotal] = useState(0);
  const [kanban, setKanban] = useState({});
  const [kanbanPages, setKanbanPages] = useState({});
  const [declinedPage, setDeclinedPage] = useState(1);
  const [declinedTotal, setDeclinedTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [exporting, setExporting] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const { items: offlineItems, online, syncing, syncNow, discard } = useOfflineLeadQueue(user?.id);

  const isGlobalViewer = !user?.campusId;
  const viewFilters = {
    campus_id: campusFilter || undefined,
    head_id: headFilter || undefined,
    created_by: enteredByFilter || undefined,
  };

  const fetchSummary = useCallback(async () => {
    try {
      const [sumRes, campRes, campRes2, headsRes, enteredRes] = await Promise.all([
        api.get(withQuery('/marketing/leads/report/summary', {
          campus_id: campusFilter || undefined,
          head_id: headFilter || undefined,
        })),
        api.get('/admin/campuses'),
        api.get('/marketing/campaigns'),
        api.get('/marketing/campus-heads'),
        api.get(withQuery('/marketing/leads/entered-by', {
          campus_id: campusFilter || undefined,
          head_id: headFilter || undefined,
        })),
      ]);
      setSummary(sumRes.data);
      setCampuses(campRes.data || []);
      setCampaigns(campRes2.data || []);
      setCampusHeads(headsRes.data || []);
      setEnteredBy(enteredRes.data?.data || []);
      setOverdueTotal(sumRes.data?.totals?.overdue || 0);
      saveLeadLookups({
        campuses: campRes.data || [],
        campaigns: campRes2.data || [],
        campusHeads: headsRes.data || [],
      });
    } catch {
      const lookups = loadLeadLookups();
      if (lookups) {
        if (lookups.campuses?.length) setCampuses(lookups.campuses);
        if (lookups.campaigns?.length) setCampaigns(lookups.campaigns);
        if (lookups.campusHeads?.length) setCampusHeads(lookups.campusHeads);
      }
    }
  }, [campusFilter, headFilter, isGlobalViewer]);

  const fetchList = useCallback(async () => {
    try {
      const res = await api.get(leadQuery({
        page: listPage,
        limit: LIST_PAGE_SIZE,
        search,
        overdue: needsFollowUpOnly ? 1 : undefined,
        vitality: vitalityFilter || undefined,
        stage: stageFilter || undefined,
        exclude_stages: stageFilter ? undefined : 'declined,lapsed',
        ...viewFilters,
      }));
      const rows = res.data?.data || [];
      setLeads(rows);
      setListTotal(res.data?.total || 0);
      cacheLeadsList(user?.id, rows);
      setSelected(prev => (prev ? rows.find(l => l.id === prev.id) || prev : null));
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      const cached = loadLeadsList(user?.id);
      if (cached?.rows?.length) {
        setLeads((prev) => (prev.length ? prev : cached.rows));
        setListTotal((prev) => prev || cached.rows.length);
      }
    }
  }, [listPage, search, needsFollowUpOnly, vitalityFilter, stageFilter, campusFilter, headFilter, enteredByFilter, user?.id]);

  const fetchKanban = useCallback(async () => {
    try {
      const next = {};
      await Promise.all(STAGES.map(async (stage) => {
        const page = kanbanPages[stage.key] || 1;
        const res = await api.get(leadQuery({
          stage: stage.key,
          page,
          limit: KANBAN_PAGE_SIZE,
          search,
          overdue: needsFollowUpOnly ? 1 : undefined,
          vitality: vitalityFilter || undefined,
          ...viewFilters,
        }));
        const rows = res.data?.data || [];
        next[stage.key] = { rows, total: res.data?.total || 0, page };
      }));
      setKanban(next);
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }, [search, needsFollowUpOnly, vitalityFilter, kanbanPages, campusFilter, headFilter, enteredByFilter]);

  const fetchDeclined = useCallback(async () => {
    try {
      const res = await api.get(leadQuery({
        stage: 'declined',
        page: declinedPage,
        limit: DECLINED_PAGE_SIZE,
        search,
        ...viewFilters,
      }));
      setDeclined(res.data?.data || []);
      setDeclinedTotal(res.data?.total || 0);
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }, [declinedPage, search, campusFilter, headFilter, enteredByFilter]);

  const refresh = useCallback(async (silent = false) => {
    if (isBrowserOffline()) {
      setLoading(false);
      return;
    }
    try {
      if (!silent) setLoading(true);
      await Promise.all([
        fetchSummary(),
        viewMode === 'board' ? fetchKanban() : fetchList(),
        showDeclined ? fetchDeclined() : Promise.resolve(),
      ]);
    } catch { toast.error('Failed to load leads.'); }
    finally { setLoading(false); }
  }, [fetchSummary, fetchList, fetchKanban, fetchDeclined, viewMode, showDeclined]);

  useEffect(() => { fetchAdmissionForm(); }, []);
  useEffect(() => {
    const lookups = loadLeadLookups();
    if (lookups) {
      if (lookups.campuses?.length) setCampuses(lookups.campuses);
      if (lookups.campaigns?.length) setCampaigns(lookups.campaigns);
      if (lookups.campusHeads?.length) setCampusHeads(lookups.campusHeads);
    }
    const cached = loadLeadsList(user?.id);
    if (cached?.rows?.length) {
      setLeads(cached.rows);
      setListTotal(cached.rows.length);
      setLoading(false);
    }
  }, [user?.id]);
  useEffect(() => { refresh(true); }, [refresh]);
  useEffect(() => {
    function onSynced() { refresh(true); }
    window.addEventListener(SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(SYNCED_EVENT, onSynced);
  }, [refresh]);

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setListPage(1);
      setDeclinedPage(1);
      setKanbanPages({});
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  function setKanbanPage(stageKey, page) {
    setKanbanPages(prev => ({ ...prev, [stageKey]: page }));
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
    const missing = validateLeadCreate(newLead, { isGlobal: !user?.campusId });
    if (missing) {
      toast.error(missing);
      return;
    }
    const payload = buildLeadCreatePayload(newLead, user);
    function queueLocally() {
      enqueueOfflineLead({ userId: user?.id, payload });
      toast.success('Saved on this device — it will upload when you are back online.');
      setAddOpen(false);
      setNewLead({ ...EMPTY_LEAD });
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      queueLocally();
      return;
    }
    setSavingLead(true);
    try {
      await api.post('/marketing/leads', payload, { timeout: 20000 });
      toast.success('Lead added — book a campus tour while interest is hot.');
      setAddOpen(false);
      setNewLead({ ...EMPTY_LEAD });
      refresh();
    } catch (err) {
      if (isNetworkError(err)) {
        queueLocally();
        return;
      }
      toast.error(err.response?.data?.error || 'Failed to add lead.');
    } finally {
      setSavingLead(false);
    }
  }

  async function updateLead(id, data) {
    try {
      await api.patch(`/marketing/leads/${id}`, data);
      toast.success('Lead updated.');
      refresh();
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
      refresh();
    } catch { toast.error('Update failed.'); }
  }

  function openEdit(lead) {
    setEditLead(lead);
    setEditForm(leadToForm(lead));
    setEditOpen(true);
    setSelected(null);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editForm.parent_name.trim() || !editForm.parent_phone.trim()) {
      toast.error('Parent name and phone are required.');
      return;
    }
    if (!editForm.child_name.trim() || !editForm.interested_class.trim()) {
      toast.error('Child name and class are required.');
      return;
    }
    try {
      await api.put(`/marketing/leads/${editLead.id}`, {
        ...editForm,
        child_age: editForm.child_age === '' ? null : editForm.child_age,
        campaign_id: editForm.campaign_id || null,
        follow_up_date: editForm.follow_up_date || null,
        assigned_to: editForm.assigned_to || null,
      });
      toast.success('Lead updated.');
      setEditOpen(false);
      setEditLead(null);
      refresh();
    } catch (err) { toast.error(err.response?.data?.error || 'Update failed.'); }
  }

  function openDelete(lead) {
    setDeleteTarget(lead);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/marketing/leads/${deleteTarget.id}`);
      toast.success('Lead archived.');
      setDeleteOpen(false);
      setDeleteTarget(null);
      setSelected(null);
      refresh();
    } catch (err) { toast.error(err.response?.data?.error || 'Delete failed.'); }
  }

  async function exportLeadsReport(format) {
    try {
      const [summaryRes, registerRes] = await Promise.all([
        api.get(withQuery('/marketing/leads/report/summary', viewFilters)),
        api.get(withQuery('/marketing/leads/export', { ...viewFilters, exclude_stages: 'declined,lapsed' }), { timeout: 60000 }),
      ]);
      const summary = summaryRes.data;
      const register = registerRes.data?.data || [];
      const sections = [
        {
          title: 'Leads Funnel Summary',
          stats: [
            { label: 'Total leads', value: summary.totals?.total },
            { label: 'Active in funnel', value: summary.totals?.active },
            { label: 'Admission paid', value: summary.totals?.paid },
            { label: 'Dead leads', value: summary.totals?.dead },
            { label: 'Declined / lapsed', value: summary.totals?.declined },
          ],
        },
        {
          title: 'By Stage',
          stats: (summary.stages || []).map(s => ({
            label: s.computed_stage?.replace(/_/g, ' '),
            value: s.count,
          })),
        },
        {
          title: 'By Source',
          columns: ['Source', 'Leads'],
          rows: (summary.sources || []).map(s => [s.source?.replace(/_/g, ' '), s.count]),
        },
        {
          title: 'Entered by (commission)',
          columns: ['Name', 'Campus', 'This month', 'Active', 'Paid', 'Total'],
          rows: enteredBy.map(s => [s.name, s.campuses || '—', s.this_month, s.active, s.paid, s.total]),
        },
        {
          title: 'Lead Register',
          columns: ['Parent', 'Child', 'Phone', 'Class', 'Stage', 'Source', 'Campus', 'Entered by', 'Score'],
          rows: register.map(l => [
            l.parent_name,
            l.child_name || '—',
            l.parent_phone,
            l.interested_class || '—',
            l.computed_stage?.replace(/_/g, ' '),
            l.source?.replace(/_/g, ' '),
            l.campus_name || '—',
            l.created_by_name || '—',
            l.lead_score || 0,
          ]),
        },
      ];
      const heading = `Leads Report — ${new Date(summary.generated_at).toLocaleDateString('en-GB')}`;
      const { exportReportPDF, exportReportExcel, exportReportWord } = await import('@/lib/reportExport');
      if (format === 'pdf') exportReportPDF('leads-report.pdf', heading, sections);
      else if (format === 'excel') exportReportExcel('leads-report.xlsx', heading, sections);
      else if (format === 'word') exportReportWord('leads-report.docx', heading, sections);
    } catch { toast.error('Export failed.'); }
  }

  async function exportLeadsSheet() {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await api.get(withQuery('/marketing/leads/export', {
        search,
        overdue: needsFollowUpOnly ? 1 : undefined,
        vitality: vitalityFilter || undefined,
        stage: stageFilter || undefined,
        exclude_stages: stageFilter ? undefined : 'declined,lapsed',
        ...viewFilters,
      }), { timeout: 60000 });
      const rows = res.data?.data || [];
      if (!rows.length) {
        toast.error('No leads match the current filters.');
        return;
      }
      const { exportSheetExcel } = await import('@/lib/reportExport');
      const stamp = new Date().toISOString().slice(0, 10);
      exportSheetExcel(
        `leads-sheet-${stamp}.xlsx`,
        'Leads',
        `Silverleaf leads — ${rows.length} of ${res.data?.total ?? rows.length}`,
        LEAD_SHEET_COLUMNS,
        rows.map(leadToSheetRow),
      );
      if (res.data?.truncated) {
        toast.success(`Exported first ${rows.length} of ${res.data.total} leads.`);
      } else {
        toast.success(`Exported ${rows.length} lead${rows.length === 1 ? '' : 's'}.`);
      }
    } catch {
      toast.error('Export failed.');
    } finally {
      setExporting(false);
    }
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
      refresh();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to book tour.'); }
  }

  async function bookInterview(lead, interview_date, interview_time, campus_id) {
    try {
      await api.post(`/marketing/leads/${lead.id}/interviews`, { interview_date, interview_time, campus_id });
      toast.success('Interview booked — parent notified by email/WhatsApp.');
      refresh();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to book interview.'); }
  }

  async function interviewOutcome(interviewId, outcome) {
    try {
      await api.patch(`/marketing/interviews/${interviewId}/outcome`, { outcome });
      toast.success(outcome === 'passed' ? 'Marked as passed — parent sent the Ed Admin application link.' : 'Marked as failed — parent notified.');
      refresh();
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
      refresh();
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
      refresh();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to record payment.'); }
  }

  const activeTotal = summary?.totals?.active ?? listTotal;
  const stageCount = (key) => summary?.stages?.find(s => s.computed_stage === key)?.count || kanban[key]?.total || 0;
  const pendingLeads = offlineItems
    .map((item) => pendingLeadToRow(item, campuses))
    .filter((lead) => {
      if (campusFilter && String(lead.campus_id) !== String(campusFilter)) return false;
      if (headFilter && lead.assigned_to && String(lead.assigned_to) !== String(headFilter)) return false;
      if (enteredByFilter && enteredByFilter !== 'none' && String(enteredByFilter) !== String(user?.id)) return false;
      if (enteredByFilter === 'none') return false;
      if (stageFilter && stageFilter !== 'interested_lead') return false;
      if (search) {
        const hay = `${lead.parent_name} ${lead.child_name} ${lead.parent_phone}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  const listRows = listPage === 1 ? [...pendingLeads, ...leads] : leads;

  async function syncQueuedLeads() {
    const result = await syncNow();
    if (!result.synced && result.remaining && online) {
      toast.error('Could not upload queued leads yet. Sign in again if your session expired.');
    }
  }

  function discardQueued(id) {
    discard(id);
    toast.success('Removed from this device.');
  }

  if (loading) return <Layout module="marketing"><Spinner /></Layout>;

  return (
    <Layout module="marketing">
      <PageHeader
        title="Leads Funnel"
        sub={`${activeTotal} active · ${overdueTotal} need follow-up`}
        action={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: BRAND.silver }}/>
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search leads…"
                style={{ padding: '8px 12px 8px 32px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13, width: 200 }}/>
            </div>
            {isGlobalViewer && (
              <>
                <select
                  aria-label="Filter by institution"
                  value={campusFilter}
                  onChange={(e) => {
                    const next = e.target.value;
                    setCampusFilter(next);
                    setHeadFilter((current) => {
                      if (!current) return current;
                      const head = campusHeads.find((h) => String(h.id) === String(current));
                      return head && String(head.campus_id) === String(next) ? current : '';
                    });
                    setListPage(1);
                    setDeclinedPage(1);
                    setKanbanPages({});
                  }}
                  style={FILTER_SELECT}
                >
                  <option value="">All campuses</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  aria-label="Filter by head of school"
                  value={headFilter}
                  onChange={(e) => {
                    const next = e.target.value;
                    setHeadFilter(next);
                    if (next) {
                      const head = campusHeads.find((h) => String(h.id) === String(next));
                      if (head?.campus_id) setCampusFilter(String(head.campus_id));
                    }
                    setListPage(1);
                    setDeclinedPage(1);
                    setKanbanPages({});
                  }}
                  style={FILTER_SELECT}
                >
                  <option value="">All heads of school</option>
                  {campusHeads
                    .filter((h) => !campusFilter || String(h.campus_id) === String(campusFilter))
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}{h.campus_name ? ` · ${h.campus_name}` : ''}
                      </option>
                    ))}
                </select>
              </>
            )}
            <select
              aria-label="Filter by who entered the lead"
              value={enteredByFilter}
              onChange={(e) => { setEnteredByFilter(e.target.value); setListPage(1); setKanbanPages({}); }}
              style={FILTER_SELECT}
            >
              <option value="">Entered by anyone</option>
              {enteredBy.map((row) => (
                <option key={row.created_by ?? 'none'} value={row.created_by ?? 'none'}>
                  {row.name} ({row.total})
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by stage"
              value={stageFilter}
              onChange={(e) => { setStageFilter(e.target.value); setListPage(1); setKanbanPages({}); }}
              style={FILTER_SELECT}
            >
              <option value="">All stages</option>
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <Btn
              variant={needsFollowUpOnly ? 'primary' : 'secondary'}
              onClick={() => { setNeedsFollowUpOnly(v => !v); setListPage(1); setKanbanPages({}); }}
            >
              <AlertTriangle size={15}/>
              {needsFollowUpOnly ? 'Showing overdue' : `Needs follow-up (${overdueTotal})`}
            </Btn>
            {[
              { key: 'hot', label: 'Potential' },
              { key: 'cold', label: 'At risk' },
              { key: 'dead', label: 'Likely dead' },
            ].map(opt => (
              <Btn
                key={opt.key}
                variant={vitalityFilter === opt.key ? 'primary' : 'secondary'}
                onClick={() => { setVitalityFilter(v => v === opt.key ? '' : opt.key); setListPage(1); setKanbanPages({}); }}
              >
                {opt.label}{summary?.vitality?.[opt.key] != null ? ` (${summary.vitality[opt.key]})` : ''}
              </Btn>
            ))}
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${BRAND.silver}40` }}>
              {[
                { key: 'cards', label: 'Cards', Icon: LayoutGrid },
                { key: 'rows', label: 'Rows', Icon: ListIcon },
                { key: 'board', label: 'Board', Icon: Columns3 },
              ].map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setViewMode(key); setListPage(1); }}
                  title={label}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 10px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: viewMode === key ? BRAND.electricBlue : 'white',
                    color: viewMode === key ? 'white' : BRAND.silver,
                  }}
                >
                  <Icon size={15}/>{label}
                </button>
              ))}
            </div>
            <Btn variant="secondary" disabled={exporting} onClick={exportLeadsSheet}>
              <Download size={15}/>{exporting ? 'Exporting…' : 'Export sheet'}
            </Btn>
            <ExportMenu onExport={exportLeadsReport} disabled={exporting} />
            <Btn variant="secondary" onClick={() => setFormModalOpen(true)}>📄 Admission Form</Btn>
            <Btn onClick={() => setAddOpen(true)}><Plus size={15}/>Add Lead</Btn>
          </div>
        }
      />

      {(!online || pendingLeads.length > 0) && (
        <div style={{
          marginBottom: 16, padding: '12px 16px',
          background: online ? '#eff6ff' : '#fff7ed',
          border: `1px solid ${online ? '#bfdbfe' : '#fed7aa'}`,
          borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 13, color: online ? '#1e3a8a' : '#9a3412', display: 'flex', alignItems: 'center', gap: 8 }}>
            {online ? <CloudUpload size={16}/> : <WifiOff size={16}/>}
            <span>
              {!online
                ? 'You are offline. New leads stay on this device and upload when you reconnect.'
                : `${pendingLeads.length} lead${pendingLeads.length === 1 ? '' : 's'} waiting to upload.`}
            </span>
          </div>
          {pendingLeads.length > 0 && (
            <Btn small variant="secondary" disabled={!online || syncing} onClick={syncQueuedLeads}>
              {syncing ? 'Uploading…' : 'Upload now'}
            </Btn>
          )}
        </div>
      )}

      {enteredBy.length > 0 && (
        <div style={{ marginBottom: 16, background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BRAND.silver}22`, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.black }}>Who entered these leads</div>
              <div style={{ fontSize: 12, color: BRAND.silver, marginTop: 2 }}>
                Counts for commission — tap a person to see only their leads.
              </div>
            </div>
          </div>
          <Table
            onRowClick={(row) => {
              const next = row.created_by == null ? 'none' : String(row.created_by);
              setEnteredByFilter((current) => (current === next ? '' : next));
              setListPage(1);
              setKanbanPages({});
            }}
            cols={[
              { key: 'name', label: 'Entered by', render: r => (
                <span style={{ fontWeight: enteredByFilter && String(enteredByFilter) === String(r.created_by ?? 'none') ? 700 : 500 }}>
                  {r.name}
                </span>
              ) },
              { key: 'campuses', label: 'Campus', render: r => r.campuses || '—' },
              { key: 'this_month', label: 'This month', render: r => r.this_month || 0 },
              { key: 'active', label: 'Active', render: r => r.active || 0 },
              { key: 'paid', label: 'Paid', render: r => r.paid || 0 },
              { key: 'total', label: 'Total entered', render: r => <strong>{r.total || 0}</strong> },
            ]}
            rows={enteredBy}
            keyFn={r => r.created_by ?? 'none'}
          />
        </div>
      )}

      {overdueTotal > 0 && !needsFollowUpOnly && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#991b1b' }}>
            <strong>{overdueTotal}</strong> parent{overdueTotal === 1 ? '' : 's'} waiting — every day without a call costs enrolment.
          </div>
          <Btn small variant="danger" onClick={() => { setNeedsFollowUpOnly(true); setListPage(1); setKanbanPages({}); }}>Review now</Btn>
        </div>
      )}
      {viewMode === 'rows' && (
        <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          <Table
            onRowClick={setSelected}
            cols={[
              { key: 'parent_name', label: 'Parent' },
              { key: 'child_name', label: 'Child', render: r => r.child_name || '—' },
              { key: 'parent_phone', label: 'Phone' },
              { key: 'campus_name', label: 'Institution', render: r => r.campus_name || '—' },
              { key: 'assigned_name', label: 'Head', render: r => r.assigned_name || '—' },
              { key: 'created_by_name', label: 'Entered by', render: r => r.created_by_name || (r.offlineId ? 'On this device' : 'Unknown / online form') },
              { key: 'interested_class', label: 'Class', render: r => r.interested_class || '—' },
              { key: 'stage', label: 'Stage', render: r => <Badge status={r.computed_stage} /> },
              { key: 'vitality', label: 'Signal', render: r => <VitalityChip lead={r} /> },
              { key: 'follow_up_date', label: 'Follow-up', render: r => fmtDate(r.follow_up_date) },
              { key: 'source', label: 'Source', render: r => r.source?.replace(/_/g, ' ') },
              { key: 'score', label: 'Score', render: r => r.lead_score || 0 },
              { key: 'actions', label: 'CRUD', render: r => (
                <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                  <Btn variant="secondary" small onClick={() => setSelected(r)}><Eye size={12}/> View</Btn>
                  {r.offlineId ? (
                    <Btn variant="danger" small onClick={() => discardQueued(r.offlineId)}><Trash2 size={12}/></Btn>
                  ) : (
                    <>
                      <Btn variant="secondary" small onClick={() => openEdit(r)}><Pencil size={12}/></Btn>
                      <Btn variant="danger" small onClick={() => openDelete(r)}><Trash2 size={12}/></Btn>
                    </>
                  )}
                </div>
              )},
            ]}
            rows={listRows}
            keyFn={r => r.id}
          />
          <Pagination page={listPage} total={listTotal} limit={LIST_PAGE_SIZE} onChange={setListPage} />
        </div>
      )}

      {viewMode === 'cards' && (
        <div>
          {leads.length === 0 && pendingLeads.length === 0 ? (
            <Empty title="No leads match these filters" sub="Clear a filter or add a new lead." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {listRows.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  stacked={false}
                  onClick={setSelected}
                  onEdit={lead.offlineId ? undefined : openEdit}
                  onDelete={lead.offlineId ? () => discardQueued(lead.offlineId) : openDelete}
                />
              ))}
            </div>
          )}
          <div style={{ background: 'white', borderRadius: 10, marginTop: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <Pagination page={listPage} total={listTotal} limit={LIST_PAGE_SIZE} onChange={setListPage} />
          </div>
        </div>
      )}

      {viewMode === 'board' && (
      <div style={{ overflowX: 'auto', paddingBottom: 8, WebkitOverflowScrolling: 'touch' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${STAGES.length}, minmax(240px, 1fr))`,
          gap: 12,
          minWidth: STAGES.length * 252,
        }}>
          {STAGES.map(stage => {
            const col = kanban[stage.key] || { rows: [], total: stageCount(stage.key), page: kanbanPages[stage.key] || 1 };
            return (
              <div key={stage.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px', background: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color }}/>
                  <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.black }}>{stage.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: stage.color, background: stage.color + '15', padding: '1px 8px', borderRadius: 10 }}>{col.total}</span>
                </div>
                <div style={{ minHeight: 100 }}>
                  {(stage.key === 'interested_lead' ? [...pendingLeads, ...col.rows] : col.rows).map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onClick={setSelected}
                      onEdit={lead.offlineId ? undefined : openEdit}
                      onDelete={lead.offlineId ? () => discardQueued(lead.offlineId) : openDelete}
                    />
                  ))}
                  {col.rows.length === 0 && (stage.key !== 'interested_lead' || pendingLeads.length === 0) && (
                    <div style={{ textAlign: 'center', padding: '24px 12px', color: `${BRAND.silver}80`, fontSize: 12 }}>No leads</div>
                  )}
                  <Pagination
                    compact
                    page={col.page}
                    total={col.total}
                    limit={KANBAN_PAGE_SIZE}
                    onChange={(p) => setKanbanPage(stage.key, p)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Declined/Lapsed sidebar toggle */}
      <div style={{ marginTop: 20, background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <button onClick={() => setShowDeclined(!showDeclined)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: BRAND.silver }}>
          {showDeclined ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
          Declined & Lapsed ({declinedTotal || summary?.totals?.declined || declined.length})
        </button>
        {showDeclined && (
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 8 }}>
              {declined.map(lead => (
                <div key={lead.id} style={{ padding: '10px 12px', background: `${BRAND.silver}14`, borderRadius: 8, borderLeft: `3px solid ${lead.computed_stage === 'declined' ? '#e74c3c' : BRAND.silver}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.black }}>{lead.parent_name}</div>
                      <div style={{ fontSize: 11, color: BRAND.silver, marginTop: 2 }}>{lead.decline_reason || lead.computed_stage}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Btn variant="secondary" small onClick={() => openEdit(lead)}><Pencil size={12}/></Btn>
                      <Btn variant="danger" small onClick={() => openDelete(lead)}><Trash2 size={12}/></Btn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={declinedPage} total={declinedTotal} limit={DECLINED_PAGE_SIZE} onChange={setDeclinedPage} />
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
          <LeadFormFields form={newLead} setForm={setNewLead} campuses={campuses} campaigns={campaigns} campusHeads={campusHeads} user={user} create />
          {!online && (
            <p style={{ fontSize: 12, color: '#9a3412', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <WifiOff size={13}/> You are offline — this lead will stay on this phone until you reconnect.
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
            <Btn type="submit" disabled={savingLead}>{savingLead ? 'Saving…' : (online ? 'Save Lead' : 'Save on this device')}</Btn>
          </div>
        </form>
      </Modal>

      {/* Edit Lead Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Lead" width={620}>
        <form onSubmit={saveEdit}>
          <LeadFormFields form={editForm} setForm={setEditForm} campuses={campuses} campaigns={campaigns} campusHeads={campusHeads} user={user} showFollowUp />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Btn>
            <Btn type="submit">Save Changes</Btn>
          </div>
        </form>
      </Modal>

      {/* Delete / archive */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Archive lead?" width={440}>
        <p style={{ fontSize: 13, color: BRAND.silver, marginBottom: 16 }}>
          Archive <strong>{deleteTarget?.parent_name}</strong>? They will be removed from the active funnel but kept in the database for audit.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Btn>
          <Btn variant="danger" onClick={confirmDelete}>Archive Lead</Btn>
        </div>
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
      <LeadDrawer lead={selected} campuses={campuses} campusHeads={campusHeads} isGlobal={!user?.campusId} onClose={() => setSelected(null)} onUpdate={updateLead} onEdit={openEdit} onDelete={openDelete} onDecline={openDecline} onBookTour={bookTour} onBookInterview={bookInterview} onInterviewOutcome={interviewOutcome} onSendFormLink={sendFormLink} onMarkEnrolled={markEnrolled} onRecordPayment={recordPayment} onDiscardQueued={discardQueued} />
    </Layout>
  );
}

function DetailRows({ lead }) {
  const rows = [
    ['Institution', lead.campus_name],
    ['Head of school', lead.assigned_name],
    ['Entered by', lead.created_by_name || (lead.offlineId ? 'On this device' : 'Unknown / online form')],
    ['Phone', lead.parent_phone],
    ['Second phone', lead.parent_phone2],
    ['WhatsApp', lead.whatsapp_number],
    ['Email', lead.parent_email],
    ['Occupation', lead.occupation],
    ['Residence', lead.residence],
    ['Region', lead.region],
    ['Child', lead.child_name],
    ['Age', lead.child_age],
    ['Gender', lead.child_gender],
    ['Class', lead.interested_class],
    ['Boarding / day', lead.boarding_day],
    ['Children in family', lead.num_children],
    ['Intended term', lead.intended_term],
    ['Source', lead.source?.replace(/_/g, ' ')],
    ['How they heard', lead.how_heard],
    ['Referred by', lead.source_detail],
    ['Campaign', lead.campaign_name],
    ['Follow-up', lead.follow_up_date ? fmtDate(lead.follow_up_date) : null],
    ['Created', fmtDate(lead.created_at)],
    ['Updated', fmtDate(lead.updated_at)],
    ['Score', lead.lead_score],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.silver, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Lead record</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: 10, fontWeight: 700, color: BRAND.silver, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
            <div style={{ fontSize: 13, color: BRAND.black, marginTop: 2, wordBreak: 'break-word' }}>{String(value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadDrawer({ lead, campuses, campusHeads = [], isGlobal, onClose, onUpdate, onEdit, onDelete, onDecline, onBookTour, onBookInterview, onInterviewOutcome, onSendFormLink, onMarkEnrolled, onRecordPayment, onDiscardQueued }) {
  const [detail, setDetail] = useState(lead);
  const [notes, setNotes]   = useState('');
  const [followUp, setFollowUp] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
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
    setDetail(lead);
    if (lead) {
      setNotes(lead.notes || ''); setFollowUp(lead.follow_up_date?.slice(0,10) || '');
      setAssignedTo(lead.assigned_to || '');
      setTourOpen(false); setTourDate(''); setTourTime('');
      setInterviewOpen(false); setInterviewDate(''); setInterviewTime(''); setInterviewCampusId(lead.campus_id || '');
      setPaymentOpen(false); setPaymentAmount(''); setPaymentMethod('bank_transfer'); setPaymentRef('');
      if (!lead.offlineId) {
        api.get(`/marketing/leads/${lead.id}`).then((r) => {
          const next = { ...lead, ...r.data };
          setDetail(next);
          setNotes(next.notes || '');
          setFollowUp(next.follow_up_date?.slice(0, 10) || '');
          setAssignedTo(next.assigned_to || '');
        }).catch(() => {});
      }
    }
  }, [lead]);

  if (!lead) return null;
  const record = detail || lead;

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
      <div style={{ width: 460, background: 'white', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
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
        <div style={{ padding: '0 24px 12px', display: 'flex', gap: 8 }}>
          {lead.offlineId ? (
            <Btn variant="danger" small onClick={() => { onDiscardQueued?.(lead.offlineId); onClose(); }}>
              <Trash2 size={13}/> Remove from this device
            </Btn>
          ) : (
            <>
              <Btn variant="secondary" small onClick={() => onEdit(lead)}><Pencil size={13}/> Edit</Btn>
              <Btn variant="danger" small onClick={() => onDelete(lead)}><Trash2 size={13}/> Archive</Btn>
            </>
          )}
        </div>

        <div style={{ padding: '0 24px 24px', flex: 1 }}>
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
            {lead.sibling_flag && <div style={{ marginTop: 6, fontSize: 12, background: `${BRAND.gold}26`, color: BRAND.gold, padding: '4px 10px', borderRadius: 20, display: 'inline-block', fontWeight: 600 }}>Sibling / Returning Family</div>}
            {(lead.how_heard || lead.source_detail || lead.intended_term) && (
              <div style={{ marginTop: 8, fontSize: 12, color: BRAND.silver }}>
                {lead.how_heard && <div>Heard via {lead.how_heard}</div>}
                {lead.source_detail && <div>Referred by {lead.source_detail}</div>}
                {lead.intended_term && <div>Term: {lead.intended_term}</div>}
                {lead.last_contact_outcome && <div>Last contact: {lead.last_contact_channel} · {lead.last_contact_outcome.replace('_',' ')}</div>}
              </div>
            )}
          </div>

          <DetailRows lead={record} />

          {lead.offlineId && (
            <div style={{ marginBottom: 20, padding: 12, background: '#fff7ed', borderRadius: 8, fontSize: 13, color: '#9a3412' }}>
              Saved on this device only. Bookings and follow-ups unlock after it uploads.
              {lead.offlineError ? <div style={{ marginTop: 6, color: '#b91c1c' }}>{lead.offlineError}</div> : null}
            </div>
          )}

          {!lead.offlineId && (() => {
            const v = computeLeadVitality(record);
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

          {!lead.offlineId && <ContactLog lead={record} />}

          {!lead.offlineId && (
            <>
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
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.silver, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Follow-up Date</div>
            <input type="date" value={followUp} onChange={e => setFollowUp(e.target.value)}
              style={{ padding: '8px 10px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13, width: '100%' }}/>
          </div>
          {campusHeads.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.silver, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Assigned head</div>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                style={{ padding: '8px 10px', border: `1.5px solid ${BRAND.silver}40`, borderRadius: 7, fontSize: 13, width: '100%' }}>
                <option value="">Unassigned</option>
                {campusHeads
                  .filter((h) => !record.campus_id || String(h.campus_id) === String(record.campus_id))
                  .map((h) => (
                    <option key={h.id} value={h.id}>{h.name}{h.campus_name ? ` · ${h.campus_name}` : ''}</option>
                  ))}
              </select>
            </div>
          )}

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
            <Btn onClick={() => { onUpdate(record.id, { notes, follow_up_date: followUp || null, assigned_to: assignedTo || null }); onClose(); }}>Save Changes</Btn>
            <Btn variant="danger" small onClick={() => onDecline(lead.id)}>Mark Declined</Btn>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
