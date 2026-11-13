import { create } from "zustand";
import type { Track } from "../types";

export type RepeatMode = "off" | "all" | "one";

interface PlayerState {
  queue: Track[];
  index: number;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  playNow: (track: Track, rest?: Track[]) => void;
  enqueue: (tracks: Track[]) => void;
  playAt: (index: number) => void;
  removeAt: (index: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  setPosition: (p: number) => void;
  setDuration: (d: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  reorder: (from: number, to: number) => void;
}

const shuffled = (queue: Track[], keep: number): number[] => {
  const rest = queue.map((_, i) => i).filter((i) => i !== keep);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [keep, ...rest];
};

export const usePlayer = create<PlayerState>((set, get) => ({
  queue: [],
  index: -1,
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 0.8,
  shuffle: false,
  repeat: "off",
  playNow: (track, rest = []) => {
    const { shuffle } = get();
    const queue = [track, ...rest];
    if (shuffle && queue.length > 1) {
      const [order] = [shuffled(queue, 0)];
      set({
        queue: order.map((i) => queue[i]),
        index: 0,
        isPlaying: true,
        position: 0,
      });
      return;
    }
    set({ queue, index: 0, isPlaying: true, position: 0 });
  },
  enqueue: (tracks) =>
    set((s) => ({ queue: [...s.queue, ...tracks], index: s.index === -1 ? 0 : s.index })),
  reorder: (from, to) =>
    set((s) => {
      const q = [...s.queue];
      const [moved] = q.splice(from, 1);
      q.splice(to, 0, moved);
      let index = s.index;
      if (s.index === from) index = to;
      else if (from < s.index && to >= s.index) index -= 1;
      else if (from > s.index && to <= s.index) index += 1;
      return { queue: q, index };
    }),
  removeAt: (i) =>
    set((s) => {
      const q = s.queue.filter((_, idx) => idx !== i);
      let index = s.index;
      if (i < s.index) index -= 1;
      if (index >= q.length) index = q.length - 1;
      return { queue: q, index, isPlaying: q.length > 0 && s.isPlaying };
    }),
  playAt: (index) => set({ index, isPlaying: true, position: 0 }),
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),
  next: () => {
    const s = get();
    if (s.repeat === "one") {
      set({ position: 0 });
      return;
    }
    if (s.index < s.queue.length - 1) set({ index: s.index + 1, position: 0 });
    else if (s.repeat === "all" || s.shuffle) set({ index: 0, position: 0 });
    else set({ isPlaying: false });
  },
  prev: () => {
    const s = get();
    if (s.position > 3) {
      set({ position: 0 });
      return;
    }
    if (s.index > 0) set({ index: s.index - 1, position: 0 });
    else set({ position: 0 });
  },
  setPosition: (p) => set({ position: p }),
  setDuration: (d) => set({ duration: d }),
  setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)) }),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  cycleRepeat: () =>
    set((s) => ({ repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off" })),
}));

export const selectCurrent = (s: PlayerState) =>
  s.index >= 0 && s.index < s.queue.length ? s.queue[s.index] : null;
