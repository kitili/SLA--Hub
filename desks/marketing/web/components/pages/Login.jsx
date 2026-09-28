'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { Eye, EyeOff, WifiOff } from 'lucide-react';
import { BRAND } from '@/theme';
import { isBrowserOffline } from '@/lib/network';
import { hasOfflineLogin, lastOfflineLoginEmail, OfflineLoginError } from '@/lib/offlineLogin';
import { homePathForUser } from '@/lib/authPaths';

const CEO_EMAIL = 'ceo@silverleaf.co.tz';

function BrandMark({ size, light }) {
  return (
    <div style={{
      height: size,
      width: size,
      borderRadius: Math.round(size * 0.22),
      background: light ? `${BRAND.gold}` : BRAND.electricBlue,
      color: light ? BRAND.electricBlue : BRAND.white,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 800,
      fontSize: Math.round(size * 0.36),
      letterSpacing: '-0.04em',
      flexShrink: 0,
    }}>
      SA
    </div>
  );
}

export default function Login({ variant = 'staff' }) {
  const isCeo = variant === 'ceo' || variant === 'admin';
  const [form, setForm] = useState({ email: isCeo ? CEO_EMAIL : '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [canUnlock, setCanUnlock] = useState(false);
  const [cachedName, setCachedName] = useState('');
  const { login, continueCachedSession } = useAuthStore();
  const router = useRouter();

  function goIn(user) {
    if (!user) return;
    if (user.mustChangePassword) {
      router.push('/change-password');
      return;
    }
    router.push(isCeo || user.role === 'ceo' ? '/marketing' : homePathForUser(user));
  }

  useEffect(() => {
    function refresh() {
      setOffline(isBrowserOffline());
      setCanUnlock(hasOfflineLogin(isCeo ? CEO_EMAIL : undefined));
    }
    refresh();
    if (!isCeo) {
      const last = lastOfflineLoginEmail();
      if (last) setForm((f) => (f.email ? f : { ...f, email: last }));
    }
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
    };
  }, [isCeo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await continueCachedSession();
      if (cancelled || !user) return;
      setCachedName(user.name || user.email || '');
      if (isCeo && user.role !== 'ceo') return;
      goIn(user);
    })();
    return () => { cancelled = true; };
  }, [continueCachedSession, isCeo]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email.includes('@silverleaf.co.tz')) {
      toast.error('Please use your @silverleaf.co.tz email address.');
      return;
    }
    setLoading(true);
    try {
      const data = await login(form.email, form.password, isCeo ? 'ceo' : 'staff');
      if (data.offline) {
        toast.success('Signed in on this device — you are offline.');
      }
      goIn(data.user);
    } catch (err) {
      if (err instanceof OfflineLoginError || err?.name === 'OfflineLoginError') toast.error(err.message);
      else toast.error(err.response?.data?.error || 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  const formFields = (
    <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
      <div style={fieldWrap}>
        <label style={labelStyle}>{isCeo ? 'CEO email' : 'Work email'}</label>
        <input
          type="email"
          placeholder={isCeo ? CEO_EMAIL : 'yourname@silverleaf.co.tz'}
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          style={inputStyle}
          required
        />
      </div>
      <div style={fieldWrap}>
        <label style={labelStyle}>Password</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPwd ? 'text' : 'password'}
            placeholder={isCeo ? 'CEO password' : 'Staff password'}
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            style={{ ...inputStyle, paddingRight: 44 }}
            required
          />
          <button type="button" onClick={() => setShowPwd(!showPwd)} style={eyeBtn}>
            {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      {(offline || canUnlock) && (
        <p style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          fontSize: 12, lineHeight: 1.45, margin: '0 0 14px',
          color: offline ? '#9a3412' : BRAND.silver,
        }}>
          {offline ? <WifiOff size={14} style={{ flexShrink: 0, marginTop: 1 }} /> : null}
          {offline
            ? (canUnlock || cachedName
              ? 'No signal. Use this same browser — Chrome or Safari, not a WhatsApp/Gmail preview — and the password you used here last time.'
              : 'No signal. Open this site once while online in Chrome or Safari, sign in, then this link will work without network.')
            : 'After you sign in here, this phone can open the same link later with no signal. Use Chrome or Safari, not a chat preview.'}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '13px',
          border: 'none',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          marginTop: 8,
          opacity: loading ? 0.75 : 1,
          background: isCeo ? BRAND.gold : BRAND.electricBlue,
          color: isCeo ? BRAND.black : BRAND.white,
        }}
      >
        {loading ? 'Signing in...' : (offline ? 'Sign in on this device' : (isCeo ? 'Sign in' : 'Sign in to staff portal'))}
      </button>
      {cachedName && (
        <button
          type="button"
          onClick={async () => {
            const user = await continueCachedSession();
            if (user) goIn(user);
          }}
          style={{
            width: '100%',
            marginTop: 10,
            padding: '11px',
            border: `1.5px solid ${BRAND.silver}55`,
            borderRadius: 8,
            background: 'white',
            fontSize: 14,
            fontWeight: 700,
            color: BRAND.electricBlue,
            cursor: 'pointer',
          }}
        >
          Continue as {cachedName}
        </button>
      )}
    </form>
  );

  if (isCeo) {
    return (
      <div style={ceo.page} suppressHydrationWarning>
        <div style={ceo.shell}>
          <aside style={ceo.aside}>
            <div style={{ marginBottom: 28 }}><BrandMark size={86} light /></div>
            <p style={ceo.kicker}>CEO portal</p>
            <h1 style={ceo.asideTitle}>Cluster overview</h1>
            <p style={ceo.asideCopy}>
              Enrolment, campus performance, and the marketing team. One sign-in for the CEO.
            </p>
          </aside>
          <main style={ceo.main}>
            <h2 style={ceo.formTitle}>CEO sign in</h2>
            <p style={ceo.formSub}>Use the CEO account. Campus and department staff sign in on the staff portal.</p>
            {formFields}
            <p style={ceo.hint}>
              ceo@silverleaf.co.tz (admin@silverleaf.co.tz also opens this portal).
            </p>
            <p style={ceo.switch}>
              <a href="/login" style={ceo.switchLink}>Staff portal</a>
            </p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div style={staff.page} suppressHydrationWarning>
      <div style={staff.card}>
        <div style={staff.badge}>Staff portal</div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><BrandMark size={72} /></div>
        <h1 style={staff.title}>Campus and department login</h1>
        <p style={staff.sub}>
          Marketing heads, campus teams, student experience, and dispensary.
        </p>
        {formFields}
        <p style={staff.hint}>
          New staff sign in with the temporary password from their administrator, then change it on first login.
        </p>
        <p style={staff.switch}>
          <a href="/admin" style={staff.switchLink}>CEO portal</a>
        </p>
      </div>
    </div>
  );
}

