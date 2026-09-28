'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';
import { isBrowserOffline, isOfflineFailure } from '@/lib/network';
import { rememberOfflineLogin, unlockOfflineLogin } from '@/lib/offlineLogin';

const MARKETING_ROLES = ['ceo', 'global_marketing_head', 'campus_marketing_head'];
const SE_ROLES = ['global_student_exp_head', 'campus_student_exp_head'];
const NURSE_ROLES = ['nurse'];

function allRoles(user) {
  if (!user) return [];
  return [user.role, ...(user.additionalRoles || [])];
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      mustChangePassword: false,
      sessionReady: false,

      login: async (email, password, portal) => {
        async function applyOffline() {
          const data = await unlockOfflineLogin(email, password, portal);
          set({
            user: data.user,
            token: data.token || null,
            mustChangePassword: false,
            sessionReady: true,
          });
          return data;
        }

        async function continueMatchingCache() {
          const cached = get().user;
          const wanted = String(email || '').trim().toLowerCase();
          const have = String(cached?.email || '').trim().toLowerCase();
          if (!cached || !wanted || wanted !== have) return null;
          set({ sessionReady: true, mustChangePassword: false });
          return { user: cached, token: get().token, mustChangePassword: false, offline: true };
        }

        if (isBrowserOffline()) {
          try {
            return await applyOffline();
          } catch (err) {
            const cached = await continueMatchingCache();
            if (cached) return cached;
            throw err;
          }
        }

        try {
          const { data } = await api.post('/auth/login', { email, password, portal });
          if (!data.mustChangePassword) {
            try {
              await rememberOfflineLogin({
                email,
                password,
                portal,
                user: data.user,
                token: data.token,
              });
            } catch {
              /* offline vault is optional */
            }
          }
          set({
            user: data.user,
            token: data.token || null,
            mustChangePassword: !!data.mustChangePassword,
            sessionReady: true,
          });
          return data;
        } catch (err) {
          const invalid = err.response?.status === 400 || err.response?.status === 401;
          if (invalid) throw err;
          try {
            return await applyOffline();
          } catch (offlineErr) {
            const cached = await continueMatchingCache();
            if (cached) return cached;
            if (isOfflineFailure(err)) throw offlineErr;
            throw err;
          }
        }
      },

      continueCachedSession: async () => {
        if (typeof window !== 'undefined' && !useAuthStore.persist.hasHydrated()) {
          await useAuthStore.persist.rehydrate();
        }
        const cached = get().user;
        if (!cached) return null;
        set({ sessionReady: true });
        return cached;
      },

      restoreSession: async () => {
        if (typeof window !== 'undefined' && !useAuthStore.persist.hasHydrated()) {
          await useAuthStore.persist.rehydrate();
        }
        const cached = get().user;
        if (isBrowserOffline()) {
          set({ sessionReady: true });
          return cached || null;
        }
        try {
          const { data } = await api.get('/auth/me', { timeout: cached ? 5000 : 15000 });
          set({
            user: data.user,
            mustChangePassword: !!data.mustChangePassword,
            sessionReady: true,
          });
          return data.user;
        } catch (err) {
          if (cached && (isOfflineFailure(err) || err.response?.status === 401 || err.response?.status === 403)) {
            set({ sessionReady: true });
            return cached;
          }
          if (isOfflineFailure(err)) {
            set({ sessionReady: true });
            return cached || null;
          }
          set({ user: null, token: null, mustChangePassword: false, sessionReady: true });
          return null;
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          /* cookie already gone */
        }
        if (typeof window !== 'undefined') {
          localStorage.removeItem('silverleaf-auth');
        }
        set({ user: null, token: null, mustChangePassword: false, sessionReady: true });
      },

      clearMustChangePassword: () => {
        const { user } = get();
        set({
          mustChangePassword: false,
          user: user ? { ...user, mustChangePassword: false } : user,
        });
      },

      isMarketing: () => allRoles(get().user).some((r) => MARKETING_ROLES.includes(r)),
      isSE: () => allRoles(get().user).some((r) => SE_ROLES.includes(r)),
      isNurse: () => allRoles(get().user).some((r) => NURSE_ROLES.includes(r)),
      isCeo: () => allRoles(get().user).includes('ceo'),
      isGlobalHead: () => {
        const roles = allRoles(get().user);
        return roles.includes('ceo') || roles.includes('global_marketing_head') || roles.includes('global_student_exp_head');
      },
      hasAnyRole: (...roles) => allRoles(get().user).some((r) => roles.includes(r)),
    }),
    {
      name: 'sla-auth',
      skipHydration: true,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        mustChangePassword: state.mustChangePassword,
      }),
    }
  )
);
