import { describe, expect, it } from "vitest";

import { scoreKeywordOpportunity } from "@/lib/scoring/keywordExplorer";
import type { ChannelProfile, YouTubeVideo } from "@/lib/types";

const baseVideo: Omit<YouTubeVideo, "id" | "title" | "publishedAt"> = {
  description: "learn to edit videos quickly",
  tags: ["edit videos", "video editing"],
  viewCount: 50_000,
  likeCount: 1_200,
  commentCount: 120,
  url: "https://www.youtube.com/watch?v=demo",
  channelId: "UCdemo",
  channelTitle: "Demo Channel",
  channelSubscriberCount: 25_000,
  thumbnailUrl: "https://i.ytimg.com/vi/demo/hqdefault.jpg",
  durationSeconds: 420,
};

describe("scoreKeywordOpportunity", () => {
  it("returns scores in the expected range", () => {
    const videos: YouTubeVideo[] = [
      {
        ...baseVideo,
        id: "a",
        title: "How to edit videos",
        publishedAt: "2023-01-10T00:00:00Z",
      },
      {
        ...baseVideo,
        id: "b",
        title: "Edit videos fast",
        publishedAt: "2022-12-01T00:00:00Z",
        viewCount: 90_000,
      },
      {
        ...baseVideo,
        id: "c",
        title: "Random topic",
        publishedAt: "2021-10-01T00:00:00Z",
        viewCount: 20_000,
      },
    ];

    const result = scoreKeywordOpportunity({
      keyword: "how to edit videos",
      volume: 10_000,
      monthlyVolumes: [4000, 4200, 4500, 4800, 5000, 5300, 5500, 5800, 6000, 6500, 6800, 7000],
      videos,
      totalResults: 1_000_000,
      minVolume: 1000,
      maxVolume: 20_000,
      relatedKeywords: ["how to edit videos", "edit videos fast"],
      now: new Date("2024-01-01T00:00:00Z"),
    });

    expect(result.scores.opportunityScore).toBeGreaterThanOrEqual(0);
    expect(result.scores.opportunityScore).toBeLessThanOrEqual(100);
    expect(result.scores.searchVolumeScore).toBeGreaterThanOrEqual(0);
    expect(result.scores.searchVolumeScore).toBeLessThanOrEqual(100);
    expect(result.scores.trendScore).not.toBeNull();
  });

  it("applies weighted scoring when channel profile is present", () => {
    const videos: YouTubeVideo[] = [
      {
        ...baseVideo,
        id: "a",
        title: "How to edit videos",
        publishedAt: "2023-01-10T00:00:00Z",
        channelSubscriberCount: 5_000,
        viewCount: 10_000,
      },
      {
        ...baseVideo,
        id: "b",
        title: "Edit videos fast",
        publishedAt: "2023-02-10T00:00:00Z",
        channelSubscriberCount: 3_000,
        viewCount: 8_000,
      },
    ];

    const channelProfile: ChannelProfile = {
      channelId: "UCpower",
      subscriberCount: 500_000,
      videoCount: 120,
      viewCount: 50_000_000,
      avgViews: 120_000,
      avgViewsPerDay: 8_000,
    };

    const result = scoreKeywordOpportunity({
      keyword: "how to edit videos",
      volume: 10_000,
      videos,
      totalResults: 250_000,
      minVolume: 1000,
      maxVolume: 20_000,
      channelProfile,
      now: new Date("2024-01-01T00:00:00Z"),
    });

    expect(result.scores.weightedOpportunityScore).not.toBeNull();
    expect(result.scores.weightedOpportunityScore).toBeGreaterThan(
      result.scores.opportunityScore
    );
  });
});
