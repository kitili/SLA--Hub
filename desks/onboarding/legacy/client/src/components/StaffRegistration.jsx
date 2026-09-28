import { useState } from 'react';
import { useStaff } from '../context/StaffContext';
import { ALLOWED_EMAIL_DOMAIN, validateStaffEmail } from '../utils/email';
import './StaffRegistration.css';

export default function StaffRegistration() {
  const { signIn, register, dbOnline } = useStaff();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const emailError = validateStaffEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email);
    } catch (err) {
      const notFound = err.message?.includes('No account found') || err.message?.includes('404');
      if (notFound) {
        if (!fullName.trim()) {
          setError('First time here? Add your name below.');
          setSubmitting(false);
          return;
        }
        try {
          await register({ email, fullName });
        } catch (regErr) {
          setError(regErr.message || 'Could not get started. Please try again.');
        }
      } else {
        setError(err.message || 'Could not sign in. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="staff-registration-overlay">
      <div className="staff-registration-card">
        <img src="/assets/branding/logomark-electric-blue.svg" alt="" className="reg-logo" />
        <h1>Welcome</h1>
        <p className="reg-sub">
          Sign in with your Silverleaf work email (<strong>@{ALLOWED_EMAIL_DOMAIN}</strong>).
          New staff — add your name on first visit.
        </p>

        {!dbOnline && (
          <p className="reg-offline">Offline mode — progress saves on this device only.</p>
        )}

        <form onSubmit={handleSubmit} className="reg-form">
          <label>
            Work email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
              autoComplete="email"
              inputMode="email"
              autoFocus
            />
          </label>
          <label>
            Your name <span className="optional">(first visit only)</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
            />
          </label>

          {error && <p className="reg-error">{error}</p>}

          <button type="submit" className="reg-submit" disabled={submitting}>
            {submitting ? 'One moment…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
