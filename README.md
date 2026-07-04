# Helena Labs

Incident memory for on-call teams. Ingests from Slack, Grafana, Sentry, and any generic webhook. Retrieves past resolutions when a new alert fires. Auto drafts runbooks from resolved incident threads.

## Stack

- Next.js 15 (app router) on Vercel
- Supabase Postgres with full text search + tsvector triggers
- BTL Runtime (gpt-4o-mini for vision, DeepSeek for text)
- Slack app for the primary surface
- Grafana Cloud webhook, Sentry webhook, generic JSON webhook

## Monorepo layout

```
apps/web            Next.js dashboard + all API routes
packages/btl        BTL client wrapper, prompts, four LLM roles
packages/db         Supabase server client and typed queries
packages/shared     Types, zod schemas, dedup hash
```

## Local dev

```
pnpm install
cp .env.example .env.local
pnpm dev
```

Then open http://localhost:3000

## Deploy

Push to main. Vercel picks up `apps/web` as the project root. Set all env vars from `.env.example` in Vercel project settings.

## Data flows

1. Ingest: Slack message, Grafana alert, Sentry event, or generic webhook → normalize → dedup → Postgres
2. Query: `/askoncall <alert>` in Slack → FTS top 30 → DeepSeek rerank top 5 → DeepSeek synth → Slack reply
3. Nightly cron: find resolved threads → DeepSeek draft → runbook_drafts table → reviewer approves in dashboard
