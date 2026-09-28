'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import api from '@/lib/api';
import Layout from '@/components/shared/Layout';
import { PageHeader, Modal, Field, Input, Select, Btn, Table, Badge } from '@/components/shared/UI';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { BRAND } from '@/theme';
import { canManageMarketingTeam, isProtectedTeamAccount } from '@/lib/marketingTeam';

const EMPTY_FORM = {
  name: '',
  email: '',
  campus_id: '',
  password: '',
  must_change_password: true,
};

export default function Team() {
  const { user } = useAuthStore();
  const module = 'marketing';
  const [users, setUsers] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdTarget, setPwdTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pwdForm, setPwdForm] = useState({ password: '', must_change_password: true });
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const [usersRes, campusRes] = await Promise.all([
      api.get('/admin/users'),
      api.get('/admin/campuses'),
    ]);
    setUsers(usersRes.data || []);
    setCampuses(campusRes.data || []);
  }, []);

  useEffect(() => {
    if (!canManageMarketingTeam(user)) return;
    refresh().catch(() => toast.error('Failed to load team.'));
  }, [user, refresh]);

  async function addUser(e) {
    e.preventDefault();
    if (!form.campus_id) {
      toast.error('Choose a campus.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/admin/users', {
        name: form.name,
        email: form.email,
        role: 'campus_marketing_head',
        department: 'marketing',
        campus_id: form.campus_id,
        password: form.password,
        must_change_password: form.must_change_password,
      });
      toast.success(data.message || 'Team member added.');
      setAddOpen(false);
      setForm(EMPTY_FORM);
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add member.');
    } finally {
      setSaving(false);
    }
  }

  async function setPassword(e) {
    e.preventDefault();
    if (!pwdTarget) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/auth/reset-password/${pwdTarget.id}`, {
        password: pwdForm.password,
        must_change_password: pwdForm.must_change_password,
      });
      toast.success(data.message || 'Password updated.');
      setPwdOpen(false);
      setPwdTarget(null);
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to set password.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row) {
    const next = !row.is_active;
    if (next === false && !confirm(`Deactivate ${row.name}? They will not be able to sign in.`)) return;
    try {
      await api.patch(`/admin/users/${row.id}`, { is_active: next });
      toast.success(next ? `${row.name} reactivated.` : `${row.name} deactivated.`);
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update account.');
    }
  }

  if (!canManageMarketingTeam(user)) {
    return (
      <Layout module={module}>
        <div style={{ padding: 40, color: BRAND.silver, textAlign: 'center' }}>
          Only marketing@silverleaf.co.tz and the CEO can manage team members.
        </div>
      </Layout>
    );
  }

  const cols = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    {
      key: 'role',
      label: 'Status',
      render: (r) => (
        <Badge
          status={r.is_active ? 'active' : 'declined'}
          label={r.is_active ? 'Active' : 'Inactive'}
        />
      ),
    },
    { key: 'campus_name', label: 'Campus', render: (r) => r.campus_name || '—' },
    {
      key: 'last_login',
      label: 'Last login',
      render: (r) => (r.last_login ? new Date(r.last_login).toLocaleDateString('en-GB') : 'Never'),
    },
    {
      key: 'must_change_password',
      label: 'Own password',
      render: (r) => (r.must_change_password ? 'Change on next login' : 'Can change in Profile'),
    },
    {
      key: 'actions',
      label: '',
      render: (r) => {
        if (isProtectedTeamAccount(r)) {
          return <span style={{ fontSize: 11, color: BRAND.silver }}>Protected</span>;
        }
        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Btn
              variant="secondary"
              small
              onClick={() => {
                setPwdTarget(r);
                setPwdForm({ password: '', must_change_password: true });
                setPwdOpen(true);
              }}
            >
              Set password
            </Btn>
            {r.is_active ? (
              <Btn variant="danger" small onClick={() => toggleActive(r)}>Deactivate</Btn>
            ) : (
              <Btn variant="secondary" small onClick={() => toggleActive(r)}>Reactivate</Btn>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Layout module={module}>
      <PageHeader
        title="Team Management"
        sub={`${users.filter((r) => r.is_active).length} campus marketing member${users.filter((r) => r.is_active).length === 1 ? '' : 's'} · marketing@ and CEO can add, set passwords, and deactivate`}
        action={<Btn onClick={() => setAddOpen(true)}><UserPlus size={15} />Add member</Btn>}
      />
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <Table cols={cols} rows={users.filter((r) => r.is_active)} keyFn={(r) => r.id} />
      </div>
      <p style={{ fontSize: 12, color: BRAND.silver, marginTop: 12, lineHeight: 1.5 }}>
        New members sign in with the password you set. If “require password change” is on, they are asked to choose their own password before using the app. They can always update it later from Profile.
      </p>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add team member">
        <form onSubmit={addUser}>
          <Field label="Full name" required>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </Field>
          <Field label="Email" required hint="Must be @silverleaf.co.tz">
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          </Field>
          <Field label="Campus" required>
            <Select value={form.campus_id} onChange={(e) => setForm((f) => ({ ...f, campus_id: e.target.value }))} required>
              <option value="">Select campus</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Password" required hint="At least 8 characters. Share this with them privately.">
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              minLength={8}
              required
            />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '8px 0 16px' }}>
            <input
              type="checkbox"
              checked={form.must_change_password}
              onChange={(e) => setForm((f) => ({ ...f, must_change_password: e.target.checked }))}
            />
            Require them to change this password the first time they sign in
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create account'}</Btn>
          </div>
        </form>
      </Modal>

      <Modal open={pwdOpen} onClose={() => setPwdOpen(false)} title={pwdTarget ? `Set password for ${pwdTarget.name}` : 'Set password'}>
        <form onSubmit={setPassword}>
          <Field label="New password" required hint="At least 8 characters.">
            <Input
              type="password"
              value={pwdForm.password}
              onChange={(e) => setPwdForm((f) => ({ ...f, password: e.target.value }))}
              minLength={8}
              required
            />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '8px 0 16px' }}>
            <input
              type="checkbox"
              checked={pwdForm.must_change_password}
              onChange={(e) => setPwdForm((f) => ({ ...f, must_change_password: e.target.checked }))}
            />
            Require them to change it on next login
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setPwdOpen(false)}>Cancel</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save password'}</Btn>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
