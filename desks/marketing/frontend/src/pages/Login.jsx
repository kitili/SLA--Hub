import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import LOGO from '../assets/logo.jpg';
import { BRAND } from '../theme';

export default function Login() {
  const [form, setForm]     = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login }           = useAuthStore();
  const navigate            = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email.includes('@silverleaf.co.tz')) {
      toast.error('Please use your @silverleaf.co.tz email address.');
      return;
    }
    setLoading(true);
    try {
      const data = await login(form.email, form.password);
      if (data.mustChangePassword) {
        navigate('/change-password');
        return;
      }
      const { role } = data.user;
      if (['global_marketing_head', 'campus_marketing_head'].includes(role)) navigate('/marketing');
      else if (['global_student_exp_head', 'campus_student_exp_head'].includes(role)) navigate('/se');
      else if (role === 'nurse') navigate('/dispensary');
      else navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          <img
            src={LOGO}
            alt="Silverleaf Academy"
            style={{ height: 90, width: 90, objectFit: 'cover', borderRadius: 18 }}
          />
        </div>

        <h1 style={styles.title}>Silverleaf Academy</h1>
        <p style={styles.subtitle}>Staff Management System</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              placeholder="yourname@silverleaf.co.tz"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              style={styles.input}
              required
              autoFocus
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <div style={styles.passwordWrap}>
              <input
                type={showPwd ? 'text' : 'password'}
                placeholder="Enter your password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                style={{ ...styles.input, paddingRight: 44 }}
                required
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} style={styles.eyeBtn}>
                {showPwd ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
            </div>
          </div>

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={styles.hint}>
          New accounts sign in with the temporary password issued by their administrator, and will be prompted to change it on first login.
        </p>
      </div>
    </div>
  );
}

const C = { navy: BRAND.electricBlue, blue: BRAND.lightBlue, gold: BRAND.gold, light: '#F4F4F5', border: `${BRAND.silver}55`, text: BRAND.electricBlue, muted: BRAND.silver };

const styles = {
  page: { minHeight: '100vh', background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navy} 60%, ${BRAND.lightBlue} 140%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { background: BRAND.white, borderRadius: 16, padding: '48px 40px', width: '100%', maxWidth: 420, boxShadow: `0 24px 64px ${BRAND.electricBlue}4D`, textAlign: 'center' },
  logoWrap: { display: 'flex', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 4px' },
  subtitle: { fontSize: 14, color: C.muted, margin: '0 0 32px' },
  form: { textAlign: 'left' },
  field: { marginBottom: 20 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 },
  input: { width: '100%', padding: '11px 14px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 15, color: C.text, outline: 'none', boxSizing: 'border-box', background: C.light },
  passwordWrap: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 0, display: 'flex' },
  btn: { width: '100%', padding: '13px', background: C.navy, color: 'white', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8, letterSpacing: 0.3 },
  hint: { fontSize: 12, color: C.muted, marginTop: 24, lineHeight: 1.6 },
};