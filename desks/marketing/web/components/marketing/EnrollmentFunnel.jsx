'use client';

import { BRAND } from '@/theme';
import { buildLiveFunnelSteps, buildSheetFunnelSteps, funnelWidthPct } from '@/lib/marketingFunnel';

function FunnelStage({ step, max, compareValue, showCompare }) {
  const width = funnelWidthPct(step.value, max);
  const rate = max ? ((step.value / max) * 100).toFixed(1) : '0.0';

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{
        width: `${width}%`,
        margin: '0 auto',
        minWidth: 180,
        background: `linear-gradient(135deg, ${step.color} 0%, ${step.color}dd 100%)`,
        color: 'white',
        borderRadius: 8,
        padding: '10px 14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        clipPath: 'polygon(2% 0, 98% 0, 100% 100%, 0% 100%)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.2 }}>{step.label}</span>
          <span style={{ fontSize: 18, fontWeight: 800 }}>{step.value.toLocaleString()}</span>
        </div>
        <div style={{ fontSize: 10, opacity: 0.9, marginTop: 2 }}>{rate}% of total leads</div>
      </div>
      {showCompare && compareValue != null && (
        <div style={{ textAlign: 'center', fontSize: 10, color: BRAND.silver, marginTop: 2 }}>
          Sheet: <strong>{compareValue.toLocaleString()}</strong>
        </div>
      )}
    </div>
  );
}

export default function EnrollmentFunnel({ live, sheetCluster, showCompare = false, compact = false }) {
  const liveSteps = buildLiveFunnelSteps(live);
  const sheetSteps = buildSheetFunnelSteps(sheetCluster);
  const max = liveSteps[0]?.value || 1;
  const dead = parseInt(live?.dead_leads || 0, 10);
  const sheetDead = parseInt(sheetCluster?.dead_leads || 0, 10);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 120px', gap: 16, alignItems: 'start' }}>
      <div>
        {!compact && (
          <div style={{ fontSize: 11, color: BRAND.silver, marginBottom: 10 }}>
            Each bar is leads who reached this stage or later. Dead leads sit to the right.
          </div>
        )}
        {liveSteps.map((step, i) => (
          <FunnelStage
            key={step.key}
            step={step}
            max={max}
            compareValue={showCompare ? sheetSteps[i]?.value : null}
            showCompare={showCompare}
          />
        ))}
      </div>
      {!compact && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 10,
          padding: '14px 12px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Dead Leads
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#dc2626' }}>{dead.toLocaleString()}</div>
          {showCompare && (
            <div style={{ fontSize: 10, color: BRAND.silver, marginTop: 6 }}>Sheet: {sheetDead.toLocaleString()}</div>
          )}
          <div style={{ fontSize: 10, color: '#991b1b', marginTop: 8, lineHeight: 1.4 }}>
            Lost before conversion — track reasons in Leads Funnel
          </div>
        </div>
      )}
    </div>
  );
}
