'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCampusFilterStore = create(
  persist(
    (set) => ({
      campusId: '',
      campuses: [],
      setCampusId: (campusId) => set({ campusId: campusId ? String(campusId) : '' }),
      setCampuses: (campuses) => set({ campuses: Array.isArray(campuses) ? campuses : [] }),
    }),
    {
      name: 'sla-campus-filter',
      skipHydration: true,
      partialize: (state) => ({ campusId: state.campusId }),
    }
  )
);

export function campusSearchParams(campusId, extra = {}) {
  const q = new URLSearchParams();
  Object.entries({ ...extra, ...(campusId ? { campus_id: campusId } : {}) }).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}
