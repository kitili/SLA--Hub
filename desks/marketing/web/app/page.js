'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function HomePage() {
  const router = useRouter();
  const { user, mustChangePassword, hasAnyRole, restoreSession, sessionReady } = useAuthStore();

  useEffect(() => {
    if (!sessionReady) restoreSession();
  }, [sessionReady, restoreSession]);

  useEffect(() => {
    if (!sessionReady) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (mustChangePassword || user.mustChangePassword) {
      router.replace('/change-password');
      return;
    }
    if (hasAnyRole('ceo', 'global_marketing_head', 'campus_marketing_head')) {
      router.replace('/marketing');
      return;
    }
    router.replace('/login');
  }, [sessionReady, user, mustChangePassword, hasAnyRole, router]);

  return null;
}
