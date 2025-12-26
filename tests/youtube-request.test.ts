import { beforeEach, expect, it, vi } from "vitest";

import { youtubeFetchJson } from "@/lib/youtube-request";

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
}

beforeEach(() => {
  process.env.KEYWORDTOOL_API_KEY = "test";
  process.env.YOUTUBE_API_KEY = "test";
  vi.restoreAllMocks();
});

it("does not retry on quotaExceeded errors", async () => {
  const fetchMock = vi.fn(async () =>
    jsonResponse(
      {
        error: {
          code: 403,
          message: "Quota exceeded.",
          errors: [{ reason: "quotaExceeded", message: "Quota exceeded." }],
        },
      },
      403
    )
  );

  vi.stubGlobal("fetch", fetchMock);

  await expect(
    youtubeFetchJson("https://www.googleapis.com/youtube/v3/search?part=snippet")
  ).rejects.toThrow();

  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("coalesces in-flight identical requests", async () => {
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        setTimeout(
          () =>
            resolve(
              jsonResponse({
                items: [],
              })
            ),
          10
        );
      })
  );

  vi.stubGlobal("fetch", fetchMock);

  const url = "https://www.googleapis.com/youtube/v3/search?part=snippet";
  const [first, second] = await Promise.all([
    youtubeFetchJson(url),
    youtubeFetchJson(url),
  ]);

  expect(first).toEqual({ items: [] });
  expect(second).toEqual({ items: [] });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
