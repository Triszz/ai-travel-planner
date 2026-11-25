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

## 2026-11-20 — Contract test planning for POST /plans/{planId}/save

**Tool:** ChatGPT.
**Asked for:** A senior-engineer review of the project brief, the selected Save endpoint contract, and a test strategy aligned with the PA#2 rubric.
**Kept:** Treating the approved endpoint contract as the source of truth; organizing coverage around authentication and ownership, request validation, plan validation, budget rules, idempotency, publication lifecycle, RFC 9457 errors, security, and CI. The proposed test layers are unit tests, NestJS E2E tests with in-memory repositories, PostgreSQL integration tests, and fault-injection tests.
**Changed:** The initial test approach was expanded beyond checking HTTP status codes. The plan now includes response content types and Problem Details fields, persistence side effects, absence of side effects after failures, authorization at commit time, replay behavior, and concurrent publication scenarios.
**Rejected:** Starting implementation before the contract and test matrix were sufficiently clear. Also rejected treating the existing Hello World tests as evidence that the Save endpoint was already covered; the repository still had only the application scaffold and basic tests at this stage.
**By hand:** Inspected the repository structure, package scripts, existing NestJS tests, and the available Prisma files. Reviewed the endpoint scope and prepared the test-planning documents.

## 2026-11-21 — Review and revision of the Plan Save contract test matrix

**Tool:** ChatGPT.
**Asked for:** A critical review of the Plan Save test matrix against the approved contract, especially authorization, ETag preconditions, idempotency, budget enforcement, transaction behavior, and the PA#2 test-quality requirements.
**Kept:** The revised matrix structure and its scenario-based coverage. The latest version separates unit, NestJS E2E, PostgreSQL integration, and fault-injection responsibilities. It also includes deliberate contract-break checks and requires deterministic tests without real LLM calls or external network dependencies.
**Changed:** Refined several scenarios to remove ambiguity and overlapping assertions:

- Distinguished a retry while the first request is still processing from a retry after the first request has completed.
- Clarified that concurrent requests using different valid idempotency keys for the same revision must not create duplicate publications or publish events.
- Made backend-computed costs authoritative; model-generated cost values are treated as untrusted input.
- Clarified transaction-failure expectations: no partial durable publication or idempotency result, and no publish event before a successful commit.
- Removed duplicate or overlapping test cases and aligned the expected outcomes with the contract's status codes and Problem Details types.
- Added explicit checks for authorization before returning an idempotency replay, replay after the source plan advances, and saving an already-published older revision.
  **Rejected:** Using a generic inaccessible-resource response where the contract defines a specific error; assuming that a database rollback can undo an event already emitted to an external system; and treating an in-memory repository as sufficient evidence for PostgreSQL transaction and concurrency guarantees.
  **By hand:** Revised `docs/contract/POST-plans-planId-save-contract.md` and prepared the updated `docs/contract/plan-save-test-matrix.md`. Reviewed the changes with `git status` and kept the work on the `feat/contract-tests` branch.

## 2026-11-21 — Test architecture and implementation boundaries

**Tool:** ChatGPT.
**Asked for:** A repository-specific test architecture and an implementation roadmap for the Save endpoint, based on the actual NestJS, Vitest, Supertest, Prisma, and PostgreSQL setup.
**Kept:** Testing pure business rules in isolation; testing the HTTP contract through a real NestJS application; and reserving real PostgreSQL integration tests for transaction atomicity, uniqueness constraints, and concurrency. The proposed application boundary uses repositories and transaction-related ports so business logic can be tested without mocking the entire service.
**Changed:** Separated what each test layer can prove. In-memory E2E tests are intended to verify HTTP and application behavior, while PostgreSQL tests must verify database-specific guarantees. Fault-injection tests are reserved for uncertain commit outcomes and failures during publication persistence.
**Rejected:** Using SQLite or an in-memory database as a substitute for PostgreSQL concurrency tests; mocking the whole application service in E2E tests; and claiming that a test passes or that CI enforces a behavior before actually running the relevant check.
**By hand:** Reviewed the proposed architecture and implementation sequence. The next step is to inspect the remaining bootstrap and Prisma configuration details, then implement the tests against the agreed contract. No Save endpoint implementation or complete contract test suite has been claimed as finished in this entry.

## 2026-11-22 — Schedule, validator and budget specification for SavePlanService

