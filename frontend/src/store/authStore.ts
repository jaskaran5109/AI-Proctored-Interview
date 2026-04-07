import { create } from "zustand";

import { me } from "@/services/auth";
import { AuthResponse, User } from "@/types/api";


interface AuthState {
  user: User | null;
  token: string | null;
  hydrated: boolean;
  setAuth: (payload: AuthResponse) => void;
  clearAuth: () => void;
  hydrate: () => void;
  bootstrap: () => Promise<void>;
}


const TOKEN_KEY = "aiproctor_token";
const USER_KEY = "aiproctor_user";


export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  hydrated: false,
  setAuth: (payload) => {
    localStorage.setItem(TOKEN_KEY, payload.tokens.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    set({ token: payload.tokens.access_token, user: payload.user, hydrated: true });
  },
  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, hydrated: true });
  },
  hydrate: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    set({
      token,
      user: rawUser ? JSON.parse(rawUser) : null,
      hydrated: true,
    });
  },
  bootstrap: async () => {
    if (!get().token) {
      return;
    }
    try {
      const user = await me();
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user, hydrated: true });
    } catch {
      get().clearAuth();
    }
  },
}));
