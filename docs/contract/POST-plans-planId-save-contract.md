# POST /plans/{planId}/save

- **Contract status:** Proposed for team review
- **API version:** v1
- **Base path:** `/api/v1`
- **Method:** `POST`
- **Path:** `/plans/{planId}/save`
- **Purpose:** Publish a validated schedule to the group associated with the plan.
- **Important:** This document defines the proposed API contract and business decisions. The team must confirm that the authorization and lifecycle decisions match the product before implementation.

## 1. Responsibility and invariants

This endpoint publishes a plan. It does not generate a plan, edit a plan, run the AI agent, or calculate costs.

The backend MUST enforce all of the following:

1. A plan MUST belong to the authenticated user making the request.
2. The plan MUST be associated with a group, and the caller MUST still be an active member of that group.
3. The plan MUST be in a saveable state and MUST have passed the backend validator for its current revision.
4. The validator result MUST correspond to the exact plan revision being saved. A result for an older revision MUST NOT authorize publication.
5. A plan rejected by the validator MUST NOT be published.
6. The publication operation MUST be atomic: clients must never observe a partially published plan.
7. Repeating the operation MUST NOT create another publication or duplicate group-visible schedule.
8. No schedule is visible to the group before this endpoint succeeds.
9. Costs and budget checks are authoritative only when calculated by backend code. The model's own cost estimate MUST NOT be trusted.
10. The model MUST NOT receive user names or email addresses. This endpoint does not send personal data to a model.

## 2. Authentication and authorization

### Authentication

- Authentication: required.
- Scheme: `Authorization: Bearer <access-token>`.
- The access token identifies the caller as `sub` (user ID).
- Missing, expired, malformed, or invalid credentials return `401`.

### Authorization rule

The caller MUST satisfy **both** conditions:

- The caller is the `ownerId` of the requested plan.
- The caller is an active member of the `groupId` associated with that plan.

The caller's role is therefore **authenticated plan owner and active group member**. Being merely authenticated or merely a group member is insufficient.

The server MUST derive the caller identity from the verified access token. It MUST NOT accept a caller/user ID from the request body as proof of identity.

If the plan does not exist, belongs to another user, or is associated with a group of which the caller is not an active member, the server returns the same `404 plan-not-found` problem. This avoids disclosing whether another user's plan exists.

A disabled, suspended, or removed group membership does not satisfy the active-membership requirement.

## 3. Request

### 3.1 Path parameter

| Name     | Type        | Required | Rules                                                                                            |
| -------- | ----------- | -------: | ------------------------------------------------------------------------------------------------ |
| `planId` | UUID string |      Yes | Must identify a plan accessible under the authorization rule. Invalid UUID syntax returns `400`. |

### 3.2 Headers

