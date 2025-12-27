# HotContent - Publish what's about to blow up

HotContent helps YouTubers spot rising ideas where demand is high and the
current YouTube results are weak or outdated.

## Features

- KeywordTool.io ideas with volume + optional trend momentum
- YouTube SERP analysis with competition + optimization strength signals
- Hot Score (0-100) with breakdown (Volume, Competition, Optimization, Freshness)
- Weighted scoring (optional) using your channel profile
- SEO Studio recommendations for titles, descriptions, and tags
- In-memory cache + optional Vercel KV cache + API rate limiting

## Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Node runtime (Vercel-compatible)

## Setup

```bash
pnpm install
```

Create a `.env.local` file with the following environment variables:

```bash
KEYWORDTOOL_API_KEY=your_key_here
YOUTUBE_API_KEY=your_key_here
# Optional (defaults to http://localhost:3000)
APP_URL=http://localhost:3000
# Optional
KEYWORDTOOL_TRENDS_ENABLED=false
# Optional (Vercel KV)
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=
```

Run the app locally:

```bash
pnpm dev
```

Run the local smoke test (hits KeywordTool + YouTube):

```bash
# Run in another terminal first
# pnpm dev
pnpm smoke
```

If your dev server runs on a different port, set `APP_URL` accordingly.

## API routes

- `POST /api/keywords` - `{ seed, limit, country?, language?, suggestionMode? }` -> `[{ keyword, volume, monthlyVolumes? }]`
- `POST /api/youtube` - `{ keyword, maxVideos }` -> SERP payload (videos + totalResults)
- `POST /api/score` - `{ seed, maxKeywords, videosPerKeyword, country?, language?, suggestionMode?, minVolume?, include?, exclude?, hideNoise?, cluster?, channel?, showWeighted? }` -> ranked results
- `GET /api/constants` - supported countries/languages + suggestion modes
- `GET /api/health` - configuration + KV status

Example requests:

```bash
curl -X POST http://localhost:3000/api/keywords \
  -H "Content-Type: application/json" \
  -d '{"seed":"how to edit videos","limit":5,"country":"US","language":"en","suggestionMode":"suggestions"}'
```

```bash
curl -X POST http://localhost:3000/api/score \
  -H "Content-Type: application/json" \
  -d '{"seed":"how to edit videos","maxKeywords":5,"videosPerKeyword":5,"minVolume":0,"hideNoise":true,"cluster":true}'
```

## Scoring model

- Search volume score (log-normalized)
- Competition score (ease based on SERP strength + channel dominance)
- Optimization strength (exact keyword usage in titles/desc/tags)
- Freshness score (age of best matching results)
- Trend momentum (if monthly data exists)
- Weighted score (optional) scaled to your channel profile

## Testing

```bash
pnpm test
```

## Caching

- In-memory cache for KeywordTool suggestions/volume and YouTube SERPs.
- Optional Vercel KV cache if `KV_REST_API_URL` + `KV_REST_API_TOKEN` are configured.

## Deploy on Vercel

1. Push the repo to GitHub.
2. Import into Vercel.
3. Add the environment variables in Vercel project settings.
4. Deploy.

## Notes

- Rate limit: 30 requests / 5 minutes per IP for `/api/*` routes.
- Cache TTL: keywords (24h), YouTube SERPs (6h), channel stats (12h) in memory.

## Contributor notes

See `AGENTS.md` for implementation details, data flow, and guardrails.
