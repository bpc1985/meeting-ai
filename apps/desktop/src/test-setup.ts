import "@testing-library/jest-dom/vitest";

// Mock Tauri invoke — component tests shouldn't call real commands
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
    // Default mock responses per command
    if (cmd === "list_meetings") return [];
    if (cmd === "create_meeting") return { id: "new-meeting", title: args?.title ?? "Test", status: "draft" };
    if (cmd === "import_meeting") return { id: "imported-meeting", title: args?.title ?? "Imported", audio_path: "/tmp/imported.wav", duration_secs: 0, status: "draft", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" };
    if (cmd === "get_meeting") return { id: "test-meeting", title: "Test Meeting", audio_path: "/tmp/test.wav", duration_secs: 300, status: "transcribed", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" };
    if (cmd === "get_segments") return [{ id: "s1", meeting_id: "test", speaker_label: "Alice", text: "Hello", start_secs: 0, end_secs: 5, sequence: 0 }];
    if (cmd === "get_summary") return null;
    if (cmd === "get_setting") return null;
    if (cmd === "search_meetings") return [];
    if (cmd === "delete_meeting") return null;
    if (cmd === "set_setting") return null;
    if (cmd === "update_meeting") return null;
    if (cmd === "update_segment") return null;
    if (cmd === "delete_segment") return null;
    if (cmd === "start_recording") return "/tmp/test.wav";
    if (cmd === "stop_recording") return { file_path: "/tmp/test.wav", duration_secs: 300 };
    return null;
  }),
}));

// Mock Tauri event listener
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

// Mock Tauri dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(async () => "/tmp/export.txt"),
  open: vi.fn(async () => null),
}));

// Mock Tauri FS plugin (already handled by pipeline tests separately)
vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(async () => new Uint8Array()),
  writeFile: vi.fn(async () => {}),
  stat: vi.fn(async () => ({ size: 1024 })),
}));
