import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('industrialflow_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function apiError(error) {
  const response = error.response?.data;

  if (response?.code === 'VALIDATION_ERROR' && response.details) {
    const fieldErrors = Object.entries(response.details.fieldErrors || {})
      .flatMap(([field, messages]) => messages.map((message) => {
        const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
        return `${label}: ${message}`;
      }));
    const formErrors = response.details.formErrors || [];
    const details = [...fieldErrors, ...formErrors];

    if (details.length) return `Please check the entered details. ${details.join(' ')}`;
  }

  return response?.message || error.message || 'The request could not be completed.';
}

export default api;

