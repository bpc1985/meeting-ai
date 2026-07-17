import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { TranscriptSegment } from "@meeting-ai/core";

interface SegmentInput {
  speaker_label: string;
  text: string;
  start_secs: number;
  end_secs: number;
}

export function useSegments(meetingId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery<TranscriptSegment[]>({
    queryKey: ["segments", meetingId],
    queryFn: () => invoke<TranscriptSegment[]>("get_segments", { meetingId: meetingId! }),
    enabled: !!meetingId,
  });

  const createBatch = useMutation({
    mutationFn: (segments: SegmentInput[]) =>
      invoke("create_segments_batch", { meetingId: meetingId!, segments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments", meetingId] });
    },
  });

  const updateSegment = useMutation({
    mutationFn: ({ id, ...rest }: { id: string; text?: string; speaker_label?: string }) =>
      invoke("update_segment", { id, ...rest }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments", meetingId] });
    },
  });

  const renameSpeaker = useMutation({
    mutationFn: ({ oldLabel, newLabel }: { oldLabel: string; newLabel: string }) =>
      invoke("rename_speaker", { meetingId: meetingId!, oldLabel, newLabel }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments", meetingId] });
    },
  });

  const deleteSegment = useMutation({
    mutationFn: (id: string) => invoke("delete_segment", { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments", meetingId] });
    },
  });

  return { ...query, createBatch, updateSegment, renameSpeaker, deleteSegment };
}
