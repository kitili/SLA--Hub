'use client';

import axios from 'axios';
import { loginPathFromPathname } from '@/lib/authPaths';
import { clearStoredAuthSession, isBrowserOffline, readStoredAuthToken } from '@/lib/network';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  timeout: 15000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = readStoredAuthToken();
  if (token && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    const isAuthRequest = /\/auth\/(login|me|logout)/.test(err.config?.url || '');
    if (err.response?.status === 403 && err.response?.data?.code === 'MUST_CHANGE_PASSWORD') {
      window.location.href = '/change-password';
      return Promise.reject(err);
    }
    if (err.response?.status === 401 && !isAuthRequest) {
      if (isBrowserOffline()) return Promise.reject(err);
      clearStoredAuthSession();
      window.location.href = loginPathFromPathname(window.location.pathname);
    }
    return Promise.reject(err);
  }
);

export default api;