**Tool:** ChatGPT.
**Asked for:** Propose the missing Schedule structure, backend validator rules and budget calculation so the team can proceed with `SavePlanService`, then review the implementation boundaries against the project brief and PA#2 scope.
**Kept:** A structured JSON Schedule with days, stops, selected items and explicit member cost allocation; five backend validation categories covering place/item existence, opening hours, travel time, spending limits and outdoor rain; deterministic VND cost allocation; and a `SavePlanService` that coordinates repositories, validation and publication rather than embedding domain rules in the controller.
**Changed:** The implementation was previously blocked because the team had no agreed Schedule schema, validator rules or budget formula. We now have concrete proposals to review, including how shared item costs are allocated and how the lowest active member spending cap is applied. These are proposals, not yet confirmed team decisions.
**Rejected:** A validator that always passes, trusting prices or place properties supplied by the Schedule, allowing the model to calculate money, and claiming that in-memory tests prove PostgreSQL transaction or concurrency guarantees.
**By hand:** The team must review and approve the proposed Schedule schema, cost-allocation policy, lowest-cap interpretation and validation rules before treating them as the project specification. Repository changes and implementation tests have not yet been claimed as completed.

## 2026-11-22 — In-memory group budget domain and data providers

**Tool:** ChatGPT.
**Asked for:** Review and guide the implementation of the in-memory group and group-member budget model, repositories, and budget data provider for the PA#2 Save endpoint.
**Kept:** Separate `Group` and `GroupMember` domain models; composite `(groupId, userId)` identity for group membership; active-member filtering; and a provider boundary that loads budget inputs without putting repository orchestration into the budget calculator.
**Changed:** The initial minimal group model was extended with `budgetVnd`, while group members gained `status` and `spendingCapVnd`. The in-memory store and providers were aligned with these models. Price lookup uses `(placeId, itemId)` rather than trusting prices embedded in the schedule.
**Rejected:** Treating inactive members as budget participants; adding unnecessary ownership or identity fields to the minimal group model without a confirmed requirement; and allowing model-generated prices to determine the published budget.
**By hand:** Implemented and reviewed the domain interfaces, in-memory storage and repository/provider wiring. The team remains responsible for explaining the budget rules and their assumptions.

## 2026-11-23 — Default plan validator and budget validation integration

**Tool:** ChatGPT.
**Asked for:** Review the `PlanValidator` boundary and guide the integration of schedule validation and backend budget calculation into the default validator.
**Kept:** `PlanValidator` as an application-facing abstraction; `DefaultPlanValidator` as the implementation that parses the schedule and obtains budget inputs through `BudgetDataProvider`; and the separation between schedule validity and budget validation results.
**Changed:** Registered `DefaultPlanValidator` in `PlansModule` through a factory that injects `BUDGET_DATA_PROVIDER`. The validator returns a schedule status separately from the budget result, so the Save service must inspect the actual validation and budget outcomes rather than assuming that a valid schedule means the budget also passed.
**Rejected:** A validator that always passes; embedding budget repository access in the controller; and assuming a property such as `budget.passed` without checking the actual `BudgetResult` interface.
**By hand:** Implemented the validator and provider wiring, then ran the available type-check, lint and test commands. The reported results were clean; these results were reported by the developer and were not independently executed by ChatGPT.

## 2026-11-23 — Contract-first implementation sequence for Plan Save

**Tool:** ChatGPT.
**Asked for:** Clarify whether executable contract tests should be written before implementing the Save endpoint, and review the next implementation step against the existing test matrix.
**Kept:** The approved endpoint contract and `docs/contract/plan-save-test-matrix.md` as the sources of truth for test expectations. Tests should be derived from the contract, not adjusted to match implementation behavior.
**Changed:** Corrected the proposed sequence: the test matrix had already been prepared, so the next step is to turn its applicable scenarios into executable tests, run them against the current application to establish the expected failures, and only then implement the service and controller. Test responsibilities remain separated between unit tests, NestJS E2E tests with in-memory repositories, PostgreSQL integration tests and fault-injection tests.
**Rejected:** Treating the Markdown test matrix as proof that executable contract tests already exist; implementing the endpoint first and writing tests afterward; and claiming that in-memory tests prove PostgreSQL transaction atomicity or concurrency guarantees.
**By hand:** Prepared the revised test matrix before this discussion and reviewed the proposed test-first sequence. The existence and current status of executable Save endpoint tests still need to be verified in the repository.

## 2026-11-23 — Phase 2.1: Save endpoint authorization

