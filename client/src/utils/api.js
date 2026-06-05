import axios from 'axios';

const api = axios.create(
  { 
    baseURL: import.meta.env.VITE_API_URL || '/api' 
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const hasToken = !!localStorage.getItem('gc_token');
    if (err.response?.status === 401 && hasToken) {
      localStorage.removeItem('gc_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
