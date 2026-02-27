import { create } from 'zustand';

/** Stores the PWA install prompt event so Settings can trigger it on button click. */
export const usePWAStore = create((set) => ({
  installPrompt: null,
  setInstallPrompt: (event) => set({ installPrompt: event }),
  clearInstallPrompt: () => set({ installPrompt: null }),
}));
