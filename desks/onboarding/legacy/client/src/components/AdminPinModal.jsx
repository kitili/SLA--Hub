import { useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import './AdminPinModal.css';

export default function AdminPinModal() {
  const { verifyPin, dismissPinPrompt, pinError, verifying } = useAdmin();
  const [pin, setPin] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    await verifyPin(pin.trim());
  };

  return (
    <div className="admin-pin-overlay">
      <div className="admin-pin-card">
        <h2>Admin PIN</h2>
        <p>Enter your admin PIN to manage staff progress and documents.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            autoFocus
            required
            maxLength={12}
          />
          {pinError && <p className="admin-pin-error">{pinError}</p>}
          <button type="submit" className="admin-pin-submit" disabled={verifying}>
            {verifying ? 'Checking…' : 'Unlock admin'}
          </button>
          <button type="button" className="admin-pin-skip" onClick={dismissPinPrompt}>
            Skip — browse onboarding as staff
          </button>
        </form>
      </div>
    </div>
  );
}
