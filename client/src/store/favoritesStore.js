import { create } from 'zustand';
import * as api from '../api';

export const useFavoritesStore = create((set) => ({
  favoriteIds: new Set(),
  loaded: false,

  loadFavorites: async () => {
    try {
      const { tracks } = await api.getFavorites();
      set({
        favoriteIds: new Set((tracks || []).map((t) => Number(t.id))),
        loaded: true,
      });
    } catch {
      set({ favoriteIds: new Set(), loaded: true });
    }
  },

  addFavorite: (trackId) => {
    set((s) => ({
      favoriteIds: new Set(s.favoriteIds).add(Number(trackId)),
    }));
  },

  removeFavorite: (trackId) => {
    set((s) => {
      const next = new Set(s.favoriteIds);
      next.delete(Number(trackId));
      return { favoriteIds: next };
    });
  },

  clear: () => set({ favoriteIds: new Set(), loaded: false }),
}));

