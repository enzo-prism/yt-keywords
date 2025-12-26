import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const seed = "how to edit videos";
const maxKeywords = 5;
const videosPerKeyword = 5;
const baseUrl = process.env.APP_URL || "http://localhost:3000";

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 200)}`);
  }
  return response.json();
}

async function run() {
  let health;
  try {
    health = await fetchJson(`${baseUrl}/api/health`);
  } catch {
    throw new Error(
      `Failed to reach ${baseUrl}. Start the dev server before running smoke.`
    );
  }

  if (!health.keywordtoolConfigured || !health.youtubeConfigured) {
    throw new Error(`Missing env keys: ${(health.missingKeys || []).join(", ")}`);
  }

  const payload = await fetchJson(`${baseUrl}/api/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      seed,
      maxKeywords,
      videosPerKeyword,
      minVolume: 0,
      hideNoise: true,
      cluster: true,
    }),
  });

  const results = payload.results ?? [];
  if (!results.length) {
    throw new Error("No scored results returned.");
  }

  const first = results[0];
  if (!first?.scores || typeof first.scores.searchVolumeScore !== "number") {
    throw new Error("Missing score breakdown in response.");
  }

  console.log(`Health: ok (kv=${health.kvConfigured ? "on" : "off"})`);
  console.log(`Results: ${results.length}`);
  results.slice(0, 3).forEach((result, index) => {
    console.log(
      `${index + 1}. ${result.keyword} | ${result.volume} | ${result.scores.opportunityScore}`
    );
  });
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Smoke test failed: ${message}`);
  process.exitCode = 1;
});
