import axios from 'axios';

const BASE_URL = process.env.REACT_APP_BASE_URL;

const api = axios.create({
  baseURL: BASE_URL,
});

export function clearTokens() {
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('refresh_token');
}

// Add a request interceptor to include JWT token from sessionStorage if present
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Access tokens are short-lived: on a 401, swap the refresh token for a new
// access token once and retry. If that fails too, the session is over.
let refreshing = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const refresh = sessionStorage.getItem('refresh_token');
    if (error.response?.status !== 401 || !refresh || !original || original._retried || original.url?.includes('/token/')) {
      return Promise.reject(error);
    }
    original._retried = true;
    try {
      refreshing = refreshing || api.post('/token/refresh/', { refresh }).finally(() => { refreshing = null; });
      const { data } = await refreshing;
      sessionStorage.setItem('access_token', data.access);
      original.headers.Authorization = `Bearer ${data.access}`;
      return api(original);
    } catch {
      clearTokens();
      window.dispatchEvent(new Event('lsms:session-expired'));
      return Promise.reject(error);
    }
  }
);

export default api;
