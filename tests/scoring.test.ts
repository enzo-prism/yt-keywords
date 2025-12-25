import { describe, expect, it } from "vitest";

import { fitScore } from "@/lib/scoring/fit";
import { logNorm, scoreOpportunity } from "@/lib/scoring/opportunity";
import { tokenize } from "@/lib/scoring/tokenize";
import type { YouTubeVideo } from "@/lib/types";

describe("tokenize", () => {
  it("removes punctuation and stopwords", () => {
    expect(tokenize("How to grow on YouTube!")).toEqual(["grow", "youtube"]);
  });
});

describe("fitScore", () => {
  it("combines title, description, and tags", () => {
    const keywordTokens = tokenize("grow youtube");
    const titleTokens = tokenize("grow youtube");
    const descTokens = tokenize("grow youtube");
    const tagTokens = tokenize("grow youtube");

    expect(fitScore(keywordTokens, titleTokens, descTokens, tagTokens)).toBeCloseTo(
      1,
      6
    );
  });
});

describe("scoring", () => {
  it("handles no strong matches with median fallback", () => {
    const now = new Date("2024-02-01T00:00:00Z");
    const videos: YouTubeVideo[] = [
      {
        id: "a",
        title: "random topic",
        description: "",
        tags: [],
        publishedAt: "2024-01-22T00:00:00Z",
        viewCount: 100,
        url: "https://www.youtube.com/watch?v=a",
      },
      {
        id: "b",
        title: "another unrelated",
        description: "",
        tags: [],
        publishedAt: "2024-01-02T00:00:00Z",
        viewCount: 250,
        url: "https://www.youtube.com/watch?v=b",
      },
    ];

    const result = scoreOpportunity({
      keyword: "target phrase",
      volume: 1000,
      minVolume: 1000,
      maxVolume: 1000,
      videos,
      now,
    });

    expect(result.noStrongMatch).toBe(true);
    expect(result.bestGoodFitAgeDays).toBe(20);
    expect(result.weakFitRate).toBeCloseTo(0.2, 3);
  });

  it("logNorm guards when min equals max", () => {
    expect(logNorm(100, 100, 100)).toBe(0.5);
  });
});
