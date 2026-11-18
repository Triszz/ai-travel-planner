# AI-LOG.md — PA#2 (CSC13114)

Team: 23127376 — Hồ Gia Huy · 23127503 — Trần Thanh Trí

## 2026-11-16 — Stack and repository layout

- **Tool:** Claude (claude.ai chat)
- **Asked for:** A PA#2 plan checked against the rubric, then the repository layout and first files.
- **Kept:** Creating `.gitignore` and `.env.example` before the first commit; names-only env templates; keeping the Python agent and Redis out of the PA#2 checks.
- **Changed:** The first plan assumed Node, Fastify and Vitest. Our team uses Next.js, NestJS and PostgreSQL with Prisma, so we asked again and got an npm-workspaces monorepo (`apps/api`, `apps/web`). We noticed because the commands and tools in the plan did not match our stack.
- **Rejected:** Putting Python and Redis checks into CI before any code uses them.

## 2026-11-16 — Rules file for a mixed Claude Code and Cursor team

- **Tool:** Claude (claude.ai chat)
- **Asked for:** A rules file and three-tier permissions (allowed, ask first, never) for a team that uses both Claude Code and Cursor.
- **Kept:** One main file, `AGENTS.md`, with Stack, Commands, Conventions, Never, Permissions and Enforcement; `CLAUDE.md` containing only `@AGENTS.md`; `.claude/settings.json` to enforce the "never" commands for Claude Code.
- **Changed:** I planned to name the file `AGENT.md`. The assistant pointed out that tools read `AGENTS.md` (with an S), so we used that name. `.claude/settings.json` was extended with `ask` entries for `AGENTS.md`, `CLAUDE.md`, Prisma schema and migrations.
- **Rejected:** Separate rule files for each tool (`.cursor/rules`, `.github/copilot-instructions.md`), because copies of the rules drift apart.
- **Limit we accepted:** Cursor does not enforce permissions. For it, the rules are advice and branch protection with required CI is the real gate.

## 2026-11-16 — Where the `.env` files live

- **Tool:** Claude (claude.ai chat)
- **Asked for:** The environment templates and the README setup steps.
- **Changed:** The assistant first said to keep a single `.env` at the repository root. I questioned it, because the web app and the backend each need their own file. The assistant agreed: Next.js reads only `apps/web`, and NestJS and Prisma run from `apps/api`. We committed three templates (`.env.example`, `apps/api/.env.example`, `apps/web/.env.example`), and the web template holds only `NEXT_PUBLIC_*` values, so no secret can reach the browser. In the README the web file is copied to `apps/web/.env` instead of the suggested `.env.local`.
- **Rejected:** A single root `.env` shared by all apps.
- **Check:** `git ls-files` shows only `.env.example` files tracked; the real `.env` is ignored.

## 2026-11-16 — First push and documents

- **Tool:** Claude (claude.ai chat)
- **Asked for:** Branch and commit names for the first push, and the README, DECISIONS and AI-LOG skeletons.
- **Kept:** Pushing the setup through a pull request (PR #1).
- **Changed:** The assistant suggested four small commits. I committed everything as one (`f2d58bb`). `docs/DECISIONS.md` was cut from six rows to two (stack, AI tools), because the other decisions (monorepo, contract endpoint, in-memory tests, who submits the zip) had not been made or done yet at that point; we only record a decision once it exists. Team member IDs replaced the README placeholders.
- **Rejected:** Leaving `<team name>` and `<student IDs>` placeholders in the README.
- **Rule added:** none from this commit.

## 2026-11-16 — PA#2 rubric review and initial architecture

- **Tool:** ChatGPT
- **Asked for:** Monorepo architecture proposal.
- **Kept:** Separate Next.js, NestJS and Python applications.
- **Changed:** Chose internal REST communication instead of introducing a queue immediately.
- **Rejected:** Direct PostgreSQL access from Python Agent.
- **By hand:** Reviewed service boundaries and approved the architecture.

## 2026-11-17 — Monorepo and development environment setup

- **Tool:** ChatGPT
- **Asked for:** Guidance on configuring npm workspaces, development scripts, Docker services, and environment variable examples.
- **Kept:** npm workspaces for the Node.js applications and Docker Compose for PostgreSQL and Redis.
- **Changed:** Consolidated the Node.js workspace setup at the repository root and adjusted the Prisma configuration to match the installed Prisma version.
- **Rejected:** Keeping conflicting Prisma configuration files for different major versions.
- **By hand:** Applied the configuration changes, ran npm workspace checks, and verified the local environment setup.

## 2026-11-17 — Quality checks and project documentation

- **Tool:** ChatGPT
- **Asked for:** Review and guidance on root-level lint, format, type-check, test commands, README instructions, and AGENTS.md rules.
- **Kept:** Separate commands for lint, format checking, type checking, and tests, exposed through the root package scripts.
- **Changed:** Updated the README development instructions to distinguish dependency installation, infrastructure startup, and frontend/backend development servers.
- **Rejected:** Claiming that CI already runs the documented checks before a GitHub Actions workflow has been configured.
- **By hand:** Ran the available checks and reviewed their results. Formatting, type checking, and tests passed; API lint remained blocked by the local Windows application-control policy.

## 2026-11-18 — Fix rules, env templates, untrack skill files

- **Tool:** Antigravity (Claude Sonnet / Gemini)
- **Asked for:** Fix accumulated issues from zip review: slim `AGENTS.md` Conventions, remove Observe telemetry completely, untrack 236 Prisma skill files from AI tool directories, add `.gitattributes` for LF normalisation, clarify README setup order, and unify model key ownership.
- **Kept:** `skills-lock.json` confirmed skill files are restorable before untracking. `.claude/settings.json` extended with 6 new `ask` entries and `Edit(./apps/*/.env)` deny rule.
- **Changed:** Initial attempt removed `ObserveModule` from `app.module.ts` but left `ObserveInstrument` in `main.ts`, which would break typecheck. Caught during code review; completely removed `@nestjs/observe` from `apps/api/package.json`, `main.ts`, and `.env.example`. Removed `MODEL_*` from API `.env.example` to make `apps/ai-agent` the sole owner of model credentials. Added `prisma:generate` script to `apps/api/package.json` to back the README instruction.
- **Rejected:** Keeping hardcoded fallback secrets (`?? 'YOUR_APP_KEY'`) or leaving Observe half-removed. Rewriting history to remove tracked skill files was rejected in favor of `git rm --cached`.
- **Rule added:** "When `AGENTS.md` files are nested, the root file wins" added to Conventions (b0db066). Linked `(AI-LOG 2026-11-17, 2f73325)` to "Never claim that a check passed unless it was executed".
