import { useParams } from "react-router-dom";
import { useState } from "react";
import { Download, Loader2, Sparkles } from "lucide-react";
import { useMeeting } from "../hooks/use-meetings";
import { useSegments } from "../hooks/use-segments";
import { useSummary, useTranscription } from "../hooks/use-summary";
import { formatAsTxt, formatAsSrt } from "@meeting-ai/export";
import type { TranscriptSegment } from "@meeting-ai/core";
import type { AISummary, RiskItem } from "@meeting-ai/llm";
import { fmtDuration, fmtTimestamp } from "../lib/format";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

const SPEAKER_COLORS = ["bg-speaker-1/20 text-speaker-1", "bg-speaker-2/20 text-speaker-2", "bg-speaker-3/20 text-speaker-3", "bg-speaker-4/20 text-speaker-4"];

export function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: meeting } = useMeeting(id ?? null);
  const { data: segments, updateSegment, renameSpeaker, deleteSegment } = useSegments(id);
  const { data: dbSummary, generate } = useSummary(id);
  const transcribe = useTranscription();
  const [summaryTab, setSummaryTab] = useState<"overview" | "decisions" | "actions" | "risks">("overview");
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const transcribeLabel = transcribing
    ? (transcribe.progress
        ? `Transcribing ${transcribe.progress.current}/${transcribe.progress.total} (${Math.round((transcribe.progress.current / transcribe.progress.total) * 100)}%)...`
        : "Transcribing...")
    : "Transcribe";

  const handleTranscribe = async () => {
    if (!id) return;
    setTranscribing(true);
    setError(null);
    try { await transcribe.mutateAsync(id); } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setTranscribing(false); }
  };

  const handleExport = async (format: "txt" | "srt") => {
    if (!segments || !meeting) return;
    const content = format === "txt" ? formatAsTxt(segments as TranscriptSegment[], meeting.title) : formatAsSrt(segments as TranscriptSegment[]);
    const ext = format === "txt" ? "txt" : "srt";
    const defaultName = `${meeting.title.replace(/[^a-z0-9]/gi, "-")}-${new Date().toISOString().slice(0, 10)}.${ext}`;
    const filePath = await save({ defaultPath: defaultName, filters: [{ name: format.toUpperCase(), extensions: [ext] }] });
    if (!filePath) return;
    await writeFile(filePath, new TextEncoder().encode(content));
  };

  const summary: AISummary | null = dbSummary ? {
    overview: dbSummary.overview ?? "",
    keyDecisions: (() => { try { return JSON.parse(dbSummary.key_decisions ?? "[]") as string[]; } catch { return []; } })(),
    actionItems: (() => { try { return JSON.parse(dbSummary.action_items ?? "[]") as string[]; } catch { return []; } })(),
    risks: (() => { try { return JSON.parse(dbSummary.risks ?? "[]") as RiskItem[]; } catch { return []; } })(),
  } : null;

  const progressPercent = transcribe.progress
    ? Math.round((transcribe.progress.current / transcribe.progress.total) * 100)
    : 0;
  const isSingleShot = transcribe.progress && transcribe.progress.total === 1;
  const isChunked = transcribe.progress && transcribe.progress.total > 1;

  return (
    <div className="flex h-full relative">
      {/* Transcription Overlay */}
      {transcribing && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-bg-deep/80 backdrop-blur-sm">
          <Loader2 size={40} className="animate-spin text-accent mb-4" />
          <p className="text-lg font-semibold text-text-primary mb-1">Transcribing…</p>
          {isSingleShot ? (
            <p className="text-sm text-text-secondary mb-3">Sending to API…</p>
          ) : isChunked ? (
            <p className="text-sm text-text-secondary mb-3">
              Chunk {transcribe.progress.current} / {transcribe.progress.total} ({progressPercent}%)
            </p>
          ) : (
            <p className="text-sm text-text-secondary mb-3">Preparing audio…</p>
          )}
          <div className="w-48 h-2 bg-bg-tertiary rounded-full overflow-hidden">
            {isChunked ? (
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            ) : isSingleShot ? (
              <div className="h-full bg-accent animate-pulse" style={{ width: "100%" }} />
            ) : (
              <div className="h-full bg-accent animate-pulse" style={{ width: "60%" }} />
            )}
          </div>
        </div>
      )}
      {/* Transcript Panel */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border-default">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">{meeting?.title ?? "Meeting"}</h1>
            {meeting?.duration_secs != null && <p className="text-xs text-text-tertiary mt-1">{fmtDuration(meeting.duration_secs)}</p>}
          </div>
          <div className="flex items-center gap-2">
            {meeting?.audio_path && (
              <div className="flex items-center gap-2">
                <button
                  onClick={async (e) => {
                    const audio = document.getElementById("audio-player") as HTMLAudioElement | null;
                    if (!audio || !meeting.audio_path) return;
                    if (playing) {
                      audio.pause();
                      setPlaying(false);
                      return;
                    }
                    // ponytail: read via Tauri fs, create blob URL for playback
                    const { readFile } = await import("@tauri-apps/plugin-fs");
                    const bytes = await readFile(meeting.audio_path);
                    const ext = meeting.audio_path.split(".").pop()?.toLowerCase() ?? "wav";
                    const mimeMap: Record<string, string> = {
                      wav: "audio/wav", mp3: "audio/mpeg", m4a: "audio/mp4",
                      aac: "audio/aac", ogg: "audio/ogg", webm: "audio/webm",
                      flac: "audio/flac",
                    };
                    const blob = new Blob([bytes], { type: mimeMap[ext] ?? "audio/wav" });
                    audio.src = URL.createObjectURL(blob);
                    audio.onended = () => setPlaying(false);
                    void audio.play();
                    setPlaying(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-all"
                >
                  {playing ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                  )}
                  {playing ? "Stop" : "Play"}
                </button>
              </div>
            )}
            <audio id="audio-player" className="hidden" />
            {error && (
              <div className="flex items-center gap-2 bg-error-muted border border-error/20 text-error text-xs rounded-md px-3 py-1.5">
                <span>Transcription failed: {error}</span>
                <button onClick={() => setError(null)} className="text-error/60 hover:text-error ml-auto">&times;</button>
              </div>
            )}
            {(!segments || segments.length === 0) && meeting?.audio_path && (
              <div className="flex items-center gap-2">
                <button onClick={handleTranscribe} disabled={transcribing}
                  className="flex items-center gap-2 px-3 py-1.5 bg-accent text-bg-deep font-semibold rounded-md text-xs hover:bg-accent-hover disabled:opacity-50 transition-all">
                  {transcribing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {transcribing ? transcribeLabel : "Transcribe"}
                </button>
                {transcribing && transcribe.progress && (
                  <div className="w-32 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                    <div className="h-full bg-accent transition-all duration-300" style={{ width: `${Math.round((transcribe.progress.current / transcribe.progress.total) * 100)}%` }} />
                  </div>
                )}
              </div>
            )}
            {segments && segments.length > 0 && (
              <div className="flex items-center gap-1">
                <button onClick={() => handleExport("txt")} className="flex items-center gap-1 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-all">
                  <Download size={12} /> TXT
                </button>
                <button onClick={() => handleExport("srt")} className="flex items-center gap-1 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-all">
                  <Download size={12} /> SRT
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {(!segments || segments.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles size={32} className="text-text-tertiary mb-3" />
              <p className="text-text-secondary mb-1">{meeting?.audio_path ? "Audio recorded. Transcribe to see transcript." : "No audio recorded yet."}</p>
            </div>
          ) : (
            segments.map((seg, i) => (
              <div key={seg.id} className="group flex gap-4 py-3 border-b border-border-default hover:bg-bg-hover/30">
                <span className="text-xs text-text-tertiary font-ui tabular-nums w-16 shrink-0 pt-1">{fmtTimestamp(seg.start_secs)}</span>
                <div className="flex-1 min-w-0">
                  <SpeakerPill speaker={seg.speaker_label} index={i}
                    onRename={(newName) => renameSpeaker.mutate({ oldLabel: seg.speaker_label, newLabel: newName })} />
                  <EditableText text={seg.text} onSave={(t) => updateSegment.mutate({ id: seg.id, text: t })} />
                </div>
                <button onClick={() => deleteSegment.mutate(seg.id)}
                  className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-error shrink-0 transition-all p-1 mt-1" title="Delete segment">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Summary Panel */}
      <div className="w-[360px] border-l border-border-default bg-bg-deep flex flex-col shrink-0">
        <div className="flex border-b border-border-default">
          {(["overview", "decisions", "actions", "risks"] as const).map((tab) => (
            <button key={tab} onClick={() => setSummaryTab(tab)}
              className={`flex-1 py-3 text-xs font-semibold transition-all capitalize ${summaryTab === tab ? "text-text-primary border-b-2 border-accent" : "text-text-tertiary hover:text-text-secondary"}`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {!summary ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <Sparkles size={24} className="text-text-tertiary" />
              <p className="text-sm text-text-secondary">Generate an AI summary</p>
              <button onClick={() => generate.mutate()} disabled={generate.isPending || !segments?.length}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-bg-deep font-semibold rounded-md text-xs hover:bg-accent-hover disabled:opacity-50 transition-all">
                {generate.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                {generate.isPending ? "Generating..." : "Generate Summary"}
              </button>
            </div>
          ) : (
            <SummaryContent tab={summaryTab} summary={summary} />
          )}
        </div>
      </div>
    </div>
  );
}

function SpeakerPill({ speaker, index, onRename }: { speaker: string; index: number; onRename: (n: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(speaker);
  if (editing) return (
    <input value={name} onChange={(e) => setName(e.target.value)}
      onBlur={() => { setEditing(false); if (name !== speaker) onRename(name); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="bg-bg-base border border-border-focus rounded-full px-2.5 py-0.5 font-ui font-semibold text-xs text-text-primary w-32 outline-none mb-1"
      autoFocus />
  );
  return (
    <button onClick={() => setEditing(true)} className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-ui font-semibold text-xs cursor-pointer hover:ring-1 hover:ring-accent/30 mb-1 ${SPEAKER_COLORS[index % 4]}`}
      title="Click to rename">{speaker}</button>
  );
}

function EditableText({ text, onSave }: { text: string; onSave: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);
  if (editing) return (
    <textarea value={value} onChange={(e) => setValue(e.target.value)}
      onBlur={() => { setEditing(false); if (value !== text) onSave(value); }}
      onKeyDown={(e) => { if (e.key === "Escape") { setValue(text); setEditing(false); } }}
      className="w-full bg-transparent text-base text-text-primary font-transcript resize-none border border-border-focus rounded p-1 outline-none"
      autoFocus rows={2} />
  );
  return <p className="text-base text-text-primary font-transcript leading-relaxed" onDoubleClick={() => setEditing(true)}>{text}</p>;
}

function SummaryContent({ tab, summary }: { tab: string; summary: AISummary }) {
  if (tab === "overview") return <p className="text-sm text-text-secondary leading-relaxed">{summary.overview}</p>;
  if (tab === "decisions") return <ul className="space-y-2">{summary.keyDecisions.map((d: string, i: number) => <li key={i} className="text-sm text-text-secondary flex gap-2"><span className="text-accent shrink-0">•</span> {d}</li>)}</ul>;
  if (tab === "actions") return <ul className="space-y-2">{summary.actionItems.map((a: string, i: number) => <li key={i} className="text-sm text-text-secondary flex items-start gap-2"><input type="checkbox" className="mt-0.5 accent-accent" readOnly /><span>{a}</span></li>)}</ul>;
  if (tab === "risks") return (
    <div className="space-y-2">{summary.risks.map((r: RiskItem, i: number) => (
      <div key={i} className="p-3 bg-bg-base rounded-lg border border-border-default">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.severity === "high" ? "bg-error-muted text-error" : r.severity === "medium" ? "bg-warning-muted text-warning" : "bg-info-muted text-info"}`}>{r.severity}</span>
        </div>
        <p className="text-sm text-text-secondary">{r.description}</p>
      </div>
    ))}</div>
  );
  return null;
}
