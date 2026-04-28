import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Inject token + convert PUT/PATCH/DELETE to POST with _method spoofing (IIS strips bodies on these methods)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
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

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
