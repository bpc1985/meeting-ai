import { create } from "zustand";

interface MeetingStore {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const useMeetingStore = create<MeetingStore>((set) => ({
  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),
}));
