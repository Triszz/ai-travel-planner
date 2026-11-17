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
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/ai-agent/.env.example apps/ai-agent/.env # for PA#3
npm ci
```

## Infrastructure

Start local dependencies:

```bash
docker compose up -d
```

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

- PA#2 status: No model provider or API key is configured. No model calls are made.
- Provider and model selection: Required before enabling model access in PA#3.
- Cost per plan: To be estimated after selecting the provider and model.
- Spending cap: A provider-side spending limit must be configured and documented before enabling model access.

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
