type FetchOptions = {
  timeoutMs?: number;
  retry?: number;
};

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  options?: FetchOptions
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 12000;
  const retry = options?.retry ?? 1;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retry; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Request failed (${response.status}): ${text.slice(0, 300)}`
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Request failed");

      if (attempt === retry) {
        throw lastError;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("Request failed");
}
