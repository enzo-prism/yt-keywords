# HotContent (hotcontent.app) - Agent Notes

This file is for Codex CLI and future contributors. It documents how the app
is structured, how data flows, and where to make changes without breaking core
behavior.

## Quick overview

- Framework: Next.js App Router (Node runtime for API routes).
- UI: Tailwind + shadcn/ui only. Keep components accessible and consistent
  with the HotContent brand theme.
- Core feature: "Discover" tab that finds hot YouTube opportunities based on
  KeywordTool suggestions + YouTube SERP analysis + scoring.

## Primary flow (Discover -> /api/score)

1. UI posts to `POST /api/score` from `src/components/explore-tab.tsx`.
2. `src/app/api/score/route.ts`:
   - Fetches KeywordTool suggestions + volume via
     `src/lib/keywordtool.ts`.
   - Filters noise, include/exclude, and optionally clusters keywords via
     `src/lib/keywords/normalize.ts` and `src/lib/keywords/cluster.ts`.
   - Fetches SERPs with `getYouTubeSerpsBatch` from `src/lib/youtube.ts`.
   - Scores each keyword using `src/lib/scoring/keywordExplorer.ts`
     (do not change math unless explicitly requested).
3. Returns ranked results to the UI.

## Key files (where to look first)

- UI and layout
  - `src/app/page.tsx`: page shell and layout.
  - `src/components/explore-tab.tsx`: form, results table, drawer content,
    SEO Studio details.
- KeywordTool
  - `src/lib/keywordtool.ts`: suggestions + volume calls, caching, parsing.
- YouTube
  - `src/lib/youtube.ts`: search/vide/channels, batching, caching, channel
    metrics via uploads playlist.
  - `src/lib/youtube-request.ts`: global request limiter, in-flight dedupe,
    retry/backoff, quota/rate-limit classification.
- Scoring (do not change formulas unless asked)
  - `src/lib/scoring/keywordExplorer.ts`
- Caching
  - `src/lib/cache/*` and `src/lib/cache/persistent.ts` (optional Vercel KV)
- Errors
  - `src/lib/api-errors.ts`: external API error mapping for UI messages.
- Rate limit middleware
  - `middleware.ts`

## Environment variables (server-side only)

- Required: `KEYWORDTOOL_API_KEY`, `YOUTUBE_API_KEY`
- Optional: `APP_URL` (defaults to http://localhost:3000)
- Optional: `KEYWORDTOOL_TRENDS_ENABLED=false`
- Optional (KV): `KV_REST_API_URL`, `KV_REST_API_TOKEN`,
  `KV_REST_API_READ_ONLY_TOKEN`

Never log or return secret values.

## Caching and rate limits

- KeywordTool suggestions/volumes cached for 24h (memory + optional KV).
- YouTube SERPs cached for 6h. Channel stats cached for 12h.
- Rate-limit middleware applies to `/api/*`.
- Stale SERP fallback is used only when YouTube rate-limit/quota errors occur.

## Analytics

- Google Analytics + Hotjar scripts live in `src/app/layout.tsx`.

## Testing and smoke checks

- Unit tests: `pnpm test`
- Smoke test: `pnpm smoke` (requires `pnpm dev` running locally)
- The smoke test hits `/api/health` and `/api/score`.

## Design constraints

- Use shadcn/ui components for UI primitives. No new UI kits.
- Maintain accessibility and keyboard navigation.
- Keep HotContent brand styling consistent with warm "heat" accents.

## Behavior constraints

- Do not change scoring formulas in `src/lib/scoring/keywordExplorer.ts`
  unless explicitly requested.
- Do not change API response shapes unless required.
- Do not send secrets to the client.
