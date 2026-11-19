# AI Travel Planner: rules for coding assistants

## Stack

- Monorepo (npm workspaces): `apps/api` (NestJS, TypeScript strict), `apps/web` (Next.js)
- `apps/ai-agent` (Python, LLM orchestration): placeholder until PA#3
- PostgreSQL + Prisma (`apps/api/prisma`); Docker for local dev
- Redis (not used yet in PA#2)
- Vitest + Supertest (API tests), Oxlint (API), ESLint (Web), Prettier. PA#2 contract tests use an in-memory repository, no database.

## Commands (from repo root)

- `npm run lint`
- `npm run format:check`
- `npm run typecheck`
- `npm test`
  Run all four before every commit. These are the checks CI will run.

## Conventions

- The contract in `docs/contract/` is the source of truth. Code follows it. When `AGENTS.md` files are nested, the root file wins.
- Errors are RFC 9457 problem details (`application/problem+json`) with a stable `type`, from one global exception filter.
- Persistence sits behind repository interfaces so tests can use the in-memory one.
- Money is calculated by plain code only, never by a model.
- The model reaches data only through the backend's JSON tools.
- Contract edit, code change and test change go in separate commits.
- Every change is a pull request reviewed by the other member.

## Never

- Never put a secret or model key in `apps/web` or any `NEXT_PUBLIC_*` variable.
- Never call a real model in unit tests; use fixtures.
- Never edit a test, the eval data or a validator rule to make a check pass.
- Never change code and its tests in the same commit just to turn CI green.
- Never add `continue-on-error`, `|| true` or `--no-verify` to any check.
- Never push to `main`, force-push, or rewrite history after a PR is opened.
- Never let the Python agent touch the database directly.
- Never edit a committed Prisma migration; add a new one.
- Never run `prisma migrate reset` or `db push` on a shared database.
- Never send names or emails to a model; only places and interests.
- Never claim that a check passed unless it was executed. (AI-LOG 2026-11-17, 2f73325)
- Never share a schedule before the Save operation.
- Never use Prisma configuration APIs from a different major version than the installed Prisma CLI. (AI-LOG 2026-11-17, 2f73325)

## Permissions

- **Allowed:** run the four check commands; edit `apps/*/src`, `apps/*/test`, `docs/`; add tests for approved behavior and contracts.
- **Ask first:** add or upgrade a dependency; edit `.github/workflows/`, `docs/contract/`, lint/TS/Nest/Next config, Prisma schema or migrations, `AGENTS.md`, `CLAUDE.md`.
- **Never:** read or write `.env`; push to `main`; skip hooks; weaken, delete or modify tests, eval data or validator rules solely to make a check pass.

## Enforcement

- Claude Code: `.claude/settings.json` blocks the "Never" commands.
- Cursor: rules are advisory. Branch protection and required CI on `main` are the real gate.
