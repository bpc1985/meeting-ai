export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      if (i === maxRetries) throw err;
      const status = (err as { status?: number }).status;
      if (status === 429 || (status != null && status >= 500)) {
        const delay = Math.min(1000 * Math.pow(2, i), 30000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      // Also retry on network/TypeError (fetch failed)
      if (err instanceof TypeError) {
        const delay = Math.min(1000 * Math.pow(2, i), 10000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}
