import axios from 'axios';

// Point at the production API by default. Set VITE_API_URL in a local
// .env file to override for local backend testing.
const baseURL = (import.meta.env.VITE_API_URL ?? 'https://thepupperclub.ca') + '/api';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

// Attach the stored bearer token to every request, AND convert
// PUT/PATCH/DELETE to POST with `_method` spoofing — Plesk/IIS strips
// request bodies on those verbs and never delivers them to PHP, so
// Laravel ends up with empty $request data. POST + _method gets the
// body through and Laravel routes it correctly via Symfony's HTTP
// method override.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('community_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const method = config.method?.toUpperCase();
  if (method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    const data = config.data ?? {};
    if (data instanceof FormData) {
      data.append('_method', method);
    } else {
      config.data = { ...data, _method: method };
    }
    config.method = 'post';
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
        // Bounce back to the app's own welcome screen, which lives
        // under whatever base path the build was deployed under
        // (e.g. /community/app/ for the web build, / for Tauri).
        window.location.assign(import.meta.env.BASE_URL);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
