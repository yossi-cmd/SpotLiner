import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as api from '../api';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        if (token) localStorage.setItem('spotliner_token', token);
        set({ user, token });
      },
      logout: () => {
        localStorage.removeItem('spotliner_token');
        set({ user: null, token: null });
      },
      loadUser: async () => {
        const token = localStorage.getItem('spotliner_token');
        if (!token) return set({ user: null, token: null });
        try {
          const user = await api.getMe();
          set({ user, token });
          return user;
        } catch {
          set({ user: null, token: null });
          localStorage.removeItem('spotliner_token');
          return null;
        }
      },
      canUpload: () => {
        const state = useAuthStore.getState();
        return state.user && ['admin', 'uploader'].includes(state.user.role);
      },
    }),
    { name: 'spotliner-auth', partialize: (s) => ({ token: s.token, user: s.user }) }
  )
);
