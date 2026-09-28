import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../utils/api';

const MARKETING_ROLES = ['global_marketing_head', 'campus_marketing_head'];
const SE_ROLES = ['global_student_exp_head', 'campus_student_exp_head'];
const NURSE_ROLES = ['nurse'];

function allRoles(user) {
  if (!user) return [];
  return [user.role, ...(user.additionalRoles || [])];
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:  null,
      token: null,
      mustChangePassword: false,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        set({
          user: data.user,
          token: data.token,
          mustChangePassword: !!data.mustChangePassword,
        });
        return data;
      },

      logout: () => {
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, token: null, mustChangePassword: false });
      },

      setToken: (token) => {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        set({ token });
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
      isGlobalHead: () => {
        const roles = allRoles(get().user);
        return roles.includes('global_marketing_head') || roles.includes('global_student_exp_head');
      },
      hasAnyRole: (...roles) => allRoles(get().user).some((r) => roles.includes(r)),
    }),
    {
      name: 'silverleaf-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        mustChangePassword: state.mustChangePassword,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
        }
      },
    }
  )
);
