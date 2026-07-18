/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MeetingListPage } from "./meeting-list";

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <MeetingListPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe("MeetingListPage", () => {
  it("renders the page header", () => {
    renderPage();
    const headings = screen.getAllByText("Meetings");
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it("shows a recording button (header or empty state)", () => {
    renderPage();
    const buttons = screen.getAllByText(/Recording/);
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("has search input", () => {
    renderPage();
    const inputs = screen.getAllByPlaceholderText("Search meetings...");
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });
});
