# Plan Save Endpoint — Revised Contract Test Matrix

**Endpoint:** `POST /api/v1/plans/{planId}/save`  
**Contract:** POST /plans/{planId}/save  
**Source of truth:** Approved endpoint contract, Sections 1–11.

## A. Authentication and authorization

| ID       | Scenario                                             | Expected                                                         |
| -------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| AUTH-001 | Missing bearer token                                 | 401 `unauthenticated`                                            |
| AUTH-002 | Invalid bearer token                                 | 401 `unauthenticated`                                            |
| AUTH-003 | Expired bearer token                                 | 401 `unauthenticated`                                            |
| AUTH-004 | Valid owner and active group member                  | Continue to preconditions and validation                         |
| AUTH-005 | Caller is another user                               | 404 `plan-not-found`                                             |
| AUTH-006 | Caller is a group member but not plan owner          | 404 `plan-not-found`                                             |
| AUTH-007 | Plan does not exist                                  | 404 `plan-not-found`                                             |
| AUTH-008 | Owner has been removed from group                    | 404 `plan-not-found`                                             |
| AUTH-009 | Request body attempts to supply userId               | 400 `invalid-request-body`                                       |
| AUTH-010 | Ownership or active membership is lost before commit | 404 `plan-not-found`; no publication or publish event is created |

## B. Request validation

| ID      | Scenario                                                           | Expected                                                |
| ------- | ------------------------------------------------------------------ | ------------------------------------------------------- |
| REQ-001 | Invalid planId UUID                                                | 400 `invalid-plan-id`                                   |
| REQ-002 | Missing Idempotency-Key                                            | 400 `invalid-idempotency-key`                           |
| REQ-003 | Empty Idempotency-Key                                              | 400 `invalid-idempotency-key`                           |
| REQ-004 | Key contains non-printable or non-ASCII characters                 | 400 `invalid-idempotency-key`                           |
| REQ-005 | Key exceeds 128 characters                                         | 400 `invalid-idempotency-key`                           |
| REQ-006 | Non-empty request body                                             | 400 `invalid-request-body`                              |
| REQ-007 | Missing Content-Type                                               | 415 `unsupported-media-type`                            |
| REQ-008 | Content-Type is not application/json                               | 415 `unsupported-media-type`                            |
| REQ-009 | Missing If-Match                                                   | 428 `precondition-required`                             |
| REQ-010 | Weak ETag                                                          | 400 `invalid-if-match`                                  |
| REQ-011 | If-Match wildcard (`*`)                                            | 400 `invalid-if-match`                                  |
| REQ-012 | Stale strong ETag for a revision that has not been published       | 412 `plan-revision-conflict`                            |
| REQ-013 | Malformed If-Match syntax                                          | 400 `invalid-if-match`                                  |
| REQ-014 | Multiple If-Match values                                           | 400 `invalid-if-match`                                  |
| REQ-015 | Valid strong ETag matching current revision                        | Continue to validation and publication                  |
| REQ-016 | Valid strong ETag representing an already-published older revision | 200 with existing publication; no duplicate publication |

## C. Validator and plan state

| ID      | Scenario                                                        | Expected                                                                                 |
| ------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| VAL-001 | Valid current plan revision                                     | 201 on first publication                                                                 |
| VAL-002 | Validator rejects current revision                              | 422 `plan-validation-failed`                                                             |
| VAL-003 | Validator returns multiple violations                           | 422 with all applicable machine-readable violations                                      |
| VAL-004 | Plan is archived                                                | 409 `plan-state-conflict`                                                                |
| VAL-005 | Plan is deleted                                                 | 409 `plan-state-conflict`, subject to resource access rules                              |
| VAL-006 | Plan is in another incompatible lifecycle state                 | 409 `plan-state-conflict`                                                                |
| VAL-007 | Source plan revision changes after validation but before commit | 412 `plan-revision-conflict`; no publication or publish event is created                 |
| VAL-008 | Validator infrastructure is unavailable                         | 503 `service-unavailable`; no publication, publish event or final 5xx idempotency result |
| VAL-009 | Unexpected validator internal error                             | 500 `internal-error`; no publication, publish event or final 5xx idempotency result      |
| VAL-010 | Plan has no required group association                          | 409 `plan-state-conflict`                                                                |

## D. Budget validation

