import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { Meeting } from "@meeting-ai/core";
import { useMeetingStore } from "../stores/meeting-store";

const PAGE_SIZE = 50;

export function useMeetings() {
  const searchQuery = useMeetingStore((s) => s.searchQuery);
  const offset = useMeetingStore((s) => s.offset);
  const setOffset = useMeetingStore((s) => s.setOffset);

  const query = useQuery<Meeting[]>({
    queryKey: ["meetings", searchQuery, offset],
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
        : invoke<Meeting[]>("list_meetings", { offset, limit: PAGE_SIZE }),
  });

  return {
    ...query,
    hasMore: !searchQuery && (query.data?.length ?? 0) === PAGE_SIZE,
    loadMore: () => setOffset(offset + PAGE_SIZE),
  };
}

export function useMeeting(id: string | null) {
  return useQuery<Meeting>({
    queryKey: ["meeting", id],
    queryFn: () => invoke<Meeting>("get_meeting", { id: id! }),
    enabled: !!id,
  });
}
