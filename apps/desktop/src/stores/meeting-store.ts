import { create } from "zustand";

interface MeetingStore {
  searchQuery: string;
  offset: number;
  setSearchQuery: (q: string) => void;
  setOffset: (o: number) => void;
}

export const useMeetingStore = create<MeetingStore>((set) => ({
  searchQuery: "",
  offset: 0,
  setSearchQuery: (q) => set({ searchQuery: q, offset: 0 }),
  setOffset: (o) => set({ offset: o }),
}));