**Tool:** ChatGPT.
**Asked for:** Review and guide the implementation of the authorization checks for `POST /plans/{planId}/save` against the approved endpoint contract.
**Kept:** Owner-only access, the requirement that the owner must be an active member of the associated group, and the contract's indistinguishable `404 plan-not-found` response for missing plans, non-owners and inactive or missing memberships.
**Changed:** Extended the controller to check plan ownership and active group membership before proceeding to later state checks. Moved the associated-group existence lookup after membership verification to avoid revealing group state to unauthorized callers. Added authorization test coverage, including the inactive-membership case (`AUTHZ-011`).
**Rejected:** Returning different errors for a non-owner and an inactive member, and checking whether the associated group exists before verifying the caller's active membership.
**By hand:** Implemented the controller and test changes, then ran the relevant API checks. The reported unit and E2E test results passed; these results were reported by the developer and were not independently executed by ChatGPT.

## 2026-11-23 — Phase 3: Plan and budget validation integration

**Tool:** ChatGPT.
**Asked for:** Review and guide the integration of revision resolution, schedule validation and backend budget enforcement into the Save endpoint, following the approved contract.
**Kept:** Resolving the exact plan revision from the `If-Match` ETag; rejecting stale revisions with `412 plan-revision-conflict`; validating the resolved revision through `DefaultPlanValidator`; and returning `422` Problem Details for validation and budget failures.
**Changed:** Integrated the revision repository and validator into `PlansController`. Separated `plan-validation-failed` from `budget-exceeded`, including distinct violation codes for member spending-cap and group-budget failures. Added safe aggregate budget information to budget error responses while excluding per-member spending details. Kept the group-existence lookup after active-membership authorization.
**Rejected:** Treating a successful schedule validation as proof that the budget passed; trusting client- or model-provided cost values; exposing `memberSpending` in error responses; and treating the controller's default `201` response as proof that a publication had been created.
**By hand:** Implemented the controller integration, updated validation violation codes and group-budget messages, and added E2E coverage for successful validation, schedule-validation failure, member spending-cap failure and group-budget failure. The developer reported that API type checking passed, 82 unit tests and 33 E2E tests passed, lint and format checks passed, and `git diff --check` reported no issues. Publication persistence and idempotency remain for Phase 4.

## 2026-11-24 — Phase 4: Publication and idempotency implementation

**Tool:** ChatGPT.
**Asked for:** Review and guide the implementation of publication creation, immutable snapshots, idempotency handling and request ordering for `POST /plans/{planId}/save` against the approved endpoint contract.
**Kept:** The contract-defined idempotency scope and fingerprint; the 24-hour retention period; replay of completed responses; rejection of key reuse with a different fingerprint; lookup of an existing publication before stale-ETag rejection; and re-checking ownership and active group membership before committing a publication.
**Changed:** Extended the in-memory publication model and repository to retain the group association and original response representation. Added in-memory idempotency records for in-progress and completed requests, stored deterministic business-error responses, and added a reservation/re-check flow to reject overlapping requests using the same key.
**Rejected:** Treating an in-memory reservation as a distributed lock or claiming that the current implementation guarantees atomicity across multiple API instances. Also rejected checking the current ETag before looking up an already-published revision, because that would incorrectly reject a repeat save after the plan advances.
**By hand:** Implemented the controller, repository, store and fixture changes; reviewed the request-ordering logic; and ran the publication repository tests and Save endpoint E2E tests. The developer reported that the repository suite passed 7/7 and the Save endpoint E2E suite passed 21/21. These results were reported by the developer and were not independently executed by ChatGPT.

## 2026-11-24 — Phase 4: Publication and idempotency test coverage

**Tool:** ChatGPT.
**Asked for:** Review and guide additional E2E tests for idempotency replay, deterministic business errors, authorization changes during validation, revision changes, immutable snapshots and concurrent requests.
**Kept:** Tests that verify observable HTTP behavior and stored side effects, rather than relying only on mocked repository calls. Added an overlapping-request scenario to verify that a second request using the same in-progress key is rejected while the first request is still validating.
**Changed:** Expanded `save-publication.e2e-spec.ts` with cases for successful replay, key reuse, in-progress requests, existing publications, expired records, deterministic error replay, authorization re-checks, revision conflicts and lifecycle changes. Added a concurrency test (`IDEM-009`) that gates the first request inside validation and sends a second HTTP request before releasing it.
**Rejected:** Treating a seeded `in-progress` record test alone as proof of concurrent request handling; it does not exercise two overlapping HTTP requests. Also rejected interpreting the single-process concurrency test as proof of multi-instance concurrency safety.
**By hand:** Implemented and ran the E2E tests. The developer reported that the isolated `IDEM-009` test passed, followed by the complete Save endpoint E2E suite (21/21) and publication repository suite (7/7). These results were reported by the developer and were not independently executed by ChatGPT.

