# AI Travel Planner

CSC13114 class project members: 23127376, 23127503.

## Technology Stack

- Frontend: Next.js + TypeScript
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- AI Agent: Python
- Cache: Redis
- Infrastructure: Docker

## Requirements

- Node.js 22+, npm 10+
- Docker (used to run PostgreSQL and Redis locally)
- Python 3.12+ (only once `apps/ai-agent` has code, from PA#3)

## Repository Structure

- apps/web: Next.js frontend
- apps/api: NestJS backend
- apps/ai-agent: Python AI Agent
- docs: architecture and API contracts

## Environment Setup

```bash
git clone https://github.com/Triszz/ai-travel-planner.git
cd ai-travel-planner
# 1. Copy the templates, then fill in the real values before starting Docker
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/ai-agent/.env.example apps/ai-agent/.env # for PA#3
# 2. Install Node dependencies
npm ci
# 3. Start PostgreSQL and Redis (requires .env to be filled in first)
docker compose up -d
```

> **If `typecheck` fails on a fresh clone**, run `npm run prisma:generate --workspace=api` once to generate the Prisma client, then retry.

## Development Servers

Start the frontend (from the repository root):

```bash
npm run dev --workspace=web
```

Start the backend (from the repository root, in a separate terminal):

```bash
npm run start:dev --workspace=api
```

## Python Agent

The Python Agent is planned for PA#3.
Its implementation and dependency setup are not available in PA#2.

## Quality Checks

These are the checks CI will run, from the repo root:

```bash
npm run lint
npm run format:check
npm run typecheck
npm test        # currently runs workspace api only
```

## Environment variables

Four env files, all git-ignored; commit only the `.example` templates:

- `.env` — root (Docker Compose variables: `POSTGRES_*`, `REDIS_*`)
- `apps/api/.env` — NestJS + Prisma (`DATABASE_URL`, `JWT_SECRET`, `PORT`, …)
- `apps/web/.env` — Next.js (`NEXT_PUBLIC_*` only; no secrets)
- `apps/ai-agent/.env` — Python agent (`AI_PROVIDER_*`, `BACKEND_INTERNAL_URL`, …) — sole owner of model credentials in PA#3

Real values live only in the `.env` files (git-ignored). Only `NEXT_PUBLIC_*` values may reach the browser, and they must not be secrets.

## AI assistants

Rules for coding assistants are in `AGENTS.md` (Claude Code reads it through `CLAUDE.md`).
Permissions are written there in three tiers: allowed, ask first, never.

## Model and cost

- PA#2 status: No model provider or API key is configured. No model calls are made.
- Provider / model: To be configured in `apps/ai-agent/.env` (`AI_PROVIDER_*`) in PA#3. Sole owner of model credentials.
- Cost per plan: To be estimated after selecting provider and model in PA#3.
- Spending cap: Must be set at the provider level and documented with an exact figure before any key is activated.

## Data credits

OpenStreetMap, Wikimedia, Open-Meteo.

## Documents

- `docs/contract/`: endpoint contract
- `docs/DECISIONS.md`: team decisions
- `AI-LOG.md`: AI tool usage log

## Security

- Model API keys must never reach the browser.
- Configure a spending cap for the selected model provider.
- Document the selected model and the estimated cost per plan.
