'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquarePlus, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useFeedbackUi } from '@/lib/feedbackUi';
import { BRAND } from '@/theme';
import { Btn, Field, Select, Textarea } from '@/components/shared/UI';

export const FEEDBACK_CATEGORIES = [
  { key: 'general', label: 'General' },
  { key: 'bug', label: 'Something broken' },
  { key: 'idea', label: 'Idea' },
  { key: 'question', label: 'Question' },
];

const STATUS_COLOR = {
  open: { bg: '#fef2f2', text: '#b91c1c' },
  in_progress: { bg: '#fff7ed', text: '#c2410c' },
  reviewed: { bg: '#fff7ed', text: '#c2410c' },
  done: { bg: '#f0fdf4', text: '#15803d' },
};

function statusLabel(status) {
  if (status === 'in_progress' || status === 'reviewed') return 'In progress';
  if (status === 'done') return 'Done';
  return 'Open';
}

export function StatusChip({ status }) {
  const tone = STATUS_COLOR[status] || STATUS_COLOR.open;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: tone.text, background: tone.bg, padding: '2px 7px', borderRadius: 999 }}>
      {statusLabel(status)}
    </span>
  );
}

export async function loadFeedback({ reviewer, scope, status, category, q } = {}) {
  const res = await api.get('/feedback', {
    params: {
      scope: reviewer && scope === 'all' ? 'all' : 'mine',
      ...(status && status !== 'all' ? { status } : {}),
      ...(category && category !== 'all' ? { category } : {}),
      ...(q ? { q } : {}),
    },
  });
  return {
    items: res.data?.data || [],
    canReview: !!res.data?.can_review,
    canReviewAll: !!res.data?.can_review_all,
  };
}

export function FeedbackList({ items, canReview, scope, onStatus, onReply }) {
  const [replyDraft, setReplyDraft] = useState({});
  if (!items.length) {
    return (
      <div style={{ fontSize: 13, color: BRAND.silver, padding: '24px 8px', textAlign: 'center' }}>
        No feedback yet.
      </div>
    );
  }
  return items.map((row) => (
    <div key={row.id} style={{ border: `1px solid ${BRAND.silver}26`, borderRadius: 10, padding: 12, marginBottom: 10, background: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.black }}>
          {row.user_name}
          {row.campus_name ? ` · ${row.campus_name}` : ''}
        </div>
        <StatusChip status={row.status} />
      </div>
      <div style={{ fontSize: 13, color: BRAND.black, whiteSpace: 'pre-wrap' }}>{row.message}</div>
      <div style={{ fontSize: 11, color: BRAND.silver, marginTop: 8 }}>
        {FEEDBACK_CATEGORIES.find((c) => c.key === row.category)?.label || row.category}
        {' · '}
        {row.created_at ? new Date(row.created_at).toLocaleString('en-GB') : ''}
        {row.page_path ? ` · ${row.page_path}` : ''}
        {row.status === 'done' && row.resolved_by_name ? ` · resolved by ${row.resolved_by_name}` : ''}
      </div>
      {row.admin_note && (
        <div style={{ fontSize: 12, color: BRAND.electricBlue, marginTop: 8 }}>Reply: {row.admin_note}</div>
      )}
      {canReview && scope === 'all' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <select
            aria-label="Update feedback status"
            value={row.status === 'reviewed' ? 'in_progress' : row.status}
            onChange={(e) => onStatus(row.id, e.target.value)}
            style={{ fontSize: 12, padding: '6px 8px', borderRadius: 7, border: `1px solid ${BRAND.silver}40` }}
          >
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
          {onReply && (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={replyDraft[row.id] ?? row.admin_note ?? ''}
                onChange={(e) => setReplyDraft((prev) => ({ ...prev, [row.id]: e.target.value }))}
                placeholder="Short reply to the sender"
                style={{ flex: 1, fontSize: 12, padding: '6px 8px', borderRadius: 7, border: `1px solid ${BRAND.silver}40` }}
              />
              <Btn small variant="secondary" onClick={() => onReply(row.id, replyDraft[row.id] ?? '')}>Save reply</Btn>
            </div>
          )}
        </div>
      )}
    </div>
  ));
}