const fieldWrap = { marginBottom: 18 };
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: BRAND.electricBlue, marginBottom: 6 };
const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  border: `1.5px solid ${BRAND.silver}55`,
  borderRadius: 8,
  fontSize: 15,
  color: BRAND.electricBlue,
  outline: 'none',
  boxSizing: 'border-box',
  background: '#F4F4F5',
};
const eyeBtn = {
  position: 'absolute',
  right: 12,
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: BRAND.silver,
  padding: 0,
  display: 'flex',
};

const staff = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(160deg, ${BRAND.lightBlue} 0%, ${BRAND.white} 42%, #eef3f8 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    background: BRAND.white,
    borderRadius: 16,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 16px 40px rgba(0,35,104,0.12)',
    textAlign: 'center',
    borderTop: `6px solid ${BRAND.electricBlue}`,
  },
  badge: {
    display: 'inline-block',
    marginBottom: 16,
    padding: '4px 10px',
    borderRadius: 999,
    background: `${BRAND.electricBlue}14`,
    color: BRAND.electricBlue,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: { fontSize: 22, fontWeight: 700, color: BRAND.electricBlue, margin: '0 0 6px' },
  sub: { fontSize: 14, color: BRAND.silver, margin: '0 0 24px', lineHeight: 1.5 },
  hint: { fontSize: 12, color: BRAND.silver, marginTop: 22, lineHeight: 1.6 },
  switch: { marginTop: 14, fontSize: 13 },
  switchLink: { color: BRAND.electricBlue, fontWeight: 700, textDecoration: 'none' },
};

const ceo = {
  page: {
    minHeight: '100vh',
    background: BRAND.electricBlue,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  shell: {
    width: '100%',
    maxWidth: 880,
    minHeight: 520,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    background: BRAND.white,
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: '0 28px 70px rgba(0,0,0,0.28)',
  },
  aside: {
    background: `linear-gradient(165deg, ${BRAND.electricBlue} 0%, #00163d 100%)`,
    color: BRAND.white,
    padding: '48px 40px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    borderRight: `4px solid ${BRAND.gold}`,
  },
  kicker: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: BRAND.gold,
  },
  asideTitle: { margin: '8px 0 12px', fontSize: 32, fontWeight: 700, lineHeight: 1.15, color: BRAND.white },
  asideCopy: { margin: 0, fontSize: 15, lineHeight: 1.6, color: `${BRAND.lightBlue}` },
  main: { padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  formTitle: { margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: BRAND.electricBlue },
  formSub: { margin: '0 0 24px', fontSize: 13, color: BRAND.silver, lineHeight: 1.5 },
  hint: { fontSize: 12, color: BRAND.silver, marginTop: 22, lineHeight: 1.6 },
  switch: { marginTop: 14, fontSize: 13 },
  switchLink: { color: BRAND.electricBlue, fontWeight: 700, textDecoration: 'none' },
};