| ID      | Scenario                                                                                       | Expected                                                                                             |
| ------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| BUD-001 | All member spending within lowest applicable cap and group total within budget                 | Pass                                                                                                 |
| BUD-002 | One member exceeds lowest applicable cap                                                       | 422 `budget-exceeded`                                                                                |
| BUD-003 | Group total exceeds group budget                                                               | 422 `budget-exceeded`                                                                                |
| BUD-004 | Member spending equals cap exactly                                                             | Pass                                                                                                 |
| BUD-005 | Group total equals budget exactly                                                              | Pass                                                                                                 |
| BUD-006 | Group total exceeds budget by one VND                                                          | 422 `budget-exceeded`                                                                                |
| BUD-007 | One member exceeds cap by one VND                                                              | 422 `budget-exceeded`                                                                                |
| BUD-008 | Stored plan contains an untrusted model-generated cost that differs from backend-computed cost | Backend-computed cost is authoritative; untrusted model-generated cost is never used for publication |
| BUD-009 | Either budget rule fails                                                                       | No publication is created                                                                            |

## E. Idempotency

| ID       | Scenario                                                                                                                       | Expected                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| IDEM-001 | First successful request with a new key                                                                                        | 201                                                                                                                               |
| IDEM-002 | Same key and same fingerprint after success                                                                                    | 200 + `Idempotency-Replayed: true`                                                                                                |
| IDEM-003 | Same key with a different fingerprint                                                                                          | 409 `idempotency-key-reused`; original idempotency record remains unchanged                                                       |
| IDEM-004 | Retry deterministic business error                                                                                             | Return original persisted status, headers and body, with `Idempotency-Replayed: true`                                             |
| IDEM-005 | Authentication failure                                                                                                         | No idempotency result persisted                                                                                                   |
| IDEM-006 | Request-envelope failure                                                                                                       | No idempotency result persisted                                                                                                   |
| IDEM-007 | Transient 5xx failure                                                                                                          | No final 5xx idempotency result persisted                                                                                         |
| IDEM-008 | Timeout after possible commit                                                                                                  | Reconcile durable publication and idempotency state before retry; never create a duplicate publication or event                   |
| IDEM-009 | Same literal key used by different users                                                                                       | Independent key scope; authorization still enforced                                                                               |
| IDEM-010 | Retry after 24-hour idempotency retention expires                                                                              | Expired idempotency record may no longer be replayed; an already-published revision must still not create a duplicate publication |
| IDEM-011 | Revision A is published, source plan advances to revision B, then Save is requested for revision A using a different valid key | 200 with existing publication A; no duplicate publication or publish event                                                        |
| IDEM-012 | Second request arrives while the first request is still processing                                                             | 409 `idempotency-request-in-progress`; only one logical publication can be created                                                |
| IDEM-013 | Two concurrent requests with different valid keys for the same revision                                                        | At most one publication and one publish event; both requests resolve to the same publication with 200 once publication exists     |
| IDEM-014 | Successful request is retried after caller loses active group membership                                                       | 404 `plan-not-found`; stored publication is not replayed                                                                          |
| IDEM-015 | Successful request is retried after source plan advances to a newer revision                                                   | Replay original successful response; stale current ETag must not reject the matching replay                                       |
| IDEM-016 | Retry after a non-persisted 404 authorization failure                                                                          | Re-evaluate authorization; no final idempotency result was persisted                                                              |
| IDEM-017 | Retry after a non-persisted 412 revision conflict                                                                              | Re-evaluate current revision; no final idempotency result was persisted                                                           |

## F. Publication and revision lifecycle

| ID      | Scenario                                          | Expected                                                                                                   |
| ------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| PUB-001 | First successful Save                             | 201 + Location                                                                                             |
| PUB-002 | Successful response representation                | All required fields present and valid                                                                      |
| PUB-003 | Validator revision equals published planRevision  | Must be equal                                                                                              |
| PUB-004 | Cost values in response                           | Backend-computed values                                                                                    |
| PUB-005 | Successful publication                            | Visible to authorized group members after commit                                                           |
| PUB-006 | Failed Save                                       | No group-visible publication                                                                               |
| PUB-007 | Publication snapshot                              | Immutable                                                                                                  |
| PUB-008 | Source plan edited after publication              | New draft revision; old snapshot unchanged                                                                 |
| PUB-009 | New revision not yet published                    | Group still sees previous publication                                                                      |
| PUB-010 | New revision successfully published               | New current publication; old publication retained                                                          |
| PUB-011 | Publication creation and idempotency persistence  | Both are committed atomically or through an equivalent duplicate-safe mechanism; no partial durable state  |
| PUB-012 | Successful retry or concurrent Save               | Exactly one logical publish event is recorded or emitted                                                   |
| PUB-013 | Publication is read before transaction commit     | Publication is not visible to group members before commit                                                  |
| PUB-014 | Transaction fails during publication persistence  | No partial durable publication or idempotency result; no publish event is emitted before successful commit |
| PUB-015 | Source plan advances while old publication exists | Group continues to see the old publication until the new revision is successfully published                |

