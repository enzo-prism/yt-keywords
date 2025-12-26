import dotenv from "dotenv";

import { getYouTubeKeywordIdeasWithVolume } from "../src/lib/keywordtool.ts";
import { scoreOpportunity } from "../src/lib/scoring/opportunity.ts";
import { getYouTubeVideos } from "../src/lib/youtube.ts";

dotenv.config({ path: ".env.local" });

const seed = "how to edit videos";
const limitKeywords = 5;
const maxVideos = 5;

function formatIdea(idea) {
  return `${idea.keyword} (${idea.volume})`;
}

async function run() {
  const ideas = await getYouTubeKeywordIdeasWithVolume({
    seed,
    limit: limitKeywords,
  });

  if (!ideas.length) {
    throw new Error("No keyword ideas returned.");
  }

  console.log(`KeywordTool ideas: ${ideas.length}`);
  ideas.slice(0, 3).forEach((idea, index) => {
    console.log(`${index + 1}. ${formatIdea(idea)}`);
  });

  const topKeyword = ideas[0]?.keyword;
  if (!topKeyword) {
    throw new Error("Missing top keyword.");
  }

  const videos = await getYouTubeVideos(topKeyword, maxVideos);
  if (!videos.length) {
    throw new Error("No YouTube videos returned.");
  }

  const firstVideo = videos[0];
  console.log(`YouTube videos: ${videos.length}`);
  console.log(
    `Top video: ${firstVideo.title} | ${firstVideo.publishedAt} | ${firstVideo.viewCount} views`
  );

  const volumes = ideas.map((idea) => idea.volume);
  const minVolume = Math.min(...volumes);
  const maxVolume = Math.max(...volumes);
  const opportunity = scoreOpportunity({
    keyword: topKeyword,
    volume: ideas[0].volume,
    minVolume,
    maxVolume,
    videos,
  });

  console.log(`Opportunity score: ${opportunity.score}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Smoke test failed: ${message}`);
  process.exitCode = 1;
});
