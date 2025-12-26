# GapScope - YouTube Keyword Gap Finder

GapScope helps YouTubers spot keyword opportunities where demand is high and the
current YouTube results are weak or aging.

## Features

- KeywordTool.io YouTube keyword ideas with search volume
- YouTube Data API v3 analysis of top results
- Gap scoring (0-100) with coverage, freshness, and mismatch signals
- In-memory caching and rate limiting for API routes
- Clean, minimal UI built entirely with shadcn/ui

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
```

Run the app locally:

```bash
pnpm dev
```

Run the local smoke test (hits KeywordTool + YouTube):

```bash
pnpm smoke
```

## API routes

- `POST /api/keywords` - `{ seed, limit }` -> `[{ keyword, volume }]`
- `POST /api/youtube` - `{ keyword, maxVideos }` -> normalized videos list
- `POST /api/score` - `{ seed, limitKeywords, maxVideos }` -> ranked results
- `GET /api/health` - configuration status

Example requests:

```bash
curl -X POST http://localhost:3000/api/keywords \
  -H "Content-Type: application/json" \
  -d '{"seed":"how to edit videos","limit":5}'
```

```bash
curl -X POST http://localhost:3000/api/score \
  -H "Content-Type: application/json" \
  -d '{"seed":"how to edit videos","limitKeywords":5,"maxVideos":5}'
```

## Scoring model

1) Tokenization
- Lowercase, strip punctuation, collapse whitespace
- Remove a curated stopword list

2) Fit score per video (0..1)

```
fit = clamp(0.6*titleMatch + 0.3*descMatch + 0.1*tagMatch, 0, 1)
```

3) Keyword metrics
- `avgTopFit`: average fit of top 5 results
- `weakFitRate`: percent of top 10 results with fit < 0.5
- `bestGoodFitAgeDays`: min ageDays where fit >= 0.7 (fallback: median ageDays)
- `mismatchRaw`: sum over top 10 of log-normalized views * (1 - fit)

4) Opportunity score (0..100)

```
score01 =
  0.45*volumeScore +
  0.25*(1 - avgTopFit) +
  0.20*(freshnessBonus/2) +
  0.10*mismatchBonus
score = round(score01 * 100)
```

## Testing

```bash
pnpm test
```

## Deploy on Vercel

1. Push the repo to GitHub.
2. Import into Vercel.
3. Add the environment variables in Vercel project settings.
4. Deploy.

## Notes

- Rate limit: 30 requests / 5 minutes per IP for `/api/*` routes.
- Cache TTL: keywords (24h) and YouTube results (12h) in memory.
