import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { Meeting } from "@meeting-ai/core";
import { useMeetingStore } from "../stores/meeting-store";

export function useMeetings() {
  const searchQuery = useMeetingStore((s) => s.searchQuery);

  return useQuery<Meeting[]>({
    queryKey: ["meetings", searchQuery],
    queryFn: () =>
      searchQuery
        ? invoke<Array<{ id: string; title: string; created_at: string; snippet: string; speaker_label: string }>>("search_meetings", { query: searchQuery }).then((results) =>
            results.map((r) => ({
              id: r.id,
              title: r.title,
              audio_path: null as string | null,
              duration_secs: null as number | null,
              created_at: r.created_at,
              updated_at: r.created_at,
              status: "transcribed" as const,
            })) satisfies Meeting[]
          )
        : invoke<Meeting[]>("list_meetings"),
  });
}

export function useMeeting(id: string | null) {
  return useQuery<Meeting>({
    queryKey: ["meeting", id],
    queryFn: () => invoke<Meeting>("get_meeting", { id: id! }),
    enabled: !!id,
  });
}
