import { beforeEach, expect, it, vi } from "vitest";

import {
  youtubeChannelRecentCache,
  youtubeChannelStatsCache,
  youtubeChannelUploadsCache,
  youtubeSerpCache,
} from "@/lib/cache/index";
import { getChannelProfile, getYouTubeSerpsBatch } from "@/lib/youtube";

const API_BASE = "https://www.googleapis.com";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  process.env.KEYWORDTOOL_API_KEY = "test";
  process.env.YOUTUBE_API_KEY = "test";
  youtubeSerpCache.clear();
  youtubeChannelStatsCache.clear();
  youtubeChannelRecentCache.clear();
  youtubeChannelUploadsCache.clear();
  vi.restoreAllMocks();
});

it("batches video and channel fetches while preserving search order", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo) => {
    const url = new URL(String(input));
    if (url.origin === API_BASE && url.pathname.endsWith("/youtube/v3/search")) {
      const query = url.searchParams.get("q");
      if (query === "alpha") {
        return jsonResponse({
          items: [{ id: { videoId: "a2" } }, { id: { videoId: "a1" } }],
          pageInfo: { totalResults: 2 },
        });
      }
      return jsonResponse({
        items: [{ id: { videoId: "b1" } }, { id: { videoId: "b2" } }],
        pageInfo: { totalResults: 2 },
      });
    }
    if (url.origin === API_BASE && url.pathname.endsWith("/youtube/v3/videos")) {
      return jsonResponse({
        items: [
          {
            id: "b2",
            snippet: {
              title: "b2",
              description: "",
              publishedAt: "2024-01-01T00:00:00Z",
              channelId: "chan-b",
              channelTitle: "Chan B",
              thumbnails: { high: { url: "b2.jpg" } },
            },
            statistics: { viewCount: "10" },
            contentDetails: { duration: "PT10M" },
          },
          {
            id: "a1",
            snippet: {
              title: "a1",
              description: "",
              publishedAt: "2024-01-01T00:00:00Z",
              channelId: "chan-a",
              channelTitle: "Chan A",
              thumbnails: { high: { url: "a1.jpg" } },
            },
            statistics: { viewCount: "20" },
            contentDetails: { duration: "PT10M" },
          },
          {
            id: "a2",
            snippet: {
              title: "a2",
              description: "",
              publishedAt: "2024-01-01T00:00:00Z",
              channelId: "chan-a",
              channelTitle: "Chan A",
              thumbnails: { high: { url: "a2.jpg" } },
            },
            statistics: { viewCount: "30" },
            contentDetails: { duration: "PT10M" },
          },
          {
            id: "b1",
            snippet: {
              title: "b1",
              description: "",
              publishedAt: "2024-01-01T00:00:00Z",
              channelId: "chan-b",
              channelTitle: "Chan B",
              thumbnails: { high: { url: "b1.jpg" } },
            },
            statistics: { viewCount: "40" },
            contentDetails: { duration: "PT10M" },
          },
        ],
      });
    }
    if (url.origin === API_BASE && url.pathname.endsWith("/youtube/v3/channels")) {
      return jsonResponse({
        items: [
          { id: "chan-a", statistics: { subscriberCount: "100" } },
          { id: "chan-b", statistics: { subscriberCount: "200" } },
        ],
      });
    }
    throw new Error(`Unhandled URL: ${url.toString()}`);
  });

  vi.stubGlobal("fetch", fetchMock);

  const serps = await getYouTubeSerpsBatch(["alpha", "beta"], 2, {
    quotaUser: "test",
  });

  expect(fetchMock).toHaveBeenCalledTimes(4);
  expect(serps.get("alpha")?.videos.map((video) => video.id)).toEqual([
    "a2",
    "a1",
  ]);
  expect(serps.get("beta")?.videos.map((video) => video.id)).toEqual([
    "b1",
    "b2",
  ]);
});

it("builds channel metrics from uploads playlist videos", async () => {
  const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
  const uploadIds = Array.from({ length: 10 }, (_, index) => `v${index + 1}`);

  const fetchMock = vi.fn(async (input: RequestInfo) => {
    const url = new URL(String(input));
    if (url.origin === API_BASE && url.pathname.endsWith("/youtube/v3/channels")) {
      return jsonResponse({
        items: [
          {
            id: "chan-1",
            statistics: {
              subscriberCount: "500",
              videoCount: "100",
              viewCount: "10000",
            },
            contentDetails: {
              relatedPlaylists: { uploads: "upl-1" },
            },
          },
        ],
      });
    }
    if (url.origin === API_BASE && url.pathname.endsWith("/youtube/v3/playlistItems")) {
      return jsonResponse({
        items: uploadIds.map((id) => ({ contentDetails: { videoId: id } })),
      });
    }
    if (url.origin === API_BASE && url.pathname.endsWith("/youtube/v3/videos")) {
      return jsonResponse({
        items: uploadIds.map((id) => ({
          id,
          snippet: {
            title: id,
            description: "",
            publishedAt: tenDaysAgo,
            channelId: "chan-1",
            channelTitle: "Chan 1",
            thumbnails: { high: { url: `${id}.jpg` } },
          },
          statistics: { viewCount: "100" },
          contentDetails: { duration: "PT10M" },
        })),
      });
    }
    throw new Error(`Unhandled URL: ${url.toString()}`);
  });

  vi.stubGlobal("fetch", fetchMock);

  const profile = await getChannelProfile("chan-1", { quotaUser: "test" });
  expect(profile.avgViews).toBe(100);
  expect(Math.round(profile.avgViewsPerDay)).toBe(10);
});
