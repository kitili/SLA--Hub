'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

const MKT = ['ceo', 'global_marketing_head', 'campus_marketing_head'];

export default function AuthGuard({ roles = MKT, loginHref = '/login', children }) {
  const router = useRouter();
  const { user, mustChangePassword, hasAnyRole, restoreSession, sessionReady } = useAuthStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sessionReady) await restoreSession();
      if (!cancelled) setChecked(true);
    })();
    return () => { cancelled = true; };
  }, [sessionReady, restoreSession]);

  useEffect(() => {
    if (!checked || !sessionReady) return;
    if (!user) {
      router.replace(loginHref);
      return;
    }
    if (mustChangePassword || user.mustChangePassword) {
      router.replace('/change-password');
      return;
    }
    if (roles && !hasAnyRole(...roles)) {
      router.replace('/');
    }
  }, [checked, sessionReady, user, mustChangePassword, hasAnyRole, roles, loginHref, router]);

  if (!checked || !sessionReady || !user) return null;
  if (mustChangePassword || user.mustChangePassword) return null;
  if (roles && !hasAnyRole(...roles)) return null;
  return children;
}