| Header            |    Required | Rules                                                                                                                                                                                                |
| ----------------- | ----------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Authorization`   |         Yes | Bearer access token.                                                                                                                                                                                 |
| `Idempotency-Key` |         Yes | Client-generated opaque key, 1–128 printable ASCII characters. Must be unique per logical save operation and scoped to the authenticated user and endpoint. Do not reuse it for a different request. |
| `If-Match`        |         Yes | Strong ETag returned by the plan read endpoint, representing the exact plan revision the client intends to publish. Weak ETags and `*` are not accepted.                                             |
| `Content-Type`    |         Yes | `application/json`.                                                                                                                                                                                  |
| `Accept`          | Recommended | `application/json` or `application/problem+json`.                                                                                                                                                    |

The server stores the idempotency key with a fingerprint of the authenticated user, method, path, and request precondition. The retention period MUST be at least 24 hours. The server MUST document and configure the actual retention period before release; 24 hours is the minimum contract guarantee.

### 3.3 Request body

No request body is accepted. Send an empty body.

The plan content, group association, revision, validator result, and cost breakdown are read from server-side records. A client MUST NOT submit replacement plan data, a `userId`, a `groupId`, a `validatorPassed` flag, or a cost total to this endpoint.

A non-empty JSON body returns `400` with `invalid-request-body`.

### 3.4 Example request

```http
POST /api/v1/plans/7b3c4d5e-6f70-4a81-9b2c-3d4e5f607182/save HTTP/1.1
Host: api.example.test
Authorization: Bearer <access-token>
Idempotency-Key: 8e03978e-40d5-43e8-bc93-6894a57f9324
If-Match: "plan-7b3c4d5e-rev-12"
Content-Type: application/json
Accept: application/json
Content-Length: 0
```

## 4. Preconditions and state rules

The server evaluates the following against authoritative database state:

1. The plan exists and passes the authorization rule.
2. The supplied `If-Match` value matches the plan's current strong ETag.
3. The plan is eligible for saving (for example, it is a draft or validated draft, not deleted or archived).
4. The backend validator has a successful result for the current plan revision.
5. The plan has no unresolved validator violations.
6. The latest backend-computed cost values satisfy the applicable group total and each member's spending cap.
7. The group membership and plan ownership are still valid at commit time.

If the validator has not run for the current revision, the endpoint MUST NOT assume the plan is valid. It returns `409 plan-not-validated`; the client must request validation through the appropriate plan workflow and retry with the latest ETag.

If the validator rejects the current revision, the endpoint returns `422 plan-validation-failed` with machine-readable violations. It MUST NOT publish the plan.

The server MUST re-check the relevant preconditions inside the transaction or with equivalent concurrency control immediately before committing publication. A check performed only before starting the transaction is insufficient.

## 5. Success response

### 5.1 First successful publication

- Status: `201 Created`
- Content-Type: `application/json`
- The server creates one group-visible publication record for the plan revision and returns it.
- The response includes a `Location` header identifying the published resource.

Example:

```http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /api/v1/plans/7b3c4d5e-6f70-4a81-9b2c-3d4e5f607182/publication
ETag: "publication-91a2b3c4"
```

```json
{
  "publicationId": "91a2b3c4-d5e6-4789-a012-3456789abcde",
  "planId": "7b3c4d5e-6f70-4a81-9b2c-3d4e5f607182",
  "groupId": "2a3b4c5d-6e7f-4890-a123-456789abcdef",
  "planRevision": 12,
  "status": "published",
  "publishedAt": "2026-11-19T10:30:00.000Z",
  "validator": {
    "status": "passed",
    "validatedRevision": 12,
    "validatedAt": "2026-11-19T10:29:45.000Z",
    "violations": []
  },
  "cost": {
    "currency": "VND",
    "groupTotal": 850000,
    "groupBudget": 1000000,
    "withinGroupBudget": true
  },
  "links": {
    "self": "/api/v1/plans/7b3c4d5e-6f70-4a81-9b2c-3d4e5f607182/publication",
    "plan": "/api/v1/plans/7b3c4d5e-6f70-4a81-9b2c-3d4e5f607182"
  }
}
```

Field rules:

| Field                         | Type               | Rule                                                                           |
| ----------------------------- | ------------------ | ------------------------------------------------------------------------------ |
| `publicationId`               | UUID               | Stable ID of this publication.                                                 |
| `planId`                      | UUID               | ID of the published plan.                                                      |
| `groupId`                     | UUID               | Group that can now see the schedule.                                           |
| `planRevision`                | integer            | Exact immutable plan revision published; positive integer.                     |
| `status`                      | string             | Always `published` in this response.                                           |
| `publishedAt`                 | RFC 3339 timestamp | UTC timestamp generated by the server.                                         |
| `validator.status`            | string             | Always `passed`.                                                               |
| `validator.validatedRevision` | integer            | MUST equal `planRevision`.                                                     |
| `validator.validatedAt`       | RFC 3339 timestamp | Time of the successful validation.                                             |
| `validator.violations`        | array              | Empty on success.                                                              |
| `cost.currency`               | string             | ISO 4217 currency code; `VND` for this project.                                |
| `cost.groupTotal`             | integer            | Backend-computed total in VND; no floating-point money values.                 |
| `cost.groupBudget`            | integer or null    | Backend-stored group budget in VND; null only if the plan has no group budget. |
| `cost.withinGroupBudget`      | boolean            | Must be `true` for a successful group publication.                             |
| `links`                       | object             | Relative API links to the publication and source plan.                         |

The response MUST NOT expose access tokens, internal service secrets, model API keys, or private member email addresses.

### 5.2 Idempotent replay

When the same authenticated user repeats the same request with the same `Idempotency-Key` and the same request fingerprint:

- The server MUST NOT create another publication or emit another logical publish event.
- The server returns the original successful response body and `Location`.
- Status: `200 OK`.
- Header: `Idempotency-Replayed: true`.

If the original request is still being processed, the server returns `409 idempotency-request-in-progress` with `Retry-After` where available. The client may retry the same request with the same key.

If a client uses a different idempotency key after the same plan revision has already been published, the server returns `200 OK` with the existing publication representation and MUST NOT create a second publication.

### 5.3 Example replay response

```http
HTTP/1.1 200 OK
Content-Type: application/json
Idempotency-Replayed: true
Location: /api/v1/plans/7b3c4d5e-6f70-4a81-9b2c-3d4e5f607182/publication
```

The JSON body is the same publication representation as the original successful response.

## 6. Error responses

All errors use **RFC 9457 Problem Details** with `Content-Type: application/problem+json`.

The server MUST return the documented `type` URI and status for each error. The `status` field in the body MUST match the HTTP status. `instance` identifies the specific request occurrence. `detail` is safe for clients and MUST NOT contain stack traces, SQL, secrets, or private data.

### 6.1 Error catalogue

| HTTP status | `type` suffix                               | Meaning                                                                                                                |
| ----------: | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
|       `400` | `/problems/invalid-plan-id`                 | `planId` is not a valid UUID.                                                                                          |
|       `400` | `/problems/invalid-request-body`            | A body was sent, or the request is malformed.                                                                          |
|       `400` | `/problems/invalid-idempotency-key`         | Idempotency key is missing, malformed, or outside the allowed character/length range.                                  |
|       `401` | `/problems/unauthenticated`                 | Missing, invalid, or expired bearer token.                                                                             |
|       `404` | `/problems/plan-not-found`                  | Plan does not exist, caller is not its owner, or caller is not an active member of its group.                          |
|       `428` | `/problems/precondition-required`           | Required `If-Match` header is missing.                                                                                 |
|       `409` | `/problems/plan-not-validated`              | No successful validator result exists for the current revision.                                                        |
|       `409` | `/problems/plan-state-conflict`             | Plan is deleted, archived, already in an incompatible state, or cannot be published under its current lifecycle state. |
|       `409` | `/problems/plan-revision-conflict`          | `If-Match` does not match the current plan revision.                                                                   |
|       `409` | `/problems/idempotency-key-reused`          | The same key was previously used with a different request fingerprint.                                                 |
|       `409` | `/problems/idempotency-request-in-progress` | A request with this key is still being processed.                                                                      |
|       `422` | `/problems/plan-validation-failed`          | The backend validator rejected the current plan revision.                                                              |
|       `422` | `/problems/budget-exceeded`                 | Backend-computed group total or a member allocation exceeds the applicable budget/cap.                                 |
|       `429` | `/problems/rate-limit-exceeded`             | Caller exceeded the endpoint rate limit.                                                                               |
|       `500` | `/problems/internal-error`                  | Unexpected server error.                                                                                               |
|       `503` | `/problems/service-unavailable`             | Required persistence or validation infrastructure is temporarily unavailable.                                          |

No `403` is returned for a plan the caller does not own or a group they do not belong to; those cases intentionally use `404 plan-not-found` to avoid resource enumeration.

### 6.2 Problem Details shape

```json
{
  "type": "https://api.example.test/problems/plan-validation-failed",
  "title": "Plan validation failed",
  "status": 422,
  "detail": "The current plan revision has one or more validator violations.",
  "instance": "/api/v1/plans/7b3c4d5e-6f70-4a81-9b2c-3d4e5f607182/save",
  "code": "PLAN_VALIDATION_FAILED",
  "planId": "7b3c4d5e-6f70-4a81-9b2c-3d4e5f607182",
  "planRevision": 12,
  "violations": [
    {
      "code": "PLACE_CLOSED",
      "path": "days[0].stops[1]",
      "message": "The selected place is closed at the planned visit time."
    }
  ],
  "traceId": "01JXYZABCDEF0123456789"
}
```

`code`, `planId`, `planRevision`, `violations`, and `traceId` are extension members. They are present only where relevant. Clients MUST branch on the stable `type` or `code`, not parse the human-readable `detail`.

### 6.3 Error-specific response requirements

- `invalid-plan-id`: `400`; no database lookup is performed.
- `invalid-request-body`: `400`; response identifies that this endpoint accepts an empty body.
- `invalid-idempotency-key`: `400`; response explains the accepted key format without echoing unsafe input.
- `unauthenticated`: `401`; include `WWW-Authenticate: Bearer`.
- `precondition-required`: `428`; `If-Match` is mandatory. The client must reload the plan, obtain its current strong ETag, and retry only after user review.
- `plan-not-found`: `404`; same response for absent plan, non-owner, and non-member.
- `plan-not-validated`: `409`; include current `planRevision` when safe to disclose and instruct the client to run the validation workflow.
- `plan-state-conflict`: `409`; include a stable state code such as `PLAN_ARCHIVED` or `PLAN_ALREADY_PUBLISHED`.
- `plan-revision-conflict`: `409`; include the current ETag in the `ETag` response header so the client can reload the plan. Do not silently save the newer revision.
- `idempotency-key-reused`: `409`; client must use a new key for a genuinely new logical request.
- `idempotency-request-in-progress`: `409`; client retries the same request and same key after the indicated delay.
- `plan-validation-failed`: `422`; include machine-readable validator violations. Do not create a publication.
- `budget-exceeded`: `422`; include the affected budget/cap scope and backend-computed values, but do not expose another member's private profile data.
- `rate-limit-exceeded`: `429`; include `Retry-After`.
- `internal-error`: `500`; generic detail only, with a trace ID.
- `service-unavailable`: `503`; generic detail and `Retry-After` when known.

### 6.4 Example validation rejection

```http
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
```

```json
{
  "type": "https://api.example.test/problems/plan-validation-failed",
  "title": "Plan validation failed",
  "status": 422,
  "detail": "The current plan revision has one or more validator violations.",
  "instance": "/api/v1/plans/7b3c4d5e-6f70-4a81-9b2c-3d4e5f607182/save",
  "code": "PLAN_VALIDATION_FAILED",
  "planId": "7b3c4d5e-6f70-4a81-9b2c-3d4e5f607182",
  "planRevision": 12,
  "violations": [
    {
      "code": "GROUP_BUDGET_EXCEEDED",
      "path": "cost.groupTotal",
      "message": "The group total exceeds the configured group budget."
    }
  ],
  "traceId": "01JXYZABCDEF0123456789"
}
```

## 7. Idempotency and concurrency semantics

### Idempotency

The server MUST persist an idempotency record with at least:

- authenticated user ID;
- endpoint and plan ID;
- idempotency key;
- request fingerprint;
- processing state;
- final HTTP status, response body, and relevant headers;
- creation and expiry timestamps.

The idempotency record and publication MUST be committed atomically, or through an equivalent design that prevents duplicate publication after a process crash.

| Situation                                      | Required behavior                                                                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same key, same request, first call             | Process once; return `201` on first successful publication.                                                                                                                           |
| Same key, same request, completed retry        | Return stored response with `200` and `Idempotency-Replayed: true`.                                                                                                                   |
| Same key, different request fingerprint        | `409 idempotency-key-reused`.                                                                                                                                                         |
| Same key, request still processing             | `409 idempotency-request-in-progress`; client retries same key.                                                                                                                       |
| Different key, same revision already published | Return existing publication with `200`; do not create a second publication.                                                                                                           |
| First request failed before publication        | No publication exists. A retry with the same key follows the stored-result policy; transient failures may be retried according to the server's documented idempotency implementation. |

A client MUST generate one key per logical save action and reuse that key for retries caused by timeouts, dropped connections, or uncertain responses. A client MUST NOT generate a new key merely because it did not receive the first response.

### Concurrency

`If-Match` is required. The server MUST compare it with the current plan revision using a strong comparison. If the plan changed after the client loaded it, return `409 plan-revision-conflict`.

The server MUST serialize or otherwise safely coordinate concurrent save attempts for the same plan revision. At most one publication record may exist for a given plan revision.

## 8. State changes and publication lifecycle

### Successful save

On successful publication, the server MUST atomically:

1. confirm ownership and active group membership;
2. confirm the current plan revision and successful validator result;
3. re-check backend-computed cost and applicable budget/cap constraints;
4. create the publication record for that exact plan revision;
5. make that publication visible to authorized group members;
6. record the publication event/audit information;
7. store the idempotency result.

The schedule becomes visible to the group only after the transaction commits. A failed request MUST leave no group-visible partial publication.

### Editing after publication

A published revision is an immutable snapshot. Editing the source plan MUST create a new draft revision; it MUST NOT silently mutate the already published snapshot.

The new revision is not visible to the group until it has been validated and saved successfully. Until then, group members continue to see the last successfully published snapshot.

A later successful save publishes the new revision as the current group-visible version while preserving the previous publication as history. This endpoint does not delete historical publication records.

### Membership or ownership changes

Authorization MUST be checked at commit time. If the caller loses group membership or ownership before the publication commits, the operation MUST fail and MUST NOT publish.

Removing a member after publication does not rewrite the published snapshot. Access to the group-visible publication is governed by the group's current membership rules on subsequent reads.

### Validator result changes

A validator result is tied to a specific plan revision. Any edit that creates a new revision invalidates the previous revision's validation for save purposes. A rejected revision cannot be published until the plan is changed and the new revision passes validation.

## 9. Rate limits, observability, and security

- The endpoint is rate-limited per authenticated user. The exact numeric limit is deployment configuration and MUST be documented before production; rate-limit failures use `429`.
- Every request receives a trace/request ID. Include it as `traceId` in Problem Details.
- Record successful publication, rejected validation, authorization failure, idempotency replay, and concurrency conflict in structured server logs.
- Do not log bearer tokens, idempotency secrets if treated as sensitive, model API keys, internal service secrets, or private member data.
- Do not call the LLM from this endpoint. The validator and cost checks are deterministic backend code.
- Use a database transaction and unique constraint (or equivalent) to guarantee at most one publication per plan revision.
- Group read endpoints MUST enforce current group membership; possession of a `publicationId` is not authorization.

## 10. Client implementation guide

A client should:

1. Fetch the plan and its current ETag.
2. Ensure the user has completed the required review/confirmation flow in the application.
3. Generate a UUID idempotency key for this logical save action.
4. Send the empty-body `POST` with `Authorization`, `Idempotency-Key`, and `If-Match`.
5. On `201`, treat the returned publication as saved and group-visible.
6. On timeout or connection loss, retry with the **same** idempotency key and same `If-Match`.
7. On `200` with `Idempotency-Replayed: true`, treat the returned publication as the result of the original request.
8. On `409 plan-revision-conflict`, reload the plan and require the user to review the latest revision before trying again with a new logical save key.
9. On `409 plan-not-validated`, run the plan validation workflow; do not retry unchanged indefinitely.
10. On `422 plan-validation-failed` or `422 budget-exceeded`, show the returned violations and do not claim the plan was shared.
11. On `404 plan-not-found`, do not reveal whether the plan exists under another user's account.

## 11. Contract test requirements

The implementation is not contract-complete until automated tests cover at least:

### Success and visibility

- Owner who is an active group member can publish a valid current revision.
- First successful request returns `201`, a `Location`, and a valid publication representation.
- The publication becomes visible to authorized group members only after success.
- A failed request creates no publication and exposes no partial schedule.

### Authentication and ownership

- Missing/invalid/expired token returns `401 unauthenticated`.
- Unknown plan ID returns `404 plan-not-found`.
- Another user's plan returns the same `404 plan-not-found`.
- A caller who is not an active member of the plan's group returns the same `404 plan-not-found`.
- A removed member cannot publish.

### Request validation

- Malformed UUID returns `400 invalid-plan-id`.
- Non-empty body returns `400 invalid-request-body`.
- Missing or malformed idempotency key returns `400 invalid-idempotency-key`.
- Missing `If-Match` returns `428 precondition-required`.
- Weak or stale ETag is rejected; stale ETag returns `409 plan-revision-conflict`.

### Validator and budget

- No successful validation for current revision returns `409 plan-not-validated`.
- Validator rejection returns `422 plan-validation-failed` with violation details.
- Group budget or member cap violation returns `422 budget-exceeded`.
- A successful validation for an older revision cannot authorize publication of a newer revision.
- Model-provided cost values cannot override backend-computed values.

### Idempotency and concurrency

- Same key and same request publishes once; retry returns `200` with `Idempotency-Replayed: true`.
- Same key with a different fingerprint returns `409 idempotency-key-reused`.
- In-flight duplicate returns `409 idempotency-request-in-progress` and does not create a second publication.
- Different key for an already published revision returns the existing publication, not a duplicate.
- Two concurrent save requests for the same revision produce at most one publication.
- A simulated failure between publication creation and response delivery can be retried without duplicate publication.

### Lifecycle

- Editing after publication creates a new revision and does not mutate the prior published snapshot.
- The new revision is not group-visible until it passes validation and is saved.
- A later save makes the new revision current while retaining publication history.
- Loss of ownership or group membership before commit prevents publication.

### Error contract

- Each documented problem type is asserted for its exact HTTP status and `Content-Type: application/problem+json`.
- The body `status` equals the HTTP status.
- Clients can identify the error using `type` or `code`.
- Error responses do not leak stack traces, SQL, secrets, or private data.

## 12. Decisions the team must confirm before implementation

These are explicit product/implementation choices introduced to make the contract testable. They are not fully specified by the PA#2 rubric or Project Brief:

1. **Save permission:** this draft allows only the plan owner who is also an active group member. Confirm whether the product instead allows any active group member to publish.
2. **Plan lifecycle names:** align `draft`, `validated`, `published`, `archived`, and `deleted` with the actual backend state model.
3. **Missing `If-Match`:** this draft chooses `428 Precondition Required`; keep the implementation and tests aligned with it.
4. **Idempotency retention:** configure and document a retention period of at least 24 hours.
5. **Rate limit:** set a numeric production limit and document it.
6. **Publication read route:** confirm whether `GET /plans/{planId}/publication` is the actual route or adjust the `Location` and `links` fields.
7. **Group/member budget semantics:** confirm the exact backend rules for group total and per-member caps, and make the error extension fields match those rules.
8. **ETag format:** use the actual plan read endpoint's strong ETag format; the example in this document is illustrative.

Do not mark this contract final until these decisions are reviewed by the backend owner and product/team.
