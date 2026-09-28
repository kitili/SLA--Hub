'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import Layout from '@/components/shared/Layout';
import { Btn, PageHeader, Spinner } from '@/components/shared/UI';
import { FeedbackList, FEEDBACK_CATEGORIES, loadFeedback } from '@/components/shared/FeedbackWidget';
import { useAuthStore } from '@/store/authStore';
import { BRAND } from '@/theme';

export default function FeedbackInboxPage() {
  const { isGlobalHead } = useAuthStore();
  const reviewer = true;
  const [items, setItems] = useState([]);
  const [canReview, setCanReview] = useState(false);
  const [canReviewAll, setCanReviewAll] = useState(false);
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await loadFeedback({ reviewer, scope: 'all', status, category, q });
      setItems(res.items);
      setCanReview(res.canReview);
      setCanReviewAll(res.canReviewAll);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load feedback.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [status, category]);

  async function updateStatus(id, nextStatus) {
    try {
      const res = await api.patch(`/feedback/${id}`, { status: nextStatus });
      setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...res.data.item } : row)));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update status.');
    }
  }

  async function saveReply(id, admin_note) {
    try {
      const res = await api.patch(`/feedback/${id}`, { admin_note });
      setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...res.data.item } : row)));
      toast.success('Reply saved.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save reply.');
    }
  }

  async function markOpenDone() {
    setClosing(true);
    try {
      const res = await api.patch('/feedback', { status: 'done', scope: 'open' });
      const closed = res.data?.data || [];
      const byId = new Map(closed.map((row) => [row.id, row]));
      setItems((prev) => prev.map((row) => byId.get(row.id) || row));
      toast.success(`Marked ${closed.length} note${closed.length === 1 ? '' : 's'} done.`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not close open notes.');
    } finally {
      setClosing(false);
    }
  }

  const openCount = items.filter((row) => row.status !== 'done').length;

  return (
    <Layout module="marketing">
      <PageHeader
        title="Pilot feedback"
        sub="Everything sent with the + button. Filter, reply, and mark shipped notes done."
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={filterStyle}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={filterStyle}>
          <option value="all">All types</option>
          {FEEDBACK_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <form
          onSubmit={(e) => { e.preventDefault(); load(); }}
          style={{ display: 'flex', gap: 8, flex: 1, minWidth: 180 }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, campus, or note"
            style={{ ...filterStyle, flex: 1 }}
          />
          <Btn small type="submit">Search</Btn>
        </form>
        {canReviewAll && openCount > 0 && (
          <Btn small onClick={markOpenDone} disabled={closing}>
            {closing ? 'Marking…' : `Mark ${openCount} shipped as done`}
          </Btn>
        )}
      </div>
      {loading ? <Spinner /> : (
        <div style={{ maxWidth: 720 }}>
          <FeedbackList
            items={items}
            canReview={canReview}
            scope="all"
            onStatus={updateStatus}
            onReply={saveReply}
          />
        </div>
      )}
      {!isGlobalHead() && !canReview && (
        <p style={{ color: BRAND.silver, fontSize: 13 }}>Your own notes also appear from the + button → My notes.</p>
      )}
    </Layout>
  );
}

const filterStyle = {
  fontSize: 13,
  padding: '8px 10px',
  borderRadius: 8,
  border: `1px solid ${BRAND.silver}40`,
  background: 'white',
};
