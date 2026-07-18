import { describe, it, expect } from "vitest";
import { extractJson } from "./json";

describe("extractJson", () => {
  it("parses valid JSON object", () => {
    const result = extractJson<{ name: string }>(`{"name": "test"}`);
    expect(result).toEqual({ name: "test" });
  });

  it("strips ```json fences and parses", () => {
    const result = extractJson<{ x: number }>("```json\n{\"x\": 42}\n```");
    expect(result).toEqual({ x: 42 });
  });

  it("strips bare ``` fences without language tag", () => {
    const result = extractJson<{ ok: boolean }>("```\n{\"ok\": true}\n```");
    expect(result).toEqual({ ok: true });
  });

  it("returns fallback for empty string", () => {
    const result = extractJson("");
    expect(result).toEqual({});
  });

  it("returns fallback for plain text", () => {
    const result = extractJson("hello world");
    expect(result).toEqual({});
  });

  it("extracts JSON object embedded in text via regex", () => {
    const result = extractJson<{ key: string }>("Some text {\"key\": \"value\"} more text");
    expect(result).toEqual({ key: "value" });
  });

  it("returns custom fallback on parse failure", () => {
    const fallback = () => ({ error: true, raw: "bad" });
    const result = extractJson("not json", fallback);
    expect(result).toEqual({ error: true, raw: "bad" });
  });

  it("preserves complex nested JSON", () => {
    const input = `{"a": 1, "b": [2, 3], "c": {"d": "e"}}`;
    const result = extractJson(input);
    expect(result).toEqual({ a: 1, b: [2, 3], c: { d: "e" } });
  });

  it("passes number type through correctly", () => {
    const result = extractJson<number>("42");
    expect(result).toBe(42);
  });

  it("passes array type through correctly", () => {
    const result = extractJson<string[]>(`["a", "b", "c"]`);
    expect(result).toEqual(["a", "b", "c"]);
  });
});
