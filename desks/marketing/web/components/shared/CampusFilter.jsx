'use client';

import { useEffect } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useCampusFilterStore } from '@/lib/campusFilter';
import { BRAND } from '@/theme';

export default function CampusFilter() {
  const { user } = useAuthStore();
  const campusId = useCampusFilterStore((s) => s.campusId);
  const campuses = useCampusFilterStore((s) => s.campuses);
  const setCampusId = useCampusFilterStore((s) => s.setCampusId);
  const setCampuses = useCampusFilterStore((s) => s.setCampuses);
  const isGlobal = Boolean(user && !user.campusId);

  useEffect(() => {
    if (!isGlobal) return;
    api.get('/admin/campuses')
      .then((r) => setCampuses(r.data || []))
      .catch(() => {});
  }, [isGlobal, setCampuses]);

  if (!isGlobal) {
    return (
      <span style={{ fontSize: 13, color: BRAND.silver }}>
        {user?.campusName || 'Campus'} · {user?.name}
      </span>
    );
  }

  function chip(id, label) {
    const active = String(campusId || '') === String(id || '');
    return (
      <button
        key={id || 'all'}
        type="button"
        onClick={() => setCampusId(id)}
        style={{
          padding: '5px 10px',
          borderRadius: 16,
          border: active ? 'none' : `1px solid ${BRAND.silver}40`,
          background: active ? BRAND.electricBlue : 'white',
          color: active ? 'white' : BRAND.black,
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          lineHeight: 1.2,
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
      <span style={{ fontSize: 12, color: BRAND.silver, fontWeight: 600, marginRight: 2 }}>Campus</span>
      {chip('', 'All')}
      {campuses.map((c) => chip(String(c.id), c.code || c.name))}
      <span style={{ fontSize: 12, color: BRAND.silver, marginLeft: 4 }}>{user?.name}</span>
    </div>
  );
}
