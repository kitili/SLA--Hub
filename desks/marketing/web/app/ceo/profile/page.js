'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CeoProfileRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/marketing/profile');
  }, [router]);
  return null;
}
