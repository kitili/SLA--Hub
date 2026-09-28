'use client';

import AuthGuard from '@/components/AuthGuard';

export default function CeoLayout({ children }) {
  return <AuthGuard roles={['ceo', 'global_marketing_head']} loginHref="/admin">{children}</AuthGuard>;
}
