'use client';

import { BRAND } from '@/theme';

function Card({ title, children }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: BRAND.black }}>{title}</h3>
      {children}
    </div>
  );
}

function pct(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${Math.round(Number(n) * 1000) / 10}%`;
}

export default function WorkbookOps({ ops }) {
  if (!ops) return null;
  const grades = ops.occupancy_by_grade?.grades || [];
  const drop = ops.dropouts || {};
  const weekly = ops.weekly_ops || {};
  const kpis = ops.top_sheet_kpis || {};
  const commissions = ops.commissions_live || [];
  const campusOcc = ops.campus_occupancy || {};
  const weeks = ['Jan', 'Feb', 'Mar', 'Apr'];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Mini label="Satisfaction" value={kpis.satisfaction?.actual ?? '—'} sub={`target ${kpis.satisfaction?.target ?? 9}`} />
        <Mini label="Partnerships / month" value={weekly.partnerships?.active ?? kpis.partnerships_per_month?.target ?? '—'} sub={`${weekly.partnerships?.leads || 0} partner leads`} />
        <Mini label="FB DMs (that week)" value={weekly.facebook?.dm_inquiries ?? '—'} sub="respond within 2 hrs" />
        <Mini label="Walk-ins (that week)" value={weekly.by_channel?.walk_ins ?? '—'} sub={`${weekly.leads_generated?.current || '—'} total leads`} />
      </div>

      {grades.length > 0 && (
        <Card title="Grade occupancy (Enrollment 26)">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: `${BRAND.silver}14`, textAlign: 'left' }}>
                  {['Grade', 'Actual', 'Capacity', 'Occupancy', 'Seats left'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', color: BRAND.silver }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grades.map(g => (
                  <tr key={g.grade} style={{ borderBottom: `1px solid ${BRAND.silver}22` }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{g.grade}</td>
                    <td style={{ padding: '8px 10px' }}>{g.actual}</td>
                    <td style={{ padding: '8px 10px' }}>{g.capacity}</td>
                    <td style={{ padding: '8px 10px', color: g.remaining < 0 ? '#dc2626' : BRAND.black }}>{pct(g.occupancy_pct)}</td>
                    <td style={{ padding: '8px 10px', color: g.remaining < 0 ? '#dc2626' : BRAND.black }}>{g.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: BRAND.silver, marginTop: 8 }}>
            Remaining seats = capacity − actual. Negative means the grade is over full — waitlist, do not mark those leads dead.
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Campus occupancy">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {Object.entries(campusOcc).filter(([k]) => k !== 'cluster_2025_style').map(([code, row]) => (
                <tr key={code} style={{ borderBottom: `1px solid ${BRAND.silver}22` }}>
                  <td style={{ padding: '8px 0', fontWeight: 700 }}>{code}</td>
                  <td style={{ padding: '8px 0' }}>{row.enrolled} / {row.capacity}</td>
                  <td style={{ padding: '8px 0' }}>{pct(row.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {campusOcc.USR?.boarding && (
            <div style={{ fontSize: 12, color: BRAND.silver, marginTop: 8 }}>
              Usa boarding {campusOcc.USR.boarding.students}/{campusOcc.USR.boarding.capacity} · transport {campusOcc.USR.transport.students}/{campusOcc.USR.transport.capacity}
            </div>
          )}
        </Card>

        <Card title="Dropouts YTD">
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
            {['USR', 'ACC', 'KJG', 'ILB', 'BOM'].map(k => drop[k] != null && (
              <div key={k}><div style={{ fontSize: 11, color: BRAND.silver }}>{k}</div><div style={{ fontWeight: 700 }}>{drop[k]}</div></div>
            ))}
            <div><div style={{ fontSize: 11, color: BRAND.silver }}>Total</div><div style={{ fontWeight: 700 }}>{drop.grand_total}</div></div>
          </div>
        </Card>
      </div>

      <Card title="Monthly leads → paid (Weekly Snapshot)">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: `${BRAND.silver}14` }}>
                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Campus</th>
                {weeks.map(m => <th key={m} style={{ padding: '8px 10px' }}>{m} leads</th>)}
                {weeks.map(m => <th key={`${m}p`} style={{ padding: '8px 10px' }}>{m} paid</th>)}
              </tr>
            </thead>
            <tbody>
              {['USR', 'ACC', 'KJG', 'ILB', 'BOM'].map(code => (
                <tr key={code} style={{ borderBottom: `1px solid ${BRAND.silver}22` }}>
                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>{code}</td>
                  {weeks.map(m => <td key={m} style={{ padding: '8px 10px', textAlign: 'center' }}>{ops.weekly_leads?.[code]?.[m] ?? '—'}</td>)}
                  {weeks.map(m => <td key={`${m}p`} style={{ padding: '8px 10px', textAlign: 'center' }}>{ops.weekly_enrollment?.[code]?.[m] ?? '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: BRAND.silver, marginTop: 8 }}>
          Monthly conversion = paid that month ÷ leads that month.
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Week of 11–15 May 2026">
          <div style={{ fontSize: 13, display: 'grid', gap: 6 }}>
            <div>Enrollments {weekly.enrollments?.current} (prev {weekly.enrollments?.previous}) · target {weekly.enrollments?.target}</div>
            <div>Interviews {weekly.interviews?.current} · Offers {weekly.offers?.current}</div>
            <div>Instagram {weekly.instagram?.followers} followers · reach {weekly.instagram?.reach?.toLocaleString?.() || weekly.instagram?.reach}</div>
            <div>TikTok {weekly.tiktok?.views} views · YouTube {weekly.youtube?.subscribers} subs</div>
            <div>Partnerships active {weekly.partnerships?.active} · leads {weekly.partnerships?.leads}</div>
          </div>
        </Card>

        <Card title={`Referral commissions (TZS ${(ops.commission_rules?.staff_referral_tzs || 25000).toLocaleString()} / paid)`}>
          {commissions.length === 0 ? (
            <div style={{ fontSize: 13, color: BRAND.silver }}>No referral leads paid yet. Tag source as referral and fill “who referred”.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: BRAND.silver }}>
                  <th style={{ padding: '6px 0' }}>Referrer</th>
                  <th>Leads</th>
                  <th>Paid</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map(r => (
                  <tr key={r.referrer} style={{ borderBottom: `1px solid ${BRAND.silver}22` }}>
                    <td style={{ padding: '6px 0' }}>{r.referrer}</td>
                    <td>{r.students}</td>
                    <td>{r.paid}</td>
                    <td>{Number(r.amount_tzs || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ fontSize: 11, color: BRAND.silver, marginTop: 8 }}>
            Staff / sales = count × 25,000. Sales then −5% tax. Feeder daycare uses the agreed rate on the sheet.
          </div>
        </Card>
      </div>
    </div>
  );
}

function Mini({ label, value, sub }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <div style={{ fontSize: 11, color: BRAND.silver, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: BRAND.black, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: BRAND.silver, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
