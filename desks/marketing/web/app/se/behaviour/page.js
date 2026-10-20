'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Layout from '@/components/shared/Layout';

export default function BehaviourFromOpsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/se/from-ops')
      .then((response) => setReports(Array.isArray(response.data) ? response.data : []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout module="se">
      <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Behaviour from the matron</h1>
      <p style={{ color: '#6b7280', marginTop: 0 }}>
        Reports filed on the bus in Ops.
      </p>
      {loading ? <p>Loading…</p> : null}
      {!loading && reports.length === 0 ? (
        <p>No matron behaviour reports have arrived yet.</p>
      ) : null}
      {reports.map((item) => (
        <article
          key={item.id}
          style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}
        >
          <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{item.summary}</p>
          {item.payload?.notes ? <p style={{ margin: 0 }}>{item.payload.notes}</p> : null}
        </article>
      ))}
    </Layout>
  );
}
