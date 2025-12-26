export type KeywordIdea = {
  keyword: string;
  volume: number;
  monthlyVolumes?: number[] | null;
};

export type YouTubeVideo = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  url: string;
  channelId: string;
  channelTitle: string;
  channelSubscriberCount: number;
  thumbnailUrl: string;
  durationSeconds: number;
};

export type YouTubeSerp = {
  keyword: string;
  totalResults: number | null;
  videos: YouTubeVideo[];
};

export type YouTubeChannelStats = {
  channelId: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
};

export type ScoredVideo = YouTubeVideo & {
  fit: number;
  fitLabel: "Strong" | "Medium" | "Weak";
  ageDays: number;
  viewsPerDay: number;
  exactTitleMatch: boolean;
  earlyTitleMatch: boolean;
  exactDescMatch: boolean;
  earlyDescMatch: boolean;
  exactTagMatch: boolean;
};

export type SerpMetrics = {
  totalResults: number | null;
  medianChannelSubs: number;
  medianViewsPerDay: number;
  medianVideoAgeDays: number;
  dominanceFactor: number;
};

export type ScoreBreakdown = {
  searchVolumeScore: number;
  competitionScore: number;
  optimizationStrengthScore: number;
  freshnessScore: number;
  trendScore: number | null;
  difficulty: number;
  opportunityScore: number;
  weightedOpportunityScore: number | null;
};

export type ScoreExplanations = {
  searchVolume: string[];
  competition: string[];
  optimization: string[];
  freshness: string[];
  trend: string[] | null;
  serpWeakness: string[];
};

export type OpportunityResult = {
  keyword: string;
  volume: number;
  monthlyVolumes?: number[] | null;
  scores: ScoreBreakdown;
  labels: {
    difficulty: "Easy" | "Medium" | "Hard";
    coverage: "Strong" | "Medium" | "Weak";
    freshness: "Fresh" | "Aging" | "Stale";
  };
  avgTopFit: number;
  weakFitRate: number;
  bestAnswerAgeDays: number;
  noStrongMatch: boolean;
  bullets: string[];
  explanations: ScoreExplanations;
  topVideos: ScoredVideo[];
  serpMetrics: SerpMetrics;
  relatedKeywords: string[];
  clusterId?: string;
  clusterLabel?: string;
  clusterSize?: number;
};

export type ChannelProfile = {
  channelId: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  avgViews: number;
  avgViewsPerDay: number;
};

export type TopicPlanItem = {
  id: string;
  keyword: string;
  clusterLabel?: string;
  volume: number;
  scores: ScoreBreakdown;
  recommendedTitle?: string;
  recommendedTags?: string[];
  notes: string;
  status: "Idea" | "Script" | "Record" | "Edit" | "Publish" | "Done";
  createdAt: string;
  updatedAt: string;
};
