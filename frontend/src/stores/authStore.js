import { create } from 'zustand';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Configure axios defaults
axios.defaults.withCredentials = true;

export const useAuthStore = create((set, get) => ({
  user: null,
  isLoading: true,
  error: null,

  checkAuth: async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`);
      set({ user: response.data, isLoading: false, error: null });
      return response.data;
    } catch (error) {
      set({ user: null, isLoading: false, error: null });
      return null;
    }
  },

  login: async (email, password) => {
    try {
      set({ error: null });
      const response = await axios.post(`${API_URL}/api/auth/login`, { email, password });
      set({ user: response.data, error: null });
      return response.data;
    } catch (error) {
      const detail = error.response?.data?.detail;
      const errorMsg = formatError(detail);
      set({ error: errorMsg });
      throw new Error(errorMsg);
    }
  },

  register: async (email, password, name) => {
    try {
      set({ error: null });
      const response = await axios.post(`${API_URL}/api/auth/register`, { email, password, name });
      set({ user: response.data, error: null });
      return response.data;
    } catch (error) {
      const detail = error.response?.data?.detail;
      const errorMsg = formatError(detail);
      set({ error: errorMsg });
      throw new Error(errorMsg);
    }
  },

  logout: async () => {
    try {
      await axios.post(`${API_URL}/api/auth/logout`);
      set({ user: null, error: null });
    } catch (error) {
      set({ user: null, error: null });
    }
  },

  fetchUsers: async () => {
    set({ isLoading: true });
    try {
      const response = await axios.get(`${API_URL}/api/admin/users`);
      set({ users: response.data, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  clearError: () => set({ error: null }),
}));

function formatError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  }
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
