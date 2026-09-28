'use client';

import { useState } from 'react';
import { Share2, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { BRAND } from '@/theme';

export default function BufferSocialKpi({ bufferKpi, socialTargets = [], socialOutput = [], onSynced }) {
  const [syncing, setSyncing] = useState(false);
  const platforms = bufferKpi?.platforms || [];
  const connected = bufferKpi?.connected;
  const configured = bufferKpi?.configured;
  const targetByPlatform = Object.fromEntries(
    socialTargets.map(t => [t.platform, t.target_followers])
  );
  const outputByPlatform = Object.fromEntries(
    socialOutput.map(o => [o.platform, o])
  );

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await api.post('/marketing/social/buffer/sync');
      const n = res.data.upserted || 0;
      const names = (res.data.platforms || []).join(', ') || 'channels';
      toast.success(`Buffer synced ${n} platform${n === 1 ? '' : 's'}${names ? ` (${names})` : ''}`);
      await onSynced?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Add BUFFER_API_KEY in backend/.env, then Sync');
    } finally {
      setSyncing(false);
    }
  }

  const syncBtn = (
    <button
      type="button"
      onClick={syncNow}
      disabled={syncing}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 8, border: `1px solid ${BRAND.electricBlue}`,
        background: 'white', color: BRAND.electricBlue, fontSize: 12, fontWeight: 700,
        cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.6 : 1,
      }}
    >
      <RefreshCw size={12} />
      {syncing ? 'Syncing…' : 'Sync from Buffer'}
    </button>
  );

  if (platforms.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 32, color: BRAND.silver }}>
        <Share2 size={32} style={{ marginBottom: 8, opacity: 0.4 }}/>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Buffer social KPI</div>
        <div style={{ fontSize: 13, maxWidth: 320, margin: '0 auto 12px' }}>
          {configured
            ? 'API key is set. Sync to pull Silverleaf channels from Buffer.'
            : 'Paste BUFFER_API_KEY from Buffer → Account → API settings, then Sync.'}
        </div>
        {syncBtn}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 11, color: configured ? '#ca8a04' : '#dc2626' }}>
          {configured ? <Wifi size={12}/> : <WifiOff size={12}/>}
          {configured ? 'Waiting for first Buffer pull' : 'Buffer API key not set'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
          background: connected ? '#f0fdf4' : '#fefce8',
          color: connected ? '#16a34a' : '#ca8a04',
        }}>
          {connected ? <Wifi size={12}/> : <WifiOff size={12}/>}
          {configured
            ? 'Buffer API connected'
            : connected
              ? 'Buffer snapshots on file'
              : 'Manual entry only — add BUFFER_API_KEY for live KPIs'}
        </div>
        {syncBtn}
      </div>
      {platforms.map(p => {
        const target = targetByPlatform[p.platform];
        const output = outputByPlatform[p.platform];
        const pct = target ? Math.round((p.followers / target) * 100) : null;
        return (
          <div key={p.platform} style={{
            padding: '12px 14px', background: `${BRAND.silver}0D`, borderRadius: 10,
            border: `1px solid ${BRAND.silver}22`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.black, textTransform: 'capitalize' }}>{p.platform}</span>
              {p.from_buffer && (
                <span style={{ fontSize: 10, fontWeight: 700, color: BRAND.electricBlue, background: `${BRAND.electricBlue}12`, padding: '2px 8px', borderRadius: 10 }}>
                  Buffer
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 12 }}>
              <div>
                <div style={{ color: BRAND.silver, fontSize: 10 }}>Followers</div>
                <strong>{parseInt(p.followers || 0).toLocaleString()}</strong>
                {target != null && (
                  <div style={{ fontSize: 10, color: pct >= 100 ? '#16a34a' : BRAND.silver }}>
                    Target {target.toLocaleString()} ({pct}%)
                  </div>
                )}
              </div>
              <div>
                <div style={{ color: BRAND.silver, fontSize: 10 }}>Posts (MTD)</div>
                <strong>{parseInt(p.posts_count || output?.posts_count || 0).toLocaleString()}</strong>
                {output?.stories_count != null && (
                  <div style={{ fontSize: 10, color: BRAND.silver }}>{output.stories_count} stories</div>
                )}
              </div>
              <div>
                <div style={{ color: BRAND.silver, fontSize: 10 }}>Engagement</div>
                <strong style={{ color: BRAND.gold }}>{p.engagement || 0}%</strong>
                {output?.ads_count != null && (
                  <div style={{ fontSize: 10, color: BRAND.silver }}>{output.ads_count} ads</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
