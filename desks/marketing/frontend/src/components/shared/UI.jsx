// Shared UI primitives used across Marketing, SE, and Dispensary dashboards
// Structural colors (headings, buttons, borders, backgrounds) use the Silverleaf
// brand palette (see theme.js). Status colors (Badge, success/danger actions) are
// intentionally kept as conventional red/green/amber — see BADGE_COLORS below.

import { useEffect, useRef, useState } from 'react';
import api from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { BRAND } from '../../theme';

const BORDER      = `${BRAND.silver}40`;
const BORDER_SOFT = `${BRAND.silver}26`;
const BG_TINT     = `${BRAND.silver}0D`;
const HEADER_BG   = `${BRAND.silver}14`;

// ── KPI Card ────────────────────────────────────────────────
export function KpiCard({ icon: Icon, label, value, sub, color = BRAND.electricBlue, trend }) {
  return (
    <div style={{
      background: BRAND.white, borderRadius: 12, padding: '20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 9, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={19} color={color} />
        </div>
        <span style={{ fontSize: 13, color: BRAND.silver, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: BRAND.black }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: BRAND.silver, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Section Card ─────────────────────────────────────────────
export function Section({ title, children, action, noPad }) {
  return (
    <div style={{ background: BRAND.white, borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BORDER_SOFT}` }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: BRAND.black }}>{title}</h3>
        {action && <div>{action}</div>}
      </div>
      <div style={noPad ? {} : { padding: 20 }}>{children}</div>
    </div>
  );
}

// ── Page Header ───────────────────────────────────────────────
export function PageHeader({ title, sub, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: BRAND.black }}>{title}</h1>
        {sub && <p style={{ margin: '4px 0 0', fontSize: 13, color: BRAND.silver }}>{sub}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────────
// Status colors are kept as conventional red/green/amber by design — see the
// palette decision in theme.js. Do not replace these with brand colors.
const BADGE_COLORS = {
  critical:        { bg: '#fef2f2', text: '#dc2626' },
  high:            { bg: '#fff7ed', text: '#ea580c' },
  medium:          { bg: '#fefce8', text: '#ca8a04' },
  low:             { bg: '#f0fdf4', text: '#16a34a' },
  open:            { bg: '#eff6ff', text: '#1d4ed8' },
  resolved:        { bg: '#f0fdf4', text: '#16a34a' },
  pending:         { bg: '#fafafa', text: '#6b7280' },
  approved:        { bg: '#f0fdf4', text: '#16a34a' },
  rejected:        { bg: '#fef2f2', text: '#dc2626' },
  active:          { bg: '#eff6ff', text: '#1d4ed8' },
  completed:       { bg: '#f0fdf4', text: '#16a34a' },
  emergency:       { bg: '#fef2f2', text: '#dc2626' },
  interested_lead: { bg: '#eff6ff', text: '#1d4ed8' },
  dead_lead:       { bg: '#f3f4f6', text: '#4b5563' },
  tour_booked:     { bg: '#fff7ed', text: '#ea580c' },
  interview_booked:{ bg: '#ecfdf5', text: '#0f766e' },
  form_filled:     { bg: '#f5f3ff', text: '#7c3aed' },
  enrolled:        { bg: '#f0fdf4', text: '#16a34a' },
  admission_paid:  { bg: '#fefce8', text: '#c9a84c' },
  declined:        { bg: '#fef2f2', text: '#dc2626' },
  lapsed:          { bg: '#f9fafb', text: '#6b7280' },
};

export function Badge({ status, label }) {
  const c = BADGE_COLORS[status] || { bg: '#f1f5f9', text: '#475569' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: 20,
      background: c.bg, color: c.text, fontSize: 11, fontWeight: 600,
      textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>
      {label || status?.replace(/_/g, ' ')}
    </span>
  );
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 560 }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: `${BRAND.electricBlue}73`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: BRAND.white, borderRadius: 14, width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${BORDER_SOFT}` }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: BRAND.black }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: BRAND.silver, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

// ── Form Field ─────────────────────────────────────────────────
export function Field({ label, required, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: BRAND.black, marginBottom: 5 }}>
        {label}{required && <span style={{ color: BRAND.gold, marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: BRAND.silver, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

export function Input({ style, ...props }) {
  return (
    <input style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${BORDER}`, borderRadius: 7, fontSize: 14, color: BRAND.black, background: BG_TINT, ...style }} {...props} />
  );
}

export function Select({ children, style, ...props }) {
  return (
    <select style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${BORDER}`, borderRadius: 7, fontSize: 14, color: BRAND.black, background: BG_TINT, ...style }} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ style, ...props }) {
  return (
    <textarea style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${BORDER}`, borderRadius: 7, fontSize: 14, color: BRAND.black, background: BG_TINT, resize: 'vertical', minHeight: 80, ...style }} {...props} />
  );
}

// ── Student Picker (typeahead search by name) ───────────────────
export function StudentPicker({ basePath, onSelect, placeholder = 'Type a student name…' }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  function handleChange(e) {
    const v = e.target.value;
    setQuery(v);
    setSelected(null);
    onSelect(null);
    setOpen(true);
    clearTimeout(timerRef.current);
    if (v.trim().length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try { const r = await api.get(`${basePath}/students/search?q=${encodeURIComponent(v.trim())}`); setResults(r.data); }
      catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  }

  function pick(s) {
    setSelected(s);
    setQuery(`${s.first_name} ${s.last_name}`);
    setResults([]);
    setOpen(false);
    onSelect(s);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && results.length === 1) {
      e.preventDefault();
      pick(results[0]);
    }
  }

  function handleBlur() {
    setTimeout(() => {
      setOpen(false);
      // If the user typed a name and blurred without clicking a suggestion,
      // auto-confirm it when there's exactly one unambiguous match.
      if (!selected && results.length === 1) pick(results[0]);
    }, 150);
  }

  const unconfirmed = query.trim().length >= 2 && !selected && !loading;

  return (
    <div style={{ position: 'relative' }}>
      <Input
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoComplete="off"
        style={unconfirmed ? { border: '1.5px solid #e74c3c' } : undefined}
      />
      {selected && (
        <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>
          ✓ {selected.class_name || 'No class'}{selected.campus_name ? ` · ${selected.campus_name}` : ''}
        </div>
      )}
      {!open && unconfirmed && (
        <div style={{ fontSize: 11, color: '#e74c3c', marginTop: 4 }}>
          No student selected yet — pick one from the list.
        </div>
      )}
      {open && (loading || results.length > 0 || query.trim().length >= 2) && (
        <div style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, background: BRAND.white, border: `1px solid ${BORDER}`, borderRadius: 7, marginTop: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 220, overflowY: 'auto' }}>
          {loading && <div style={{ padding: 10, fontSize: 12, color: BRAND.silver }}>Searching…</div>}
          {!loading && results.map(s => (
            <div key={s.id} onMouseDown={() => pick(s)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: `1px solid ${BORDER_SOFT}` }}>
              <div style={{ fontWeight: 600, color: BRAND.black }}>{s.first_name} {s.last_name}</div>
              <div style={{ fontSize: 11, color: BRAND.silver }}>{s.class_name || 'No class'}{s.campus_name ? ` · ${s.campus_name}` : ''}</div>
            </div>
          ))}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <div style={{ padding: 10, fontSize: 12, color: BRAND.silver }}>No students found.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Campus Field (global-scope only — self-hides for campus users) ──
export function CampusField({ value, onChange, required = true }) {
  const { user } = useAuthStore();
  const [campuses, setCampuses] = useState([]);

  useEffect(() => {
    if (!user?.campusId) api.get('/admin/campuses').then(r => setCampuses(r.data)).catch(() => {});
  }, [user?.campusId]);

  if (user?.campusId) return null;

  return (
    <Field label="Campus" required={required}>
      <Select value={value} onChange={e => onChange(e.target.value)} required={required}>
        <option value="">Select campus</option>
        {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
    </Field>
  );
}

// ── Button ─────────────────────────────────────────────────────
// "danger"/"success" intentionally keep red/green — same status-safety convention as Badge.
export function Btn({ children, variant = 'primary', color, onClick, disabled, type = 'button', small, style: extraStyle }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: small ? '6px 12px' : '9px 18px',
    borderRadius: 7, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: small ? 12 : 14, fontWeight: 600, transition: 'opacity 0.15s',
    opacity: disabled ? 0.6 : 1, ...extraStyle,
  };
  const variants = {
    primary:  { background: color || BRAND.electricBlue, color: BRAND.white },
    secondary:{ background: HEADER_BG, color: BRAND.black },
    danger:   { background: '#fef2f2', color: '#dc2626' },
    success:  { background: '#f0fdf4', color: '#16a34a' },
    gold:     { background: BRAND.gold, color: BRAND.black },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>
      {children}
    </button>
  );
}

// ── Period Toggle ──────────────────────────────────────────────
export function PeriodToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: HEADER_BG, borderRadius: 8, padding: 3 }}>
      {['daily','weekly','monthly','yearly'].map(p => (
        <button key={p} onClick={() => onChange(p)} style={{
          padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
          background: value === p ? BRAND.white : 'transparent',
          color: value === p ? BRAND.black : BRAND.silver,
          boxShadow: value === p ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
        }}>
          {p.charAt(0).toUpperCase() + p.slice(1)}
        </button>
      ))}
    </div>
  );
}

// ── Export Menu (PDF / Word / Excel) ───────────────────────────
export function ExportMenu({ onExport, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <Btn variant="secondary" disabled={disabled} onClick={() => setOpen(o => !o)}>Export ▾</Btn>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '110%', background: BRAND.white,
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 20,
          minWidth: 130, overflow: 'hidden',
        }}>
          {[['pdf', 'PDF'], ['word', 'Word'], ['excel', 'Excel']].map(([fmt, label]) => (
            <button key={fmt} onClick={() => { setOpen(false); onExport(fmt); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: BRAND.black }}
              onMouseEnter={e => e.currentTarget.style.background = HEADER_BG}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────
export function Empty({ icon: Icon, title, sub, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: BRAND.silver }}>
      {Icon && <Icon size={40} style={{ marginBottom: 12, opacity: 0.4 }} />}
      <div style={{ fontSize: 15, fontWeight: 600, color: BRAND.silver, marginBottom: 4 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, marginBottom: 16 }}>{sub}</div>}
      {action}
    </div>
  );
}

// ── Loading Spinner ────────────────────────────────────────────
export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <div style={{
        width: 32, height: 32, border: `3px solid ${BORDER_SOFT}`,
        borderTop: `3px solid ${BRAND.electricBlue}`, borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Table ──────────────────────────────────────────────────────
export function Table({ cols, rows, keyFn }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: HEADER_BG }}>
            {cols.map(c => (
              <th key={c.key} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: BRAND.silver, whiteSpace: 'nowrap', borderBottom: `1px solid ${BORDER}` }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={keyFn ? keyFn(row) : i} style={{ borderBottom: `1px solid ${BORDER_SOFT}` }}>
              {cols.map(c => (
                <td key={c.key} style={{ padding: '10px 14px', color: BRAND.black, whiteSpace: c.nowrap ? 'nowrap' : 'normal' }}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={cols.length} style={{ padding: 32, textAlign: 'center', color: BRAND.silver }}>No records found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
