import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('industrialflow_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function apiError(error) {
  return error.response?.data?.message || error.message || 'The request could not be completed.';
}

export default api;

