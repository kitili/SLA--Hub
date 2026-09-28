import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../utils/api';
import { normalizeStaffEmail, validateStaffEmail } from '../utils/email';

const STAFF_KEY = 'silverleaf-staff';

const StaffContext = createContext(null);

function persistStaff(staff) {
  localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
}

export function StaffProvider({ children }) {
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbOnline, setDbOnline] = useState(false);

  const applyStaff = useCallback((next) => {
    setStaff(next);
    if (next) persistStaff(next);
  }, []);

  useEffect(() => {
    async function init() {
      let online = false;
      try {
        const h = await api.health();
        online = Boolean(h.database);
        setDbOnline(online);
      } catch {
        setDbOnline(false);
      }

      const saved = localStorage.getItem(STAFF_KEY);
      if (!saved) {
        setLoading(false);
        return;
      }

      try {
        const parsed = JSON.parse(saved);
        if (parsed.id && !parsed.id.startsWith('local-') && online) {
          try {
            const { staff: fresh } = await api.getStaff(parsed.id);
            applyStaff(fresh);
          } catch {
            applyStaff(parsed);
          }
        } else {
          applyStaff(parsed);
        }
      } catch {
        localStorage.removeItem(STAFF_KEY);
      }
      setLoading(false);
    }
    init();
  }, [applyStaff]);

  const signIn = useCallback(async (email) => {
    const emailError = validateStaffEmail(email);
    if (emailError) throw new Error(emailError);

    if (!dbOnline) {
      throw new Error('Sign-in requires a database connection. Please try again later.');
    }
    const { staff: signedIn } = await api.signInStaff(normalizeStaffEmail(email));
    applyStaff(signedIn);
    return signedIn;
  }, [dbOnline, applyStaff]);

  const register = useCallback(async ({ email, fullName }) => {
    const emailError = validateStaffEmail(email);
    if (emailError) throw new Error(emailError);

    const normalizedEmail = normalizeStaffEmail(email);

    if (!dbOnline) {
      const localStaff = {
        id: 'local-' + Date.now(),
        email: normalizedEmail,
        full_name: fullName.trim(),
        campus: null,
        job_title: null,
        is_admin: false,
      };
      applyStaff(localStaff);
      return localStaff;
    }

    const { staff: registered } = await api.registerStaff({ email: normalizedEmail, fullName });
    applyStaff(registered);
    return registered;
  }, [dbOnline, applyStaff]);

  const logout = useCallback(() => {
    localStorage.removeItem(STAFF_KEY);
    localStorage.removeItem('silverleaf-onboarding-progress');
    sessionStorage.removeItem('sla-admin-pin');
    setStaff(null);
  }, []);

  const isAdmin = Boolean(staff?.is_admin);

  const value = useMemo(
    () => ({ staff, loading, dbOnline, isAdmin, signIn, register, logout }),
    [staff, loading, dbOnline, isAdmin, signIn, register, logout]
  );

  return (
    <StaffContext.Provider value={value}>
      {children}
    </StaffContext.Provider>
  );
}

export function useStaff() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error('useStaff must be used within StaffProvider');
  return ctx;
}
