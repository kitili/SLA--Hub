import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  withCredentials: true,
});

api.interceptors.response.use(
  res => res,
  err => {
    // Don't hijack a failed login attempt itself — a wrong-password 401 here should
    // just show the toast in Login.jsx, not force a full-page redirect that wipes it
    // out before it's visible. Only treat 401 as "session expired" for other calls.
    const isLoginRequest = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 403 && err.response?.data?.code === 'MUST_CHANGE_PASSWORD') {
      window.location.href = '/change-password';
      return Promise.reject(err);
    }
    if (err.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('silverleaf-auth');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
