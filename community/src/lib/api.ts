import axios from 'axios';

// Point at the production API by default. Set VITE_API_URL in a local
// .env file to override for local backend testing.
const baseURL = (import.meta.env.VITE_API_URL ?? 'https://thepupperclub.ca') + '/api';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

// Attach the stored bearer token to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('community_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On a 401, clear the stale token and bounce to /welcome. Anything other
// than 401 is left for the page-level error handler.
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url ?? '';
      // Don't redirect away from the sign-in screen for a wrong-password 401.
      if (!url.startsWith('/community/auth/')) {
        localStorage.removeItem('community_token');
        localStorage.removeItem('community_member');
        window.location.assign('/');
      }
    }
    return Promise.reject(error);
  },
);

export default api;
