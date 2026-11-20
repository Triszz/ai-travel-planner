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

## 2026-11-19 — Remove Observe leftovers and align scaffold docs

- **Tool:** Antigravity (Gemini)
- **Asked for:** Clean up Observe leftovers discovered during peer review: drop `@nestjs/observe` from root `package-lock.json`, remove stale Observe documentation from `apps/api/AGENTS.md` and `apps/api/README.md`, and clarify Redis status in root `AGENTS.md`.
- **Kept:** Removing only the Observe dependency and its 62-line `apps/api/node_modules/@nestjs/observe` block from root `package-lock.json`, keeping all other lock entries intact.
- **Changed:** `apps/api/AGENTS.md` (removed "Production data: NestJS Observe" section) and `apps/api/README.md` (removed Observability section and link command) to prevent coding assistants from trying to configure or rely on Observe. Clarified in root `AGENTS.md` that Redis is not yet used in PA#2.
- **Rejected:** Leaving stale Observe documentation in workspace scaffold files; deleting workspace lockfiles prematurely before `npm ci` is verified on CI.
- **Note:** These leftovers were caught by manual peer review of the merged PRs rather than automated checks, highlighting the value of code review over automated linters alone.

## 2026-11-19: Fresh-clone verification of the four quality commands

- **Tool:** Claude (claude.ai chat).
- **Asked for:** A review of the lint, format, type check and test setup, then help diagnosing failures from a fresh clone.
- **Changed:** The assistant could only read the repository, not run the commands. Running them on a fresh clone found problems its review had not confirmed: a trailing blank line left in `apps/api/src/main.ts` (8bea446) and `apps/api/AGENTS.md` (3c1c3c7) by the Observe cleanup; `LayoutProps` missing because Next.js generates it into the git-ignored `.next/`; and `next-env.d.ts` (generated, git-ignored) being checked by Prettier, so `format:check` depended on command order. We also changed the assistant's plan: Docker was too slow, so we ran the commands directly on Windows in a new clone, and Prettier was not installed in the main working copy, so we ran the one from the fresh clone. Each fix is a separate commit (hashes in the evidence file).
- **Rejected:** Replacing `LayoutProps` with a hand-written type in `layout.tsx`. We generate the types with `next typegen` instead, so app code is not changed just to satisfy a check.
- **Not done, on purpose:** `npm audit fix --force`. `npm audit` reports 12 vulnerabilities, and the fix would rewrite `package-lock.json`, so it is left for a separate PR.
- **Result:** All four commands exit 0 on commit `31eea01`. Details in `docs/evidence/fresh-clone-verification.md`.

## 2026-11-19: GitHub Actions CI and branch protection

- **Tool:** Claude (claude.ai chat).
- **Asked for:** The CI workflow, the branch protection settings, the red-CI demonstration, and help diagnosing CI failures.
- **Changed:** The first CI run failed at the Lint step on the Linux runner (`Cannot find native binding` from oxlint), although the same four commands passed on Windows. The assistant suspected a lockfile created on Windows without Linux bindings, then doubted this because a `grep` for `linux-x64` returned matches. Listing the lockfile entries for oxlint showed only `win32` packages; the `grep` had matched declared optional dependencies, not installed ones. We regenerated `package-lock.json` (<hash>) and checked that `@oxlint/binding-linux-x64-gnu` was now present. After that, `format:check` failed on six `apps/web` files. The cause was CRLF line endings in our local working copy (`git ls-files --eol` showed `i/lf w/crlf`), not the repository content, so CI was not affected; we fixed it locally with `prettier --write`.
- **Not done, on purpose:** Switching the runner to `windows-latest` (it would hide the problem); using `npm install` instead of `npm ci` in CI; adding `apps/web` to `.prettierignore` to silence the check.
- **Result:** CI is green, `main` requires the `check` status check, and the red-to-green demonstration is in <PR link>. Details in `docs/evidence/ci-and-branch-protection.md`.
