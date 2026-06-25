import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({ baseURL: API_BASE });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('pt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('pt_token');
      localStorage.removeItem('pt_user');
      window.location.href = '/login';
    }
    const msg = err.response?.data?.error || 'Terjadi kesalahan';
    toast.error(msg);
    return Promise.reject(err);
  }
);

export default client;
