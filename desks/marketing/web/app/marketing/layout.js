'use client';

import AuthGuard from '@/components/AuthGuard';

export default function MarketingLayout({ children }) {
  return <AuthGuard>{children}</AuthGuard>;
}
