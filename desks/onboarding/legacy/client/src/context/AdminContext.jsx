import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { api } from '../utils/api';
import { useStaff } from './StaffContext';

const PIN_KEY = 'sla-admin-pin';

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const { staff, isAdmin } = useStaff();
  const [pin, setPin] = useState(() => sessionStorage.getItem(PIN_KEY) || '');
  const [pinVerified, setPinVerified] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinError, setPinError] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (isAdmin && staff?.id) {
      const saved = sessionStorage.getItem(PIN_KEY);
      if (saved) {
        setPin(saved);
        setPinVerified(true);
      } else {
        setShowPinPrompt(true);
      }
    } else {
      setPinVerified(false);
      setShowPinPrompt(false);
    }
  }, [isAdmin, staff?.id]);

  const verifyPin = useCallback(async (enteredPin) => {
    if (!staff?.id) return false;
    setVerifying(true);
    setPinError('');
    try {
      await api.verifyAdminPin(staff.id, enteredPin);
      setPin(enteredPin);
      sessionStorage.setItem(PIN_KEY, enteredPin);
      setPinVerified(true);
      setShowPinPrompt(false);
      return true;
    } catch (err) {
      setPinError(err.message || 'Invalid PIN');
      return false;
    } finally {
      setVerifying(false);
    }
  }, [staff?.id]);

  const openPinPrompt = useCallback(() => setShowPinPrompt(true), []);

  const clearPin = useCallback(() => {
    setPin('');
    setPinVerified(false);
    sessionStorage.removeItem(PIN_KEY);
    setShowPinPrompt(true);
  }, []);

  const value = useMemo(
    () => ({
      pin,
      pinVerified: isAdmin && pinVerified,
      showPinPrompt: isAdmin && showPinPrompt && !pinVerified,
      pinError,
      verifying,
      verifyPin,
      clearPin,
      openPinPrompt,
      dismissPinPrompt: () => setShowPinPrompt(false),
    }),
    [pin, isAdmin, pinVerified, showPinPrompt, pinError, verifying, verifyPin, clearPin, openPinPrompt]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
