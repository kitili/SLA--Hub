'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import Layout from '@/components/shared/Layout';
import { Btn, PageHeader, Spinner, Empty } from '@/components/shared/UI';
import ReadinessBanner from '@/components/marketing/ReadinessBanner';
import toast from 'react-hot-toast';
import { BRAND } from '@/theme';
import { useCampusFilterStore, campusSearchParams } from '@/lib/campusFilter';

export default function AgentQueue() {
  const [ready, setReady] = useState(null);
  const [queue, setQueue] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const campusId = useCampusFilterStore((s) => s.campusId);

  const load = useCallback(async () => {
    try {
      const q = campusSearchParams(campusId);
      const [r, queue, a] = await Promise.all([
        api.get('/marketing/readiness'),
        api.get(`/marketing/agent/queue${q}`),
        api.get(`/marketing/agent/actions${campusSearchParams(campusId, { status: 'pending' })}`),
      ]);
      setReady(r.data);
      setQueue(queue.data.data || []);
      setPending(a.data || []);
    } catch {
      toast.error('Could not load the agent queue.');
    } finally {
      setLoading(false);
    }
  }, [campusId]);

  useEffect(() => { load(); }, [load]);

  async function propose(lead) {
    try {
      await api.post('/marketing/agent/propose', {
        lead_id: lead.id,
        action_type: lead.suggested_action,
      });
      toast.success('Draft queued for approval.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Propose failed.');
    }
  }

  async function decide(id, path) {
    try {
      const res = await api.post(`/marketing/agent/actions/${id}/${path}`);
      const status = res.data.action?.status;
      toast.success(status === 'skipped'
        ? (res.data.action.result || 'Approved — not sent (provider off).')
        : path === 'approve' ? 'Approved.' : 'Rejected.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Review failed.');
    }
  }

  if (loading) {
    return (
      <Layout module="marketing">
        <Spinner />
      </Layout>
    );
  }

  return (
    <Layout module="marketing">
      <PageHeader title="Agent queue" sub="Drafts only. Nothing is sent until you approve." />
      <ReadinessBanner readiness={ready} />

      <h3 style={{ fontSize: 15, fontWeight: 700, color: BRAND.black }}>Waiting for you</h3>
      {pending.length === 0 ? (
        <Empty text="No pending drafts." />
      ) : pending.map((row) => (
        <div key={row.id} style={{
          background: 'white', borderRadius: 12, padding: 16, marginBottom: 10,
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        }}>
          <div style={{ fontWeight: 700, color: BRAND.black }}>
            {row.parent_name} · {row.action_type.replace(/_/g, ' ')}
          </div>
          <div style={{ fontSize: 13, color: BRAND.silver, margin: '8px 0' }}>
            {row.payload?.draft || 'No draft'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => decide(row.id, 'approve')}>Approve</Btn>
            <Btn variant="ghost" onClick={() => decide(row.id, 'reject')}>Reject</Btn>
          </div>
        </div>
      ))}

      <h3 style={{ fontSize: 15, fontWeight: 700, color: BRAND.black, marginTop: 24 }}>Suggested next work</h3>
      {queue.length === 0 ? (
        <Empty text="No hot, cold, or likely-dead leads right now." />
      ) : queue.map((lead) => (
        <div key={lead.id} style={{
          background: 'white', borderRadius: 12, padding: 16, marginBottom: 10,
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700, color: BRAND.black }}>
                {lead.parent_name} · {lead.child_name || 'child'}
              </div>
              <div style={{ fontSize: 12, color: BRAND.silver, marginTop: 4 }}>
                {lead.vitality?.label} · {lead.suggested_action.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: 13, marginTop: 8, color: BRAND.black }}>{lead.draft}</div>
            </div>
            <Btn onClick={() => propose(lead)}>Propose</Btn>
          </div>
        </div>
      ))}
    </Layout>
  );
}
