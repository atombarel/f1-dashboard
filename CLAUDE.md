# CLAUDE.md

F1 RaceView: F1 analysis site, one Cloudflare Worker (Hono API under `/api`, SPA as static assets). See README.md for the architecture.

## Commands
- `npm run dev` — Vite + Cloudflare plugin, runs the Worker, D1, R2, Durable Object and Workflows locally on :5173
- `npm run db:migrate:local` — apply D1 migrations locally (needed once)
- `npm test` — vitest, pure normalisation/telemetry tests on real fixtures (test/fixtures/singapore-2026)
- `npm run typecheck` — `tsc -b` (app + worker projects); run `npm run cf-typegen` after editing wrangler.jsonc
- Local data: `curl -X POST -H 'Authorization: Bearer dev-admin-token' localhost:5173/api/admin/sync/2026`, then open any finished session (first visit triggers ingestion). Add `?nocache` to bypass the edge cache when curling.

## Layout
- `shared/` — API contract (`types.ts`), session helpers, telemetry codec. Imported by both sides; worker uses relative imports.
- `worker/upstream/` — `gate.ts` (Durable Object rate limiter, every upstream call goes through it) and typed clients.
- `worker/ingest/` — `bundle.ts` / `telemetry.ts` are pure transforms (test them); `workflow.ts` orchestrates; `scheduler.ts` is the cron logic.
- `worker/lib/` — D1 queries (`db.ts`), R2 helpers (`store.ts`), HTTP/caching (`http.ts`).
- `src/` — React 19 + TanStack Router/Query + Tailwind v4. Charts are hand-written SVG/canvas (`src/charts/core.tsx`), no chart library.

## Rules
- Never call OpenF1/Jolpica from the browser or from a request path without the gate.
- Anything stored under a version (`bundles/`, `tel/`, `replay/`) is immutable: change the content → new hash/version.
- Bump `schema` in the bundle type and re-ingest when changing the bundle shape.
- UI copy is bilingual (French source, English translation): every user-visible string goes through `t()` from `src/i18n`, one `{ fr, en }` messages file per area in `src/i18n/messages/` (typecheck fails if `en` misses a key). Never call `t()` at module top level.
