import axios from 'axios';
import toast from 'react-hot-toast';
import { saveReturnTo } from '../utils/returnTo';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const PUBLIC_PATHS = ['/login', '/report-bug'];

const client = axios.create({ baseURL: API_BASE });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('pt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !PUBLIC_PATHS.includes(window.location.pathname)) {
      localStorage.removeItem('pt_token');
      localStorage.removeItem('pt_user');
      saveReturnTo(window.location.pathname + window.location.search);   // come back here after logging in again
      window.location.href = '/login';
    }
    // `silent: true` in the request config (background lookups such as the Ctrl K palette) skips the toast
    if (!err.config?.silent) toast.error(err.response?.data?.error || 'Terjadi kesalahan');
    return Promise.reject(err);
  }
);

export default client;
