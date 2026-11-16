# AI Travel Planner

CSC13114 class project  members: 23127376, 23127503.
Monorepo: `apps/api` (NestJS + Prisma), `apps/web` (Next.js), `apps/agent` (Python, from PA#3), PostgreSQL.

## Requirements
- Node.js 22+, npm 10+
- Docker (only for running Postgres locally)
- Python 3.12+ (only once `apps/agent` has code, from PA#3)

## Setup
```bash
git clone <repo-url>
cd ai-travel-planner
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm ci
docker compose up -d db  # optional in PA#2: contract tests need no database
```

## Checks
These four commands are exactly what CI runs, from the repo root:

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
```

## Environment variables
See `.env.example`. Real values live only in `.env` (git-ignored).
Only `NEXT_PUBLIC_*` values may reach the browser, and they must not be secrets.

## AI assistants
Rules for coding assistants are in `AGENTS.md` (Claude Code reads it through `CLAUDE.md`).
Permissions are written there in three tiers: allowed, ask first, never.

## Model and cost
- Provider / model: TODO (none used in PA#2)
- Cost per plan: TODO
- Spending cap: TODO. Replace with the real cap as soon as the key exists.

## Data credits
OpenStreetMap, Wikimedia, Open-Meteo.

## Documents
- `docs/contract/`: endpoint contract
- `docs/DECISIONS.md`: team decisions
- `AI-LOG.md`: AI tool usage log