'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { User, Mail, Lock, Shield } from 'lucide-react';
import { Section, Field, Input, Btn } from './UI';
import { BRAND } from '@/theme';
import { loginPathForRole } from '@/lib/authPaths';

const DOMAIN = '@silverleaf.co.tz';

export default function ProfileBase({ module }) {
  const { user, logout } = useAuthStore();
  const [emailForm, setEmailForm] = useState({ new_email: '', password: '' });
  const [pwdForm,   setPwdForm]   = useState({ current_password: '', new_password: '', confirm: '' });
  const [loading, setLoading]     = useState({ email: false, pwd: false });

  async function changeEmail(e) {
    e.preventDefault();
    if (!emailForm.new_email.endsWith(DOMAIN)) { toast.error(`Email must end with ${DOMAIN}`); return; }
    setLoading(l => ({ ...l, email: true }));
    try {
      await api.patch('/auth/change-email', emailForm);
      toast.success('Email updated. Please log in again.');
      await logout();
      window.location.href = loginPathForRole(user?.role);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update email.');
    } finally {
      setLoading(l => ({ ...l, email: false }));
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwdForm.new_password !== pwdForm.confirm) { toast.error('Passwords do not match.'); return; }
    if (pwdForm.new_password.length < 8)          { toast.error('Minimum 8 characters.'); return; }
    setLoading(l => ({ ...l, pwd: true }));
    try {
      await api.patch('/auth/change-password', { current_password: pwdForm.current_password, new_password: pwdForm.new_password });
      toast.success('Password changed. Please log in again.');
      await logout();
      window.location.href = loginPathForRole(user?.role);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Incorrect current password.');
    } finally {
      setLoading(l => ({ ...l, pwd: false }));
    }
  }

  const roleLabel = {
    ceo:                      'CEO',
    global_marketing_head:    'Global Marketing Head',
    campus_marketing_head:    'Campus Marketing Head',
    global_student_exp_head:  'Global Student Experience Head',
    campus_student_exp_head:  'Campus Student Experience Head',
    nurse:                    'Nurse',
  }[user?.role] || user?.role;
  const pinnedMarketing = (user?.email || '').toLowerCase() === 'marketing@silverleaf.co.tz';

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: BRAND.black }}>Profile Settings</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: BRAND.silver }}>Manage your account credentials</p>
      </div>

      {/* Account info */}
      <Section title="Account Information">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, padding: '16px', background: '#f8fafc', borderRadius: 10 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: BRAND.electricBlue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: BRAND.black }}>{user?.name}</div>
            <div style={{ fontSize: 13, color: BRAND.silver }}>{user?.email}</div>
            <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}>{roleLabel}</span>
              {user?.campusName && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f0fdf4', color: '#16a34a', fontWeight: 600 }}>{user.campusName}</span>}
            </div>
          </div>
        </div>
      </Section>

      {/* Change email */}
      <div style={{ marginTop: 16 }}>
        <Section title={<><Mail size={16} style={{ display: 'inline', marginRight: 6 }}/>Change Email Address</>}>
          <form onSubmit={changeEmail}>
            <Field label="New Email Address" required hint={`Must end with ${DOMAIN}`}>
              <Input type="email" placeholder={`newname${DOMAIN}`} value={emailForm.new_email} onChange={e => setEmailForm(f => ({ ...f, new_email: e.target.value }))} required />
            </Field>
            <Field label="Confirm with Current Password" required>
              <Input type="password" placeholder="Enter your password to confirm" value={emailForm.password} onChange={e => setEmailForm(f => ({ ...f, password: e.target.value }))} required />
            </Field>
            <Btn type="submit" disabled={loading.email}>{loading.email ? 'Updating…' : 'Update Email'}</Btn>
          </form>
        </Section>
      </div>

      <div style={{ marginTop: 16 }}>
        <Section title={<><Lock size={16} style={{ display: 'inline', marginRight: 6 }}/>Change Password</>}>
          {pinnedMarketing ? (
            <p style={{ margin: 0, fontSize: 13, color: BRAND.silver }}>
              The marketing@silverleaf.co.tz password is pinned and cannot be changed.
            </p>
          ) : (
            <form onSubmit={changePassword}>
              <Field label="Current Password" required>
                <Input type="password" value={pwdForm.current_password} onChange={e => setPwdForm(f => ({ ...f, current_password: e.target.value }))} required />
              </Field>
              <Field label="New Password" required hint="Minimum 8 characters">
                <Input type="password" value={pwdForm.new_password} onChange={e => setPwdForm(f => ({ ...f, new_password: e.target.value }))} required />
              </Field>
              <Field label="Confirm New Password" required>
                <Input type="password" value={pwdForm.confirm} onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} required />
              </Field>
              <Btn type="submit" disabled={loading.pwd}>{loading.pwd ? 'Saving…' : 'Change Password'}</Btn>
            </form>
          )}
        </Section>
      </div>

      <div style={{ marginTop: 16, padding: '14px 16px', background: '#f0fdf4', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Shield size={16} color="#16a34a" style={{ marginTop: 1, flexShrink: 0 }}/>
        <p style={{ margin: 0, fontSize: 12, color: '#15803d' }}>After changing your email or password, you will be automatically signed out and must sign in again with the new credentials.</p>
      </div>
    </div>
  );
}