## G. RFC 9457 error contract

| ID      | Scenario                  | Expected                                                              |
| ------- | ------------------------- | --------------------------------------------------------------------- |
| ERR-001 | Every documented error    | `application/problem+json`                                            |
| ERR-002 | Problem Details status    | Equals HTTP status                                                    |
| ERR-003 | Problem Details type      | Correct documented type URI                                           |
| ERR-004 | Problem Details instance  | Identifies request occurrence                                         |
| ERR-005 | Error detail              | No SQL, stack traces, secrets, or private data                        |
| ERR-006 | 401                       | Includes `WWW-Authenticate: Bearer`                                   |
| ERR-007 | 429                       | Includes `Retry-After`                                                |
| ERR-008 | 500                       | Generic error detail and trace ID                                     |
| ERR-009 | 503                       | Generic detail and Retry-After when known                             |
| ERR-010 | 412                       | Current ETag included where caller is authorized                      |
| ERR-011 | 422 validation failure    | Machine-readable violations                                           |
| ERR-012 | 422 budget failure        | Budget scope and backend-computed values without private profile data |
| ERR-013 | 404 authorization failure | Does not reveal private plan or publication details                   |

## H. Rate limit, observability and security

| ID      | Scenario                                       | Expected                                                            |
| ------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| SEC-001 | Request exceeds configured per-user rate limit | 429 `rate-limit-exceeded`                                           |
| SEC-002 | Every request                                  | Trace/request ID generated                                          |
| SEC-003 | Error response                                 | Trace ID included in Problem Details                                |
| SEC-004 | Authorization failure                          | Structured event logged without leaking private data                |
| SEC-005 | Successful publication                         | Structured publication event logged                                 |
| SEC-006 | Idempotency replay                             | Structured replay event logged                                      |
| SEC-007 | Request processing                             | No LLM invocation                                                   |
| SEC-008 | API response                                   | No tokens, secrets, or private email addresses                      |
| SEC-009 | Logs                                           | No bearer tokens or internal secrets                                |
| SEC-010 | Idempotency replay                             | Current authorization is checked before stored response is returned |

## I. CI and test quality

| ID     | Scenario                                       | Expected                     |
| ------ | ---------------------------------------------- | ---------------------------- |
| CI-001 | All contract tests pass                        | CI green                     |
| CI-002 | Deliberately remove ownership enforcement      | Relevant test fails; CI red  |
| CI-003 | Deliberately remove budget enforcement         | Relevant test fails; CI red  |
| CI-004 | Deliberately remove idempotency protection     | Relevant test fails; CI red  |
| CI-005 | Restore implementation                         | CI green                     |
| CI-006 | Tests run through documented root command      | Reproducible result          |
| CI-007 | Tests run without real LLM or external network | Deterministic test execution |

## Acceptance criteria

- [ ] Every explicit requirement in Section 11 is covered.
- [ ] Every error type in Section 6.1 has at least one test.
- [ ] Tests assert status, content type, Problem Details type, and relevant response fields.
- [ ] Tests assert persistence side effects and absence of side effects.
- [ ] Ownership and membership are tested independently and at commit time.
- [ ] Budget rules are tested independently.
- [ ] Idempotency and concurrency behavior are tested.
- [ ] Tests use deterministic fixtures and no real LLM calls.
- [ ] Deliberate breaks demonstrate that CI catches contract violations.
- [ ] Current authorization is checked before returning an idempotency replay.
- [ ] A matching replay is not rejected by a stale current ETag.
- [ ] An already-published older revision returns its existing publication.
- [ ] 404, 412 and transient 5xx outcomes are not persisted as final idempotency results.
- [ ] Deterministic business error replay preserves original status, headers and body.
- [ ] PostgreSQL integration tests cover transaction atomicity and concurrent publication.
- [ ] Fault-injection tests cover uncertain commit outcomes.
- [ ] Every error type in Section 6.1 maps to at least one concrete test scenario.

## J. Test execution layers

| Test layer                             | Scenarios                                                                                                | What it proves                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Unit tests                             | Budget rules, ETag parsing, fingerprint generation, response mapping, service branching                  | Isolated business logic correctness                                                                               |
| NestJS E2E with in-memory repositories | HTTP contract, authentication, authorization flow, request validation, business flow, idempotency replay | API behavior and application-level integration                                                                    |
| PostgreSQL integration tests           | IDEM-012, IDEM-013, PUB-011, PUB-014, AUTH-010 commit-time race                                          | Database constraints, transaction atomicity, persistence and concurrency                                          |
| Fault-injection tests                  | IDEM-008, PUB-014                                                                                        | Recovery after uncertain commit outcomes, failures during persistence, and prevention of premature event emission |
