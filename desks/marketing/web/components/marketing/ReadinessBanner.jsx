'use client';

import { BRAND } from '@/theme';

export default function ReadinessBanner({ readiness }) {
  if (!readiness) return null;
  const blockers = readiness.blockers || [];
  const goLive = readiness.go_live;
  const local = readiness.environment !== 'production';
  const conns = readiness.connections || {};
  const dailyReady = readiness.live || local;
  return (
    <div style={{
      background: dailyReady ? '#ecfdf3' : '#fff8e8',
      border: `1px solid ${dailyReady ? '#16a34a40' : BRAND.gold}`,
      borderRadius: 12,
      padding: '12px 16px',
      marginBottom: 16,
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: BRAND.black, marginBottom: 6 }}>
        {goLive
          ? 'Go-live checklist complete'
          : local
            ? 'Marketing is running locally — optional integrations can wait'
            : 'Not live yet — human cutover still open'}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: BRAND.silver }}>
        {Object.entries(conns).map(([k, ok]) => (
          <span key={k} style={{ color: ok ? '#15803d' : '#b45309' }}>
            {ok ? 'on' : 'off'} {k.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
      {!goLive && !local && blockers.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 12, color: BRAND.black }}>
          Waiting on: {blockers.join(', ')}
        </div>
      )}
    </div>
  );
}
