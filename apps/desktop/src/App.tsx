import { Routes, Route } from "react-router-dom";
import { AppShell } from "./components/layout/app-shell";
import { MeetingListPage } from "./routes/meeting-list";
import { SettingsPage } from "./routes/settings";
import { MeetingDetailPage } from "./routes/meeting-detail";
import { RecordingPage } from "./routes/recording";
import { ErrorBoundary } from "./components/error-boundary";

// ─── App ──────────────────────────────────────────────────
function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<MeetingListPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/meeting/:id" element={<MeetingDetailPage />} />
          <Route path="/recording/:id" element={<RecordingPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
