import { create } from 'zustand';

export const usePlayerStore = create((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  progress: 0,
  duration: 0,
  volume: 1,
  setCurrentTrack: (track) => set({ currentTrack: track, progress: 0 }),
  setQueue: (tracks, startIndex = 0) => set({ queue: tracks, queueIndex: Math.min(startIndex, Math.max(0, tracks.length - 1)) }),
  addToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })),
  removeFromQueue: (index) =>
    set((s) => {
      const q = [...s.queue];
      q.splice(index, 1);
      const newIdx = index < s.queueIndex ? s.queueIndex - 1 : s.queueIndex;
      const nextIdx = Math.min(Math.max(0, newIdx), q.length - 1);
      return { queue: q, queueIndex: nextIdx };
    }),
  clearQueue: () => set({ queue: [], queueIndex: 0 }),
  setQueueIndex: (i) => set({ queueIndex: i }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setProgress: (v) => set({ progress: v }),
  setDuration: (v) => set({ duration: v }),
  setVolume: (v) => set({ volume: v }),
  next: () => {
    const { queue, queueIndex } = get();
    if (queueIndex < queue.length - 1) {
      set({ queueIndex: queueIndex + 1 });
      return queue[queueIndex + 1];
    }
    return null;
  },
  prev: () => {
    const { queue, queueIndex } = get();
    if (queueIndex > 0) {
      set({ queueIndex: queueIndex - 1 });
      return queue[queueIndex - 1];
    }
    return null;
  },
  getCurrentFromQueue: () => {
    const { queue, queueIndex } = get();
    return queue[queueIndex] ?? null;
  },
}));
