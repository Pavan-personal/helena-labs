# Helena Labs

Incident memory for on-call teams. Live at helenalabs.vercel.app

Every alert a team fires lands in a searchable memory. When the next one hits, the Copilot points at the resolutions the team already worked out, with citations.

## System

```mermaid
flowchart LR
  subgraph Sources
    S1[Slack channel]
    S2[Discord channel]
    S3[Grafana Contact Point]
    S4[Sentry Internal Integration]
    S5[GitHub App]
    S6[Generic JSON webhook]
  end

  subgraph Edge [Next.js on Vercel]
    W[Webhook handlers]
    A[Auth and sessions]
    D[Dashboard SSR]
    C[Copilot SSE stream]
  end

  subgraph Memory [Supabase Postgres]
    I[(incidents)]
    R[(runbooks)]
    T[(copilot_threads)]
    U[(copilot_turns)]
    WS[(workspaces)]
  end

  subgraph LLM [BTL Runtime]
    M1[deepseek v4 flash classifier]
    M2[deepseek v4 pro reasoning]
    M3[gpt 4o mini vision]
    M4[gemini 2.5 flash image vision]
  end

  S1 & S2 & S3 & S4 & S5 & S6 --> W
  W --> I
  W --> R
  A --> WS
  D -->|reads| I & R & WS
  C -->|streams to| Client[Browser]
  C -->|calls tools on| I
  C -->|reasons with| LLM
  M2 -.consensus.- M3 & M4
```

## Ingestion

```mermaid
flowchart TD
  IN[Vendor webhook] --> V{Verify signature}
  V -->|fail| X[401]
  V -->|ok| N[Normalize payload]
  N --> E[Extract title, body, severity, source]
  E --> H[Compute dedup hash on source + external_id + state]
  H --> DB{Row exists?}
  DB -->|yes| SKIP[Return 200 ok, ingested skipped]
  DB -->|no| INS[Insert into incidents]
  INS --> POST{Severity high or critical?}
  POST -->|yes and chat connected| CHAT[Post to Slack or Discord channel]
  POST -->|no| DONE[Return 200 ok]
  CHAT --> DONE
```

## Copilot query loop

```mermaid
sequenceDiagram
  participant U as User
  participant API as SSE endpoint
  participant CLS as Classifier
  participant LOOP as Tool loop
  participant DB as Postgres
  participant SYN as Synthesizer

  U->>API: question, thread_id, images
  API->>CLS: route this query
  CLS-->>API: intent, sources to try
  loop until answer or budget exhausted
    API->>LOOP: pick next tool
    LOOP->>DB: query_incidents or list_recent or fetch_runbook
    DB-->>LOOP: rows
    LOOP-->>API: tool result, maybe more calls
  end
  API->>SYN: compose final with citations
  SYN-->>API: text with INC-xxx and RB-xxx markers
  API->>API: validate every citation resolves
  alt any citation missing
    API->>SYN: retry with corrections
  end
  API-->>U: SSE final event
```

## Model routing

```mermaid
flowchart LR
  Q[Incoming query]
  Q --> R{Role}
  R -->|classifier| M1[deepseek v4 flash, cheap and fast]
  R -->|main reasoning and tool loop| M2[deepseek v4 pro]
  R -->|image describe A| M3[gpt 4o mini]
  R -->|image describe B| M4[gemini 2.5 flash image]
  R -->|fallback if primary fails| M5[btl 2]
  M3 & M4 --> CON[Intersect and trust]
  M1 & M2 & CON --> OUT[Answer]
```

## Data model

```mermaid
erDiagram
  workspaces ||--o{ incidents : owns
  workspaces ||--o{ runbooks : owns
  workspaces ||--o{ copilot_threads : owns
  copilot_threads ||--o{ copilot_turns : contains
  incidents }o--o{ runbooks : cited_by

  workspaces {
    uuid id
    text chat_platform
    text incident_channel_id
    text webhook_secret
    int  github_installation_id
    text grafana_url
    text sentry_org_slug
  }
  incidents {
    uuid id
    uuid workspace_id
    text source
    text severity
    text title
    text body
    text dedup_hash
    tsvector search_vector
  }
  runbooks {
    uuid id
    uuid workspace_id
    text title
    text content_md
    uuid[] source_incident_ids
  }
  copilot_turns {
    uuid id
    uuid thread_id
    text status
    jsonb citations
    int input_tokens
    int output_tokens
  }
```

## What is complex under the hood

- Multi tenant OAuth for Slack and Discord with cookie based sessions. Every read path is workspace scoped, no cross workspace leak surface
- Per workspace webhook secrets so a leaked secret only affects that one tenant
- Streaming SSE for the Copilot with named events (classified, tool_call, tool_result, delta, final, error) so the UI can render a live trace
- Tool use loop with citation validation and one automatic retry pass before shipping
- Synthesis reserve, the loop always keeps enough wall clock budget to compose a final answer even when tool calls run long
- Dual VLM consensus for screenshot uploads. Two models describe the same image, only claims both agree on are trusted
- GitHub App with signed JWT to installation token exchange, plus deployment webhooks enriched with commit title, author, and diff stats via the installation token
- Sentry Internal Integration flow that auto lists projects and creates alert rules pointing at the workspace webhook
- Grafana Contact Point auto created on the customer side via the Grafana API when the user pastes their token
- Postgres tsvector search vector with GIN index, kept in sync by a trigger, so text search stays under 50 ms even as the incident corpus grows
- Nightly cron that finds resolved incident threads, drafts runbooks with the reasoning model, saves as pending drafts
- Cookie based session tokens. Session tokens never appear in URLs
- Server components render the shell, client components handle drawer state and streaming
- Light and dark theme with CSS variable inversion so most utility classes flip automatically

## Stack

- Next.js 16 App Router on Vercel with Node runtime, maxDuration 60 s
- Supabase Postgres with tsvector FTS, GIN indexes, RLS
- BTL Runtime (OpenAI compatible gateway) for all LLM calls
- Slack app, Discord bot, Grafana Contact Point, Sentry Internal Integration, GitHub App, generic JSON webhook

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

Open http://localhost:3000

## Deploy

Push to main. Vercel picks up apps/web as the project root. Env vars from .env.example go into Vercel project settings.
