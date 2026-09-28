'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Layout from '@/components/shared/Layout';
import { PageHeader, Btn, Spinner, Empty, Table, Pagination } from '@/components/shared/UI';
import toast from 'react-hot-toast';
import { BRAND } from '@/theme';

export default function Families() {
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [ready, setReady] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [studentTotal, setStudentTotal] = useState(0);
  const PAGE_SIZE = 25;

  async function load(nextPage = page) {
    try {
      const [p, s, r] = await Promise.all([
        api.get(`/marketing/sis/parents?page=${nextPage}&limit=${PAGE_SIZE}`),
        api.get('/marketing/sis/students?limit=1&page=1'),
        api.get('/marketing/readiness'),
      ]);
      setParents(p.data?.data || []);
      setTotal(p.data?.total || 0);
      setStudentTotal(s.data?.total || 0);
      setStudents(s.data?.data || []);
      setReady(r.data);
    } catch {
      toast.error('Could not load Ed Admin families.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(page); }, [page]);

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await api.post('/marketing/sis/sync');
      toast.success(`Synced ${res.data.parents || 0} parents · ${res.data.students || 0} students`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync needs a real Ed Admin API key in backend/.env');
    } finally {
      setSyncing(false);
    }
  }

  async function openParent(row) {
    try {
      const res = await api.get(`/marketing/sis/parents/${row.edadmin_id}`);
      setSelected(res.data);
    } catch {
      toast.error('Could not load that parent.');
    }
  }

  if (loading) return <Layout module="marketing"><Spinner /></Layout>;

  const configured = ready?.connections?.edadmin;
  const endpoints = ready?.endpoints || {};

  return (
    <Layout module="marketing">
      <PageHeader
        title="Families"
        sub="Ed Admin parents linked to students by parent_id"
        action={<Btn onClick={syncNow} disabled={syncing}>{syncing ? 'Syncing…' : 'Sync from Ed Admin'}</Btn>}
      />

      {!configured && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fff8e8', border: `1px solid ${BRAND.gold}`, borderRadius: 12, fontSize: 13 }}>
          Paste the Ed Admin General API key into <code>backend/.env</code> as <code>EDADMIN_API_KEY</code>, then sync.
          {endpoints.parents && (
            <div style={{ marginTop: 8, color: BRAND.silver }}>
              GET {endpoints.parents}<br />
              GET {endpoints.students}
            </div>
          )}
        </div>
      )}

      {parents.length === 0 ? (
        <Empty title="No parents stored yet" sub="Sync after the Ed Admin API key is set." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1.2fr 1fr' : '1fr', gap: 16 }}>
          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <Table
              cols={[
                { key: 'full_name', label: 'Parent', render: r => r.full_name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.edadmin_id },
                { key: 'phone', label: 'Phone', render: r => r.phone || '—' },
                { key: 'student_count', label: 'Students' },
                { key: 'campus_name', label: 'Campus', render: r => r.campus_name || '—' },
                { key: 'actions', label: '', render: r => <Btn small variant="secondary" onClick={() => openParent(r)}>Students</Btn> },
              ]}
              rows={parents}
              keyFn={r => r.edadmin_id}
            />
            <Pagination page={page} total={total} limit={PAGE_SIZE} onChange={setPage} />
          </div>
          {selected && (
            <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                {selected.parent?.full_name || selected.parent?.edadmin_id}
              </div>
              <div style={{ fontSize: 12, color: BRAND.silver, marginBottom: 12 }}>
                parent_id {selected.parent?.edadmin_id} · {selected.parent?.phone || 'no phone'}
              </div>
              {(selected.students || []).length === 0 ? (
                <div style={{ fontSize: 13, color: BRAND.silver }}>No students linked to this parent.</div>
              ) : selected.students.map(kid => (
                <div key={kid.edadmin_id} style={{ padding: '8px 0', borderBottom: `1px solid ${BRAND.silver}22`, fontSize: 13 }}>
                  <strong>{[kid.first_name, kid.last_name].filter(Boolean).join(' ') || kid.edadmin_id}</strong>
                  <div style={{ color: BRAND.silver, fontSize: 12 }}>{kid.class_name || 'class ?'} · {kid.campus_name || 'campus ?'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {studentTotal > 0 && !selected && (
        <p style={{ marginTop: 12, fontSize: 12, color: BRAND.silver }}>{studentTotal} students in the local directory. Open a parent to see their children.</p>
      )}
    </Layout>
  );
}
