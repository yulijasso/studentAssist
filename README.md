# Campus Assist

Multi-tenant university chatbot platform. Institutions embed a widget that answers student questions using a LangGraph agent backed by live web search (Tavily API).

## Features

- **Student widget** — embeddable chat that answers admissions, registration, financial aid, academics, housing, and campus-services questions; grounded in each institution's knowledge base (documents + FAQs) plus web search; streams responses, detects language, routes to the right department, and escalates when a human is needed.
- **Institution dashboard** (`/dashboard/[slug]`) — conversations console with statuses, assignment, and SLA tracking; knowledge base (documents + FAQs); department/routing config; team management; and analytics (resolution, escalation, SLA).
- **Platform admin** (`/admin`) — onboard and govern institutions (create, configure, suspend, delete, set request quotas), manage cross-institution users and roles, and monitor platform usage + live system health.

## Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 16.1.7 |
| UI | React | 19.2.4 |
| API layer | tRPC | 11.12.0 |
| Agent | LangGraph (`createReactAgent`) | 1.2.2 |
| LangChain | LangChain.js core | 1.2.32 |
| LLM — Groq | `llama-3.3-70b-versatile` prod / `llama-3.1-8b-instant` dev | groq sdk 1.1.5 |
| LLM — OpenRouter | Any OpenAI-compatible model (swap via `LLM_PROVIDER`) | @langchain/openai |
| Web search | Tavily API | @tavily/core 0.3.1 |
| Database | PostgreSQL 16-alpine + Drizzle ORM | drizzle-orm 0.36.0 |
| Migrations | drizzle-kit | 0.28.0 |
| Cache / Session | Redis 7-alpine + ioredis | ioredis 5.4.1 |
| Auth | Clerk | @clerk/nextjs 5.x |
| Widget | TypeScript + Vite (IIFE, Shadow DOM) | Vite 5.x |
| Logging | pino | 10.3.1 |
| Retry / backoff | p-retry | 7.1.1 |
| Validation | Zod | 3.23.8 |
| ORM query builder | Zod + superjson | superjson 2.2.1 |
| Runtime | Node.js 18+ / pnpm | TypeScript 5.x |
| Test runner | Vitest | 2.1.0 |
| tRPC explorer | trpc-panel | @metamorph/trpc-panel 1.0.5 |

## Project Structure

```
studentAssist/
├── web/          Next.js app — backend API, tRPC routers, admin dashboard
├── widget/       Embeddable chat widget (Vite IIFE build)
└── docker-compose.yml  PostgreSQL 16-alpine + Redis 7-alpine
```

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Docker Desktop | latest | https://www.docker.com/products/docker-desktop |
| Node.js | 18+ | https://nodejs.org |
| pnpm | 10+ | `npm install -g pnpm` |

---

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
make env-setup
```

This creates `.env` from `.env.example` and symlinks `web/.env.local → ../.env`.

Open `.env` and fill in your keys:

```
GROQ_API_KEY=          # https://console.groq.com
TAVILY_API_KEY=        # https://app.tavily.com
CLERK_SECRET_KEY=      # https://dashboard.clerk.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
SENDGRID_API_KEY=      # https://app.sendgrid.com — sends team invitation emails
SENDGRID_FROM_EMAIL=   # a verified sender address
```

### 3. Start PostgreSQL + Redis

```bash
make up
```

### 4. Run database migrations

```bash
make db-migrate
```

### 5. Seed the institution tenant (run once)

```bash
make db-seed
```

Seeds the UTRGV tenant and its offices. The script prints the tenant's API key on first run — save it:

```
Created tenant: The University of Texas Rio Grande Valley
API key: <printed value>
```

The script is idempotent — safe to re-run at any time.

### 6. Start the dev server

```bash
make web-dev
```

App is available at http://localhost:3000

### 7. (Optional) Build and deploy the widget

```bash
make widget-copy
```

Builds `widget/` and copies `widget.js` to `web/public/static/widget.js`.

---

## All Make Targets

```
make help          Show all available targets

Setup:
  env-setup        Create .env from .env.example (run once)
  install          Install all pnpm dependencies

Infrastructure:
  up               Start PostgreSQL + Redis (Docker)
  down             Stop and remove containers
  logs             Tail Docker Compose logs

Web:
  web-dev          Start dev server on port 3000
  web-build        Build for production
  web-typecheck    TypeScript type check (tsc --noEmit)
  web-test         Run Vitest suite
  web-lint         Run ESLint
  web-check        Run all checks before pushing (typecheck + tests)

Database:
  db-migrate       Apply Drizzle migrations
  db-push          Push schema changes (dev only, no migration file)
  db-studio        Open Drizzle Studio (visual DB browser)
  db-seed          Seed the UTRGV tenant + offices (idempotent)

Widget:
  widget-build     Build widget.js via Vite
  widget-copy      Build widget + copy to web/public/static/
```

---

## tRPC Panel

An interactive UI for exploring and testing all tRPC procedures is available in development:

```
http://localhost:3000/api/panel
```

It lists every procedure (`chat.send`, `tenants.*`, `departments.*`, `health.*`) with its Zod input schema rendered as a form. You can fill in values and invoke procedures directly from the browser — no separate API client needed.

> The panel returns 404 in production (`APP_ENV=production`).

---

## Embedding the Widget

```html
<script
  src="http://localhost:3000/static/widget.js"
  data-tenant="utrgv"
  async
></script>
```

Replace `data-tenant` with the institution slug and the `src` with your production URL.

---

## API

| Endpoint | Type | Description |
|---|---|---|
| `POST /api/trpc/chat.send` | tRPC mutation | Send a chat message, returns answer + sources |
| `GET /api/trpc/chat.tenantConfig` | tRPC query | Public tenant config for the widget |
| `GET /api/tenants/[slug]` | REST | Widget config fetch by slug |
| `WS /api/ws` | WebSocket | Streaming chat (token-by-token) |

Widget/chat procedures require the `X-Campus-Assist-Key` header. Admin and institution-dashboard procedures are authenticated with Clerk.

---

## Pushing Changes

Always run the full check suite before pushing to confirm TypeScript compiles cleanly and all tests pass:

```bash
make web-check
```

This runs two checks in sequence:
1. **`tsc --noEmit`** — full TypeScript type check across the entire `web/` codebase
2. **Vitest** — all unit tests (mocked LLM, Redis, Tavily — no real API calls)

If either step fails, fix the issues before pushing. Both must be green.

Once clean:

```bash
git add .
git commit -m "your message"
git push
```

---

## Phase 1 Scope

- Answers from a per-institution knowledge base (documents + FAQs) plus live web search (Tavily API)
- Multi-tenant isolation via `X-Campus-Assist-Key` header
- Streaming WebSocket chat + non-streaming tRPC mutation
- Conversation persistence in PostgreSQL (opt-in via `PERSIST_CHAT_MESSAGES=true`)
- Session memory: Redis, 30-minute TTL, last 6 exchange window (12 messages)
- Daily request quota per tenant
- Response caching in Redis
- Groq rate-limit backoff + email alerts
