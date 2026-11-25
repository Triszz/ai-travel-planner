# Self-assessment — PA#2

**Submitted by:**

- 23127376 — Hồ Gia Huy
- 23127503 — Trần Thanh Trí

**Total I claim: 88 / 100**

| Criterion                                         |     Max | I claim | Evidence                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------- | ------: | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Rules file                                     |      15 |      13 | `AGENTS.md` — Stack, Commands, Conventions and Never sections; `AI-LOG.md` entries dated 2026-11-18 and 2026-11-19 trace rule changes to actual issues, including the incomplete Observe removal and fresh-clone check failures.                                                                                                                 |
| 2. Permissions and secrets                        |      10 |       8 | `AGENTS.md` — three permission tiers; `.env.example`, `apps/api/.env.example`, `apps/web/.env.example`; `.gitignore`; `README.md` — environment setup and model-key spending-cap guidance. The score is not full because the submitted evidence index does not itself prove the absence of secrets throughout the complete Git history.          |
| 3. One command for every check                    |      10 |       9 | `package.json` — root scripts `npm run lint`, `npm run format:check`, `npm run typecheck`, and `npm test`; `.github/workflows/ci.yml` — the same commands; `docs/evidence/fresh-clone-verification.md` — fresh-clone results.                                                                                                                    |
| 4. CI that blocks a merge                         |      20 |      18 | `docs/evidence/ci-and-branch-protection.md` and `docs/evidence/branch-protection-1.png` through `branch-protection-3.png` — `main` protection and required `check`; `PA2.md` §3–4 — PR #16, failing CI run, repair commit `2e8c3aa`, and successful CI run; direct-push history check documented in `docs/evidence/ci-and-branch-protection.md`. |
| 5. The contract of one AI Travel Planner endpoint |      25 |      22 | `docs/contract/POST-plans-planId-save-contract.md` — caller ownership and active-membership rules, request/response behavior, RFC 9457 errors, revision preconditions, idempotency, publication lifecycle and failure behavior.                                                                                                                  |
| 6. Contract tests that bite                       |      15 |      13 | Unit tests across the relevant `apps/api` source directories; E2E tests under `apps/api/test`, including authorization, validation, publication and idempotency scenarios; `.github/workflows/ci.yml`; `PA2.md` §§3–4 and §6; PR #16 deliberate-break commit `4602f5e`, red CI run, repair commit `2e8c3aa`, and green CI run.                   |
| 7. AI-LOG.md                                      |       5 |       5 | `AI-LOG.md` — dated entries identify the tool, requested work, what was kept, changed and rejected, and work performed by the team. The Phase 5 entries link the deliberate break and repair to PR #16 and its CI evidence.                                                                                                                      |
| **Total**                                         | **100** |  **88** |                                                                                                                                                                                                                                                                                                                                                  |

## What I did not manage

The PA#2 implementation uses in-memory repositories for the Save endpoint test path. It does not establish PostgreSQL transaction atomicity, database-level concurrency guarantees, or correctness across multiple API instances. Those guarantees must not be inferred from the current in-memory tests.

The submission also does not claim that the first-parent history command proves the absence of every possible direct push; it records only that no non-merge commit was observed on that history after branch protection was enabled.

The CI run triggered by pushing the final `pa2` tag is not yet linked in `PA2.md` at the time this report is drafted. The final report and ZIP score must be reconciled after the tag workflow has run and its actual URL has been added.

## What I would do differently

I would define the evidence required for each rubric criterion before implementation and keep the evidence index updated as each gate is completed. I would also add a PostgreSQL-backed integration test layer before making any claims about transaction atomicity or concurrency beyond the current single-process, in-memory implementation.
