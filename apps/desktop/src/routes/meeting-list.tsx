import { useNavigate } from "react-router-dom";
import { Mic, Search } from "lucide-react";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMeetings } from "../hooks/use-meetings";
import { useMeetingStore } from "../stores/meeting-store";

export function MeetingListPage() {
  const { data: meetings, isLoading, refetch } = useMeetings();
  const searchQuery = useMeetingStore((s) => s.searchQuery);
  const setSearchQuery = useMeetingStore((s) => s.setSearchQuery);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const handleNewRecording = async () => {
    setCreating(true);
    try {
      const meeting = await invoke<{ id: string }>("create_meeting", {
        title: `Meeting — ${new Date().toLocaleDateString()}`,
      });
      navigate(`/recording/${meeting.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (confirm("Delete this meeting and all its data?")) {
      await invoke("delete_meeting", { id });
      refetch();
    }
  };

  const grouped = groupByDate(meetings ?? []);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Meetings</h1>
        <button
          onClick={handleNewRecording}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent text-bg-deep font-semibold rounded-md text-sm hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 transition-all"
        >
          <Mic size={18} />
          {creating ? "Creating..." : "New Recording"}
        </button>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search meetings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg-elevated border border-border-default rounded-md pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-focus focus:ring-2 focus:ring-accent/10 outline-none"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-bg-elevated rounded-lg p-5 border border-border-default animate-pulse">
              <div className="h-5 bg-bg-hover rounded w-48 mb-2" />
              <div className="h-4 bg-bg-hover rounded w-32" />
            </div>
          ))}
        </div>
      ) : (meetings?.length ?? 0) === 0 ? (
        <div className="bg-bg-elevated rounded-lg p-12 text-center border border-border-default">
          <Mic size={48} className="mx-auto text-text-tertiary mb-4" />
          <p className="text-text-secondary text-lg mb-2">No meetings yet</p>
          <p className="text-text-tertiary mb-4">Record your first meeting to get started</p>
          <button
            onClick={handleNewRecording}
            className="px-4 py-2.5 bg-accent text-bg-deep font-semibold rounded-md text-sm hover:bg-accent-hover active:scale-[0.98] transition-all"
          >
            Start Recording
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([label, items]: [string, Array<{ id: string; title: string; status: string; duration_secs: number | null; created_at: string }>]) => (
            <div key={label}>
              <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">{label}</h2>
              <div className="space-y-2">
                {items.map((m) => (
                  <div
                    key={m.id}
                    className="bg-bg-elevated rounded-lg p-5 border border-border-default hover:border-border-emphasis cursor-pointer transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1" onClick={() => navigate(`/meeting/${m.id}`)}>
                        <h3 className="text-base font-medium text-text-primary truncate">{m.title}</h3>
                        <p className="text-sm text-text-secondary mt-1">
                          {formatTime(m.created_at)} · {m.duration_secs ? fmtDuration(m.duration_secs) : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          m.status === "summarized" ? "bg-success-muted text-success"
                            : m.status === "transcribed" ? "bg-info-muted text-info"
                            : "bg-warning-muted text-warning"
                        }`}>{m.status}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteMeeting(m.id); }}
                          className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-error transition-all p-1"
                          title="Delete"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByDate(meetings: Array<{ created_at: string; id: string; title: string; status: string; duration_secs: number | null }>) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const groups: Record<string, typeof meetings> = {};
  for (const m of meetings) {
    const d = new Date(m.created_at);
    let label: string;
    if (d >= today) label = "Today";
    else if (d >= yesterday) label = "Yesterday";
    else if (d >= weekAgo) label = "This Week";
    else label = "Earlier";
    if (!groups[label]) groups[label] = [];
    groups[label].push(m);
  }
  return groups;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
