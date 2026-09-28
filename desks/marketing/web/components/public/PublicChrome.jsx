'use client';

import Link from 'next/link';
import { BRAND } from '@/theme';

export function PublicChrome({ children, embed = false }) {
  if (embed) {
    return (
      <div style={{ minHeight: '100vh', background: BRAND.white, color: BRAND.black, padding: 16 }}>
        {children}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F4F5', color: BRAND.black }}>
      <header style={{ background: BRAND.electricBlue, color: BRAND.white, padding: '16px 24px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <Link href="/calendar" style={{ color: BRAND.white, fontWeight: 700 }}>Silverleaf Academy</Link>
          <nav style={{ display: 'flex', gap: 16, fontSize: 14 }}>
            <Link href="/calendar" style={{ color: BRAND.gold }}>Calendar</Link>
            <Link href="/apply" style={{ color: BRAND.white }}>Apply</Link>
          </nav>
        </div>
      </header>
      <main style={{ maxWidth: 880, margin: '0 auto', padding: '28px 20px 48px' }}>
        {children}
      </main>
    </div>
  );
}