export default function FeedbackWidget({ module }) {
  const pathname = usePathname();
  const { user, isGlobalHead } = useAuthStore();
  const reviewer = Boolean(user?.campusId) || isGlobalHead();
  const open = useFeedbackUi((s) => s.open);
  const onOpenChange = useFeedbackUi((s) => s.setOpen);
  const [tab, setTab] = useState('compose');
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState([]);
  const [canReview, setCanReview] = useState(false);
  const [canReviewAll, setCanReviewAll] = useState(false);
  const [scope, setScope] = useState('mine');
  const [status, setStatus] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) loadInbox();
  }, [open, scope, status]);

  async function loadInbox() {
    setLoading(true);
    setError('');
    try {
      const res = await loadFeedback({ reviewer, scope, status });
      setItems(res.items);
      setCanReview(res.canReview);
      setCanReviewAll(res.canReviewAll);
    } catch (err) {
      setItems([]);
      setError(err.response?.data?.error || 'Could not load feedback.');
    } finally {
      setLoading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/feedback', {
        message,
        category,
        module,
        page_path: pathname,
      });
      toast.success('Feedback sent. Thank you.');
      setMessage('');
      setCategory('general');
      setTab('inbox');
      await loadInbox();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send feedback.');
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(id, nextStatus) {
    try {
      const res = await api.patch(`/feedback/${id}`, { status: nextStatus });
      const item = res.data?.item;
      setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...item } : row)));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update status.');
    }
  }

  async function saveReply(id, admin_note) {
    try {
      const res = await api.patch(`/feedback/${id}`, { admin_note });
      const item = res.data?.item;
      setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...item } : row)));
      toast.success('Reply saved.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save reply.');
    }
  }

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Send feedback"
        onClick={() => onOpenChange(true)}
        style={{
          position: 'fixed',
          right: 22,
          bottom: 22,
          zIndex: 80,
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: 'none',
          background: BRAND.gold,
          color: BRAND.electricBlue,
          boxShadow: '0 8px 24px rgba(0,35,104,0.28)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {open && (
        <div
          onClick={() => onOpenChange(false)}
          style={{ position: 'fixed', inset: 0, background: `${BRAND.electricBlue}40`, zIndex: 110, display: 'flex', justifyContent: 'flex-end' }}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, 100vw)',
              height: '100%',
              background: BRAND.white,
              boxShadow: '-8px 0 32px rgba(0,0,0,0.18)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${BRAND.silver}26`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <MessageSquarePlus size={18} color={BRAND.electricBlue} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: BRAND.black }}>Feedback</div>
                <div style={{ fontSize: 12, color: BRAND.silver }}>Anyone on the system can send a note</div>
              </div>
              <button type="button" onClick={() => onOpenChange(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BRAND.silver, display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, padding: '12px 16px 0' }}>
              {[
                { key: 'compose', label: 'Send' },
                { key: 'inbox', label: reviewer && scope === 'all' ? 'All notes' : 'My notes' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    background: tab === item.key ? BRAND.electricBlue : `${BRAND.silver}18`,
                    color: tab === item.key ? BRAND.white : BRAND.black,
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab === 'compose' ? (
              <form onSubmit={submit} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <Field label="Type">
                  <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {FEEDBACK_CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Your note" hint="Heads and the CEO can read this. You will see it under My notes.">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={7}
                    placeholder="What should we know or fix?"
                    required
                  />
                </Field>
                <div style={{ fontSize: 11, color: BRAND.silver, marginBottom: 12 }}>
                  Sent from {module || 'app'} · {pathname}
                </div>
                <Btn type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send feedback'}</Btn>
              </form>
            ) : (
              <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
                {canReview && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <Btn small variant={scope === 'mine' ? 'primary' : 'secondary'} onClick={() => setScope('mine')}>Mine</Btn>
                    <Btn small variant={scope === 'all' ? 'primary' : 'secondary'} onClick={() => setScope('all')}>Everyone</Btn>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      style={{ fontSize: 12, padding: '6px 8px', borderRadius: 7, border: `1px solid ${BRAND.silver}40` }}
                    >
                      <option value="all">All statuses</option>
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                )}
                {error && <div style={{ fontSize: 13, color: '#b91c1c', marginBottom: 10 }}>{error}</div>}
                {loading ? (
                  <div style={{ fontSize: 13, color: BRAND.silver }}>Loading…</div>
                ) : (
                  <FeedbackList
                    items={items}
                    canReview={canReview}
                    scope={scope}
                    onStatus={updateStatus}
                    onReply={saveReply}
                  />
                )}
                {canReviewAll && (
                  <a href="/marketing/feedback" style={{ display: 'block', marginTop: 8, fontSize: 12, fontWeight: 700, color: BRAND.electricBlue, textDecoration: 'none' }}>
                    Open full feedback inbox
                  </a>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
