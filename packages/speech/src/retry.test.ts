import { describe, it, expect, vi, afterEach } from "vitest";
import { withRetry, HttpError } from "./retry";

describe("HttpError", () => {
  it("has name and status", () => {
    const err = new HttpError("bad", 500);
    expect(err.name).toBe("HttpError");
    expect(err.status).toBe(500);
    expect(err.message).toBe("bad");
  });

  it("is instanceof Error", () => {
    const err = new HttpError("oh no", 429);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("withRetry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries once on 429, returns on second try", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new HttpError("rate limited", 429))
      .mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries up to 2 times on 5xx", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new HttpError("server error", 500))
      .mockRejectedValueOnce(new HttpError("gateway", 502))
      .mockResolvedValue("finally");
    const result = await withRetry(fn);
    expect(result).toBe("finally");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("retries on TypeError (network failure)", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValue("recovered");
    const result = await withRetry(fn);
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on 4xx (non-429)", async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError("bad request", 400));
    await expect(withRetry(fn)).rejects.toThrow("bad request");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("respects custom maxRetries", async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError("boom", 500));
    await expect(withRetry(fn, 1)).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it("propagates error after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError("down", 503));
    await expect(withRetry(fn, 2)).rejects.toThrow("down");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("exponential backoff delays increase", async () => {
    const timestamps: number[] = [];
    const fn = vi.fn().mockImplementation(() => {
      timestamps.push(Date.now());
      throw new HttpError("slow", 500);
    });

    await expect(withRetry(fn, 2)).rejects.toThrow("slow");
    expect(fn).toHaveBeenCalledTimes(3);
    // Delays: 1s, 2s — verify calls are spaced apart
    expect(timestamps.length).toBe(3);
    const gap1 = timestamps[1] - timestamps[0];
    const gap2 = timestamps[2] - timestamps[1];
    // With exponential backoff, second gap should be approximately double
    // Allow some tolerance for setTimeout imprecision
    expect(gap1).toBeGreaterThanOrEqual(900);
    expect(gap2).toBeGreaterThanOrEqual(gap1 * 0.9);
  }, 10000); // 10s timeout for real timers
});
