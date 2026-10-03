import axios from 'axios';

/**
 * Shared axios instance that attaches the Bearer token and
 * automatically logs the user out on a 401 response.
 *
 * Import this in every page/component instead of raw axios.
 */
const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL
});

// ── Request interceptor: attach token ──────────────────────────────────────
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ── Response interceptor: log out on 401 ───────────────────────────────────
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Clear stale credentials and redirect to login.
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // A hard redirect ensures the React state is also reset.
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
