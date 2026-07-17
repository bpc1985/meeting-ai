import { create } from "zustand";

interface MeetingStore {
  selectedMeetingId: string | null;
  searchQuery: string;
  setSelectedMeeting: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
}

export const useMeetingStore = create<MeetingStore>((set) => ({
  selectedMeetingId: null,
  searchQuery: "",
  setSelectedMeeting: (id) => set({ selectedMeetingId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
}));
