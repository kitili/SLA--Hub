'use client';

import { useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useCampusFilterStore } from '@/lib/campusFilter';
import { useAuthStore } from '@/store/authStore';
import { syncOfflineLeads } from '@/lib/offlineLeads';

function registerOfflineWorker() {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV !== 'production') return;
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    const ping = () => navigator.serviceWorker.controller?.postMessage({ type: 'PRECACHE' });
    ping();
    navigator.serviceWorker.addEventListener('controllerchange', ping);
    reg.update?.();
  }).catch(() => {});
}

export default function Providers({ children }) {
  useEffect(() => {
    useCampusFilterStore.persist.rehydrate();
    useAuthStore.persist.rehydrate();
    registerOfflineWorker();
  }, []);

  useEffect(() => {
    async function sync() {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;
      const result = await syncOfflineLeads(userId);
      if (result.synced) {
        toast.success(`Uploaded ${result.synced} queued lead${result.synced === 1 ? '' : 's'}.`);
      }
    }
    sync();
    const unsub = useAuthStore.subscribe((state) => {
      if (state.user?.id && state.sessionReady) sync();
    });
    window.addEventListener('online', sync);
    window.addEventListener('focus', sync);
    const id = setInterval(sync, 30000);
    return () => {
      unsub();
      window.removeEventListener('online', sync);
      window.removeEventListener('focus', sync);
      clearInterval(id);
    };
  }, []);

  return (
    <>
      {children}
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </>
  );
}
