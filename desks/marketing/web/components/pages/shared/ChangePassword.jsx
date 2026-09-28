'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { BRAND } from '@/theme';
import { loginPathForRole } from '@/lib/authPaths';
import { rememberOfflineLogin } from '@/lib/offlineLogin';

export default function ChangePassword() {
  const { user, logout, mustChangePassword } = useAuthStore();
  const router = useRouter();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [show, setShow] = useState({ current: false, new: false });
  const [loading, setLoading] = useState(false);
  const forced = mustChangePassword || user?.mustChangePassword;

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.new_password !== form.confirm) { toast.error('New passwords do not match.'); return; }
    if (form.new_password.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await api.patch('/auth/change-password', { current_password: form.current_password, new_password: form.new_password });
      if (user?.email) {
        try {
          await rememberOfflineLogin({
            email: user.email,
            password: form.new_password,
            portal: user.role === 'ceo' ? 'ceo' : 'staff',
            user,
            token: useAuthStore.getState().token,
          });
        } catch {
          /* offline vault is optional */
        }
      }
      toast.success('Password changed. Please log in again.');
      await logout();
      router.push(loginPathForRole(user?.role));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  }

  const C = { navy: BRAND.electricBlue, border: `${BRAND.silver}40`, bg: `${BRAND.silver}14`, text: BRAND.black, muted: BRAND.silver };

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(135deg, ${C.navy} 0%, ${BRAND.electricBlue} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(15,45,94,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Lock size={24} color={BRAND.gold} />
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text }}>Set Your Password</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted }}>
            {forced ? 'You must change your default password before continuing.' : 'Update your account password.'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {[
            { key: 'current_password', label: 'Current Password', showKey: 'current' },
            { key: 'new_password',     label: 'New Password',     showKey: 'new' },
            { key: 'confirm',          label: 'Confirm New Password', showKey: 'confirm' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 5 }}>{f.label}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={show[f.showKey] ? 'text' : 'password'}
                  value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px 42px 10px 12px', border: `1.5px solid ${C.border}`, borderRadius: 7, fontSize: 14, background: C.bg, boxSizing: 'border-box' }}
                />
                <button type="button" onClick={() => setShow(s => ({ ...s, [f.showKey]: !s[f.showKey] }))}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex' }}>
                  {show[f.showKey] ? <EyeOff size={17}/> : <Eye size={17}/>}
                </button>
              </div>
            </div>
          ))}

          <button type="submit" disabled={loading} style={{ width: '100%', padding: 12, background: C.navy, color: 'white', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Saving…' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
