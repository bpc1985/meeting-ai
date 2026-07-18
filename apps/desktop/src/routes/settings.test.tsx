/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SettingsPage } from "./settings";

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe("SettingsPage", () => {
  it("renders page title", () => {
    renderPage();
    const headings = screen.getAllByText("Settings");
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it("shows OpenAI API key input", () => {
    renderPage();
    const inputs = screen.getAllByPlaceholderText("sk-...");
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it("shows Gemini API key input", () => {
    renderPage();
    const inputs = screen.getAllByPlaceholderText("AIza...");
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it("shows data privacy notice", () => {
    renderPage();
    const headings = screen.getAllByText("Data & Privacy");
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });
});
