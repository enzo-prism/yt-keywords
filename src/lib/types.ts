export type KeywordIdea = {
  keyword: string;
  volume: number;
};

export type YouTubeVideo = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  publishedAt: string;
  viewCount: number;
  url: string;
};

export type ScoredVideo = YouTubeVideo & {
  fit: number;
  fitLabel: "Perfect" | "Close" | "Off";
  ageDays: number;
};

export type OpportunityResult = {
  keyword: string;
  volume: number;
  score: number;
  volumeScore: number;
  avgTopFit: number;
  weakFitRate: number;
  bestGoodFitAgeDays: number;
  noStrongMatch: boolean;
  freshnessLabel: "Fresh" | "Aging" | "Stale";
  coverageLabel: "Strong" | "Medium" | "Weak";
  bullets: string[];
  topVideos: ScoredVideo[];
};