## 2026-11-25 — Phase 5: Contract test completion and CI verification

**Tool:** ChatGPT.
**Asked for:** Review the Save endpoint contract-test implementation and help verify that the tests cover the agreed authorization, validation, publication and idempotency behavior required by the PA#2 rubric.
**Kept:** Keeping the endpoint contract as the source of truth; preserving tests as independent checks of implementation behavior; and using the required CI status check as the merge gate. The team completed the contract-test work through PR #15 (`update/contract-tests`), which was merged into `main`.
**Changed:** The work moved from test planning and individual implementation phases to a consolidated contract-test suite. We reviewed the test commands and their expected results before treating the suite as evidence. The assistant emphasized that a successful test run alone does not prove that branch protection requires the CI check; these are separate requirements.
**Rejected:** Treating a green local test run as proof that GitHub branch protection is enforced; claiming PostgreSQL transaction or distributed-concurrency guarantees from in-memory tests; and changing contract expectations merely to make implementation tests pass.
**By hand:** Completed and reviewed the contract-test changes, ran the project quality checks, and merged PR #15. The developer reported that the required checks passed. PR #15 was merged into `main` on 2026-11-25.

## 2026-11-25 — Phase 5: Deliberate ownership contract break

**Tool:** ChatGPT.
**Asked for:** Design and review a deliberate implementation failure that violates the `POST /plans/{planId}/save` ownership contract without modifying the contract or its tests, so the required CI workflow could demonstrate a real failing check.
**Kept:** Removing only the initial plan-owner authorization guard from `PlansController`, while retaining the commit-time ownership check. This created an observable authorization failure before the commit stage and preserved the original contract tests as independent evidence.
**Changed:** The deliberate break was isolated in commit `4602f5e` (`test(api): demonstrate missing plan ownership guard`) on branch `test/deliberate-ownership-break`. The authorization E2E tests exposed the regression: non-owner and inaccessible-plan requests returned `422` or `409` instead of the contract-required indistinguishable `404 plan-not-found`. The required GitHub Actions check failed on PR #16.
**Rejected:** Modifying the contract, weakening the expected test assertions, deleting authorization tests, or introducing an artificial CI failure unrelated to the endpoint behavior. Also rejected merging the deliberately broken implementation.
**By hand:** Removed the initial ownership guard, ran the targeted authorization E2E suite, inspected the resulting failures, committed the deliberate break, pushed the branch, and opened PR #16. The developer captured the failing CI result. The red CI run was recorded at [PR #16 failing CI run](https://github.com/Triszz/ai-travel-planner/actions/runs/45583217958/job/139098176736?pr=16).

## 2026-11-25 — Phase 5: Restore ownership guard and verify the repair

**Tool:** ChatGPT.
**Asked for:** Review the minimal repair for the deliberate ownership regression, verify that the contract and tests remained unchanged, and check the resulting CI status before merging PR #16.
**Kept:** Restoring the original initial ownership guard immediately after the plan-existence check and before group-association and subsequent state checks. The guard returns the same `404 plan-not-found` Problem Details response for a plan owned by another user.
**Changed:** Restored the 12-line ownership guard in `PlansController` in commit `2e8c3aa` (`fix(api): restore plan ownership guard`). The repair kept the deliberate-break commit in the same PR, allowing the red-to-green history to remain visible. The required CI check subsequently completed successfully for the repaired head commit.
**Rejected:** Changing the authorization tests or endpoint contract to accommodate the broken implementation; broad refactoring during a narrowly scoped repair; and claiming that the in-memory implementation proves database-level atomicity or multi-instance concurrency guarantees.
**By hand:** Restored the guard, ran the targeted authorization E2E tests and the project quality checks, reviewed the staged diff, committed the repair, and pushed it to PR #16. The developer reported 11/11 targeted authorization E2E tests passing, 85/85 unit tests passing, 56/56 E2E tests passing, and successful lint, format, type-check and API build commands. The required GitHub Actions check was independently verified as successful for commit `2e8c3aa`. The developer subsequently merged PR #16 into `main`.
**Evidence:** [PR #16](https://github.com/Triszz/ai-travel-planner/pull/16) · [Failing CI run](https://github.com/Triszz/ai-travel-planner/actions/runs/45583217958/job/139098176736?pr=16) · [Successful CI run](https://github.com/Triszz/ai-travel-planner/actions/runs/45585706320/job/139106634824)
