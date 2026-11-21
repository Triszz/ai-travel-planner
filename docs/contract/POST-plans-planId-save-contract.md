# POST /plans/{planId}/save

- **Contract status:** Updated with team-confirmed decisions; pending implementation alignment
- **API version:** v1
- **Base path:** `/api/v1`
- **Method:** `POST`
- **Path:** `/plans/{planId}/save`
- **Purpose:** Publish a validated schedule to the group associated with the plan.
- **Important:** Remaining implementation and deployment-specific details are identified in the relevant sections of this document and MUST be resolved before production deployment.

---

## 1. Responsibility and invariants

This endpoint publishes a plan. It does not generate a plan, edit a plan, run the AI agent, or calculate costs.

The backend MUST enforce all of the following:

1. A plan MUST belong to the authenticated user making the request.
2. The plan MUST be associated with a group.
3. The authenticated plan owner MUST still be an active member of the associated group when saving.
4. **Only the plan owner may save/publish the final plan.** Being another group member does not grant permission to publish another user's plan.
5. The owner MUST complete the application's required review and confirmation flow before invoking this endpoint.
6. The backend validator MUST run when this endpoint is called. The endpoint MUST validate the exact plan revision being saved before publishing it.
7. A plan rejected by the validator MUST NOT be published.
8. The validator result MUST correspond to the exact plan revision being saved. A result for an older revision MUST NOT authorize publication.
9. The publication operation MUST be atomic: clients must never observe a partially published plan.
10. Repeating the operation MUST NOT create another publication or duplicate group-visible schedule.
11. No schedule is visible to the group before this endpoint succeeds.
12. A successfully published snapshot MUST remain immutable. Editing the schedule MUST create a new plan revision instead of changing the published snapshot.
13. Costs and budget checks are authoritative only when calculated by backend code. The model's own cost estimate MUST NOT be trusted.
14. Each member's spending MUST stay within the lowest applicable spending cap in the group. The total group spending MUST stay within the group's total budget.
15. The model MUST NOT receive user names or email addresses. This endpoint does not send personal data to a model.

## 2. Authentication and authorization

### Authentication

- Authentication: required.
- Scheme: `Authorization: Bearer <access-token>`.
- The access token identifies the caller as `sub` (user ID).
- Missing, expired, malformed, or invalid credentials return `401`.

### Authorization rule

The caller MUST be the `ownerId` of the requested plan and MUST still be an active member of the associated group.

- The authenticated user's ID MUST match `plan.ownerId`.
- Only the plan owner may save/publish the final plan.
- Another group member MUST NOT save/publish the plan on behalf of its owner.
- The plan owner MUST be an active member of the associated group at the time of publication.
- A plan owner who has been removed from the associated group MUST NOT save/publish the plan.
- Being authenticated or being a member of the associated group is not sufficient without plan ownership.

The server MUST derive the caller identity from the verified access token. It MUST NOT accept a caller/user ID from the request body as proof of identity.

If the plan does not exist, belongs to another user, or the caller is no longer an active member of its associated group, the server returns the same `404 plan-not-found` problem. This avoids disclosing whether another user's plan exists or whether a particular plan is accessible.

The backend MUST re-check ownership and active group membership at commit time. A check performed only before starting the transaction is insufficient.

Group read endpoints MUST independently enforce the group's current membership rules. Permission to publish and permission to read a group publication are separate authorization checks.

## 3. Request

### 3.1 Path parameter

| Name     | Type        | Required | Rules                                                                                      |
| -------- | ----------- | -------: | ------------------------------------------------------------------------------------------ |
| `planId` | UUID string |      Yes | Must identify a plan owned by the authenticated caller. Invalid UUID syntax returns `400`. |

### 3.2 Headers

| Header            |    Required | Rules                                                                                                                                                                                                  |
| ----------------- | ----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Authorization`   |         Yes | Bearer access token.                                                                                                                                                                                   |
| `Idempotency-Key` |         Yes | Client-generated opaque key, 1–128 printable ASCII characters. Must be unique for a logical save operation and scoped to the authenticated user and endpoint. Do not reuse it for a different request. |
| `If-Match`        |         Yes | Strong ETag returned by the plan read endpoint, representing the exact plan revision the client intends to publish. Weak ETags and `*` are not accepted.                                               |
| `Content-Type`    |         Yes | `application/json`.                                                                                                                                                                                    |
| `Accept`          | Recommended | `application/json` or `application/problem+json`.                                                                                                                                                      |

The plan retrieval API MUST provide an ETag representing the current plan revision.

The client MUST send that ETag through `If-Match` when saving. The backend MUST compare it with the current plan revision and reject an attempt to publish a stale revision with `412 Precondition Failed`.

A missing `If-Match` header returns `428 Precondition Required`.

The request MUST include `Content-Type: application/json`. A missing Content-Type header or an unsupported media type returns `415 unsupported-media-type`.

The `If-Match` header MUST contain exactly one supported strong ETag.

A missing `If-Match` header returns `428 precondition-required`.

A malformed `If-Match` value, a weak ETag, a wildcard value (`*`), or multiple ETag values returns `400 invalid-if-match`.

For a new logical save request, if the revision identified by the supplied strong ETag has not already been published and the ETag does not match the current plan revision, the server returns 412 plan-revision-conflict. The existing-publication behavior in Section 5.4 is evaluated before rejecting the request solely because the plan has advanced to a newer revision.

The server stores the idempotency key with a request fingerprint. The idempotency key MUST be scoped by:

- Authenticated user ID.
- Endpoint.
- Idempotency key.

The request fingerprint MUST identify the logical request, including the HTTP method, path, and request precondition (`If-Match`).

The idempotency record MUST be retained for **24 hours**. The server MUST configure and document this retention period.

The uniqueness guarantee for a publication per plan revision MUST NOT depend on the idempotency retention period. Even after an idempotency record expires, the backend MUST NOT create a second publication for a plan revision that has already been published.

### 3.3 Request body

No request body is accepted. Send an empty body.

The Save action itself represents the owner's final confirmation. Before calling this endpoint, the application MUST provide the owner with the required review and confirmation flow, including the schedule and spending information.

The backend validator runs as part of this Save operation. A separate client-side validation call or pre-validation endpoint is not required by this contract.

The plan content, group association, revision, and cost breakdown are read from server-side records. A client MUST NOT submit replacement plan data, a `userId`, a `groupId`, a `validatorPassed` flag, or a cost total to this endpoint.

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

The ETag value above is illustrative. The actual format MUST match the strong ETag returned by the plan retrieval API.

## 4. Preconditions and state rules

The server evaluates the following against authoritative database state:

1. The plan exists and the authenticated caller is its owner.
2. The plan is associated with a group.
3. The authenticated plan owner is an active member of that group.
4. For a new logical save request, the supplied If-Match value MUST identify the current plan revision before validation and publication proceed. However, the server MUST first apply the existing-publication lookup defined in Sections 5.4 and 7. A revision that has already been published MUST return its existing publication rather than being rejected solely because the source plan has since advanced.
5. The plan is eligible for saving (for example, it is a draft or another saveable state, not deleted or archived). A plan that exists but has no valid group association required for publication MUST return `409 plan-state-conflict`. The server MUST NOT publish a plan without the required group association.
6. The backend validator accepts the exact current plan revision.
7. The plan has no unresolved validator violations.
8. The latest backend-computed cost values satisfy the applicable group total budget and per-member spending cap.
9. Plan ownership, active group membership, and the other relevant publication preconditions are still valid at commit time.

When the owner invokes Save, the backend MUST run the validator against the current plan revision. The endpoint MUST NOT rely on a validation result belonging to an older revision.

If the validator rejects the current revision, the endpoint returns `422 plan-validation-failed` with machine-readable violations. It MUST NOT publish the plan.

If the supplied ETag does not match the current plan revision and the exact revision represented by that ETag has not already been published, the endpoint returns `412 plan-revision-conflict`. If that exact revision has already been published, the server MUST return the existing publication as defined in Sections 5.4 and 7.. The client must reload the plan, allow the owner to review the latest revision and spending information, and submit a new logical save request with a new idempotency key.

If the owner is no longer an active member of the associated group, the endpoint returns `404 plan-not-found`.

The backend MUST calculate costs and validate budgets using authoritative server-side data. It MUST NOT trust cost values supplied by the client or generated by the model.

The budget rules are:

- Each member's spending MUST NOT exceed the lowest applicable spending cap in the group.
- The total group spending MUST NOT exceed the group's total budget.
- Both checks MUST pass before publication.
- A violation of either rule MUST prevent publication.

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
Location: /api/v1/groups/2a3b4c5d-6e7f-4890-a123-456789abcdef/publications/91a2b3c4-d5e6-4789-a012-3456789abcde
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
    "lowestMemberSpendingCap": 300000,
    "memberSpending": [
      {
        "memberId": "member-001",
        "amount": 290000,
        "withinCap": true
      },
      {
        "memberId": "member-002",
        "amount": 280000,
        "withinCap": true
      },
      {
        "memberId": "member-003",
        "amount": 280000,
        "withinCap": true
      }
    ],
    "withinGroupBudget": true,
    "withinMemberCaps": true
  },
  "links": {
    "self": "/api/v1/groups/2a3b4c5d-6e7f-4890-a123-456789abcdef/publications/91a2b3c4-d5e6-4789-a012-3456789abcde",
    "plan": "/api/v1/plans/7b3c4d5e-6f70-4a81-9b2c-3d4e5f607182"
  }
}
```

The IDs and numeric values in this example are illustrative. The actual response MUST use values calculated or retrieved by the backend.

Field rules:

| Field                          | Type               | Rule                                                                                            |
| ------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------- |
| `publicationId`                | UUID               | Stable ID of this publication.                                                                  |
| `planId`                       | UUID               | ID of the published plan.                                                                       |
| `groupId`                      | UUID               | Group that can now see the schedule.                                                            |
| `planRevision`                 | integer            | Exact immutable plan revision published; positive integer.                                      |
| `status`                       | string             | Always `published` in this response.                                                            |
| `publishedAt`                  | RFC 3339 timestamp | UTC timestamp generated by the server.                                                          |
| `validator.status`             | string             | Always `passed`.                                                                                |
| `validator.validatedRevision`  | integer            | MUST equal `planRevision`.                                                                      |
| `validator.validatedAt`        | RFC 3339 timestamp | Time at which the backend successfully validated this revision during the Save operation.       |
| `validator.violations`         | array              | Empty on success.                                                                               |
| `cost.currency`                | string             | ISO 4217 currency code; `VND` for this project.                                                 |
| `cost.groupTotal`              | integer            | Backend-computed total in VND; no floating-point money values.                                  |
| `cost.groupBudget`             | integer            | Backend-stored group budget in VND.                                                             |
| `cost.lowestMemberSpendingCap` | integer            | Lowest applicable member spending cap in the group, calculated by backend code.                 |
| `cost.memberSpending`          | array              | Backend-computed spending for each member, with each amount checked against the applicable cap. |
| `cost.withinGroupBudget`       | boolean            | Must be `true` for a successful group publication.                                              |
| `cost.withinMemberCaps`        | boolean            | Must be `true` for a successful group publication.                                              |
| `links`                        | object             | Relative API links to the publication and source plan.                                          |

The response MUST NOT expose access tokens, internal service secrets, model API keys, or private member email addresses.

Member identifiers and spending details MUST follow the application's privacy and group-access rules. Do not expose private profile information merely to explain a budget calculation.

### 5.2 Idempotent replay

When the same authenticated user repeats the same request with the same `Idempotency-Key` and the same request fingerprint:

- The server MUST NOT create another publication or emit another logical publish event.
- The server returns the original successful response body and `Location`.
- Status: `200 OK`.
- Header: `Idempotency-Replayed: true`.

The backend MUST store the idempotency key and the corresponding response so that retries can be handled safely.

If the original request is still being processed, the server returns `409 idempotency-request-in-progress` with `Retry-After` where available. The client may retry the same request with the same key.

A request using a different valid idempotency key for a revision that has already been published MUST follow the existing-publication behavior defined in Section 5.4. This rule also applies after the original idempotency record expires.

### 5.3 Example replay response

```http
HTTP/1.1 200 OK
Content-Type: application/json
Idempotency-Replayed: true
Location: /api/v1/groups/2a3b4c5d-6e7f-4890-a123-456789abcdef/publications/91a2b3c4-d5e6-4789-a012-3456789abcde
```

The JSON body is the same publication representation as the original successful response.

### 5.4 Existing publication with a different idempotency key

If the requested plan revision has already been successfully published and the client sends a different valid idempotency key, the server MUST return:

- Status: `200 OK`.
- The existing publication representation.
- The existing publication's `Location`.
- No new publication record.
- No duplicate logical publish event.
- No `Idempotency-Replayed: true` header.

This behavior MUST also apply after the original idempotency record expires.

The server MUST identify the requested revision represented by the supplied strong ETag and check whether that revision already has a publication before rejecting the request solely because the plan has since advanced to a newer revision.

This rule does not bypass authentication or current authorization checks.

The returned representation identifies the publication for the exact revision represented by the supplied ETag. It does not imply that this publication is the group's latest publication or current group-visible version.

## 6. Error responses

All errors use **RFC 9457 Problem Details** with `Content-Type: application/problem+json`.

The server MUST return the documented `type` URI and status for each error. The `status` field in the body MUST match the HTTP status. `instance` identifies the specific request occurrence. `detail` is safe for clients and MUST NOT contain stack traces, SQL, secrets, or private data.

### 6.1 Error catalogue

| HTTP status | `type` suffix                               | Meaning                                                                                                                                    |
| ----------: | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
|       `400` | `/problems/invalid-if-match`                | `If-Match` is malformed, weak, wildcard, or contains multiple ETag values.                                                                 |
|       `400` | `/problems/invalid-plan-id`                 | The `planId` path parameter is not a valid UUID.                                                                                           |
|       `400` | `/problems/invalid-request-body`            | The request body must be empty.                                                                                                            |
|       `400` | `/problems/invalid-idempotency-key`         | The `Idempotency-Key` is missing or does not match the accepted format.                                                                    |
|       `401` | `/problems/unauthenticated`                 | Missing, invalid, or expired bearer token.                                                                                                 |
|       `404` | `/problems/plan-not-found`                  | Plan does not exist, caller is not its owner, or caller is no longer an active member of the associated group.                             |
|       `409` | `/problems/plan-state-conflict`             | Plan exists but is deleted, archived, has no valid required group association, or is in another lifecycle state that prevents publication. |
|       `409` | `/problems/idempotency-key-reused`          | The same key was previously used with a different request fingerprint.                                                                     |
|       `409` | `/problems/idempotency-request-in-progress` | A request with this key is still being processed.                                                                                          |
|       `412` | `/problems/plan-revision-conflict`          | A valid `If-Match` condition does not identify the current saveable plan revision.                                                         |
|       `415` | `/problems/unsupported-media-type`          | Content-Type is missing or is not `application/json`.                                                                                      |
|       `422` | `/problems/plan-validation-failed`          | The backend validator rejected the current plan revision.                                                                                  |
|       `422` | `/problems/budget-exceeded`                 | Backend-computed group total or a member's spending exceeds the applicable budget/cap.                                                     |
|       `428` | `/problems/precondition-required`           | Required `If-Match` header is missing.                                                                                                     |
|       `429` | `/problems/rate-limit-exceeded`             | Caller exceeded the endpoint rate limit.                                                                                                   |
|       `500` | `/problems/internal-error`                  | Unexpected server error.                                                                                                                   |
|       `503` | `/problems/service-unavailable`             | Required persistence or validation infrastructure is temporarily unavailable.                                                              |

A `403` is not returned for a plan the caller does not own or can no longer access because of group membership. Those cases intentionally use `404 plan-not-found` to avoid resource enumeration.

A `412` is used for a failed `If-Match` precondition. The server MUST NOT return `409` for a stale ETag.

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
- `invalid-if-match`: `400`; the supplied `If-Match` value is malformed, weak, wildcard, or contains multiple ETag values. The response MUST identify the invalid precondition format without treating it as a stale revision.
- `unauthenticated`: `401`; include `WWW-Authenticate: Bearer`.
- `plan-not-found`: `404`; same response for an absent plan, a plan owned by another user, and a plan whose owner is no longer an active member of the associated group.
- `precondition-required`: `428`; `If-Match` is mandatory. The client must reload the plan, obtain its current strong ETag, and retry only after the owner has reviewed the current revision.
- `unsupported-media-type`: `415`; the request is missing Content-Type or does not use `application/json`.
- `plan-state-conflict`: `409`; include a stable state code such as `PLAN_ARCHIVED`.
- `plan-revision-conflict`: `412`; a syntactically valid strong ETag does not match the current plan revision for a new logical save request, or the plan revision changes after validation but before publication commits. Include the current ETag in the `ETag` response header where the caller is authorized to access the plan. The client must reload the plan and require the owner to review the latest revision. Do not silently save the newer revision.
- `idempotency-key-reused`: `409`; client must use a new key for a genuinely new logical request. The original idempotency record MUST remain unchanged.
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

The server MUST process a Save request in the following order:

1. Authenticate the caller.
2. Validate the request path, required headers, header syntax, content type, and empty request body. This step checks whether `If-Match` is present and syntactically valid, but MUST NOT compare it with the current plan revision.
3. Resolve the idempotency key within the authenticated user's endpoint scope.
4. If the key exists with a different request fingerprint, return `409 idempotency-key-reused`. The existing idempotency record MUST remain unchanged.
5. Re-check the caller's current ownership and active group membership before returning any stored result. If authorization no longer holds, return `404 plan-not-found`.
6. If a completed idempotency record exists with the same fingerprint:
   - If the stored result is a successful publication, return the original publication representation with `200 OK` and `Idempotency-Replayed: true`.
   - If the stored result is a deterministic business error, return the original stored HTTP status, headers, and Problem Details body. Include `Idempotency-Replayed: true`.
   - A replay MUST NOT be rejected solely because the plan's current ETag has changed since the original request.
7. For a new logical request, resolve the plan revision represented by the supplied strong ETag. If that exact revision has already been published, return the existing publication with `200 OK` as defined in Section 5.4. Do not create a duplicate publication or emit another publication event. If the server returns an existing publication for a new logical request, it MAY store the completed response under the new idempotency key to make subsequent retries deterministic. The initial response MUST NOT include Idempotency-Replayed: true. If the response is stored, a subsequent retry with the same key and fingerprint MUST follow the replay behavior defined in this section.
8. If the requested revision has not already been published, compare the supplied strong ETag with the current plan revision. A valid but stale ETag MUST return `412 plan-revision-conflict`.
9. Continue with validation, budget checks, and publication.

The idempotency key scope MUST be `(authenticatedUserId, endpoint, idempotencyKey)`.

The request fingerprint MUST include the method, path, and request precondition (`If-Match`). The server MUST reject reuse of the same key with a different fingerprint. The server MUST be able to associate a supported strong ETag with the exact plan revision it represents. This association is required to determine whether that revision has already been published, even if the source plan has since advanced to a newer revision.

The idempotency record and publication MUST be committed atomically, or through an equivalent design that prevents duplicate publication after a process crash.

| Situation                                             | Required behavior                                                                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Same key, same request, first call                    | Process once; return `201` on first successful publication.                                                                                                                    |
| Same key, same request, completed successful retry    | Return stored response with `200` and `Idempotency-Replayed: true`.                                                                                                            |
| Same key, different request fingerprint               | `409 idempotency-key-reused`; preserve the original idempotency record.                                                                                                        |
| Same key, request still processing                    | `409 idempotency-request-in-progress`; client retries the same key.                                                                                                            |
| Different key, same revision already published        | Return existing publication with `200`; do not create a second publication.                                                                                                    |
| Deterministic business error eligible for persistence | Persist the completed error response and replay its original status, headers, and body for a retry with the same key and fingerprint, subject to current authorization checks. |
| Authentication or request-envelope failure            | Do not persist an idempotency result.                                                                                                                                          |
| Transient infrastructure or server failure            | Do not persist a transient `5xx` result as a final outcome. Reconcile durable publication state before retrying if the commit outcome is uncertain.                            |

#### Idempotency failure policy

The backend MUST distinguish deterministic business outcomes from authorization failures, request-precondition failures, and transient infrastructure failures.

The backend MUST persist completed deterministic business outcomes after authentication, request-envelope validation, idempotency-key validation, current authorization checks, and If-Match evaluation have succeeded.

Eligible deterministic business outcomes include:

- `409 plan-state-conflict`.
- `422 plan-validation-failed`.
- `422 budget-exceeded`.

For the same authenticated user, endpoint, idempotency key, and request fingerprint, a retry MUST return the stored result with its original HTTP status, headers, and response body. The response MUST include `Idempotency-Replayed: true`, subject to the current authorization check.

The backend MUST NOT persist an idempotency result for:

- Missing, malformed, or invalid authentication.
- Malformed request envelopes, including invalid path parameters, unsupported media types, or invalid request bodies.
- Missing or invalid idempotency keys.
- A key reused with a different request fingerprint. This case returns `409 idempotency-key-reused` and MUST NOT overwrite the original record.
- Authorization failures, including `404 plan-not-found`.
- Request-precondition failures, including `428 precondition-required` and `412 plan-revision-conflict`.

The backend MUST NOT persist transient infrastructure failures or uncertain `5xx` outcomes as final idempotency results.

If a timeout or process failure occurs after publication may have been committed, the backend MUST reconcile durable publication and idempotency state before processing a retry. It MUST NOT create a second publication merely because the client did not receive the original response.

A client MUST generate one key per logical save action and reuse that key for retries caused by timeouts, dropped connections, or uncertain responses. A client MUST NOT generate a new key merely because it did not receive the first response.

The idempotency record MUST be retained for 24 hours. The unique publication-per-plan-revision constraint MUST remain effective independently of this retention period.

Expiration of an idempotency record MUST NOT remove the uniqueness guarantee for a successfully published revision. A request received after the record expires is processed as a new logical request, subject to the existing-publication behavior in Section 5.4.

### Concurrency

`If-Match` is required. The server MUST compare it with the current plan revision using a strong comparison.

If the plan changed after the client loaded it, the server MUST return `412 plan-revision-conflict`.

The plan retrieval API MUST return an ETag that identifies the revision represented by the returned plan data.

The server MUST serialize or otherwise safely coordinate concurrent save attempts for the same plan revision. At most one publication record may exist for a given plan revision.

## 8. State changes and publication lifecycle

### Successful save

On successful publication, the server MUST atomically:

1. Confirm that the authenticated caller owns the plan.
2. Confirm that the plan is associated with a group.
3. Confirm that the caller is still an active member of that group.
4. Confirm the current plan revision and compare it with the supplied ETag.
5. Run the backend validator against that exact plan revision.
6. Re-check backend-computed cost and applicable group/member budget constraints.
7. Create the publication record for that exact plan revision.
8. Make that publication visible to authorized group members.
9. Record the publication event/audit information.
10. Store the successful idempotency result.

The schedule becomes visible to the group only after the transaction commits. A failed request MUST leave no group-visible partial publication.

### Editing after publication

A published revision is an immutable snapshot.

Editing the source plan MUST create a new draft revision. It MUST NOT silently mutate or overwrite the already published snapshot.

The new revision is not visible to the group until it has been reviewed, validated, and saved successfully.

Until then, group members continue to see the last successfully published snapshot.

A later successful save publishes the new revision as the current group-visible version while preserving the previous publication as history. This endpoint does not delete historical publication records.

### Membership or ownership changes

The backend MUST re-check plan ownership and active group membership at commit time.

If the caller is no longer the plan owner before publication commits, the operation MUST fail with `404 plan-not-found` and MUST NOT publish.

If the plan owner is removed from the associated group before publication commits, the operation MUST fail and MUST NOT publish. The endpoint returns `404 plan-not-found`.

Removing a group member after publication does not rewrite the published snapshot. However, access to the group-visible publication is governed by the group's current membership rules on subsequent reads.

A user who is no longer an active member of the group MUST NOT read its current or historical publications through the group publication endpoint.

The group publication read endpoint MUST verify current active group membership before returning publication data.

If the caller is not an active member of the associated group, the read endpoint MUST return `404 plan-not-found`. The response MUST NOT disclose whether the publication or its source plan exists.

### Validator result changes

The validator MUST run as part of the Save operation and its result MUST be tied to the exact plan revision being published.

Any edit that creates a new revision changes the revision to be validated. A validation result for an older revision MUST NOT authorize publication of a newer revision.

If the plan revision changes after validation but before publication commits, the server MUST abort the publication attempt and return `412 plan-revision-conflict`.

No publication record, group-visible schedule, or publication event may be created from a stale validation result.

A rejected revision cannot be published. The owner must update the plan and invoke Save again after reviewing the updated schedule and spending information.

## 9. Rate limits, observability, and security

- The endpoint is rate-limited per authenticated user. The exact numeric limit is deployment configuration and MUST be documented before production; rate-limit failures use `429`.
- Every request receives a trace/request ID. Include it as `traceId` in Problem Details.
- Record successful publication, rejected validation, authorization failure, idempotency replay, and concurrency conflict in structured server logs.
- Do not log bearer tokens, idempotency secrets if treated as sensitive, model API keys, internal service secrets, or private member data.
- Do not call the LLM from this endpoint. The validator and cost checks are deterministic backend code.
- Use a database transaction and unique constraint (or equivalent) to guarantee at most one publication per plan revision.
- Group read endpoints MUST enforce current active group membership; possession of a `publicationId` is not authorization.
- The publication snapshot MUST remain immutable after creation.
- The backend MUST reconcile uncertain transaction outcomes before retrying a publication operation.
- Model API keys and internal service secrets MUST remain backend-side and MUST NOT appear in API responses.

## 10. Client implementation guide

A client should:

1. Fetch the plan and its current ETag.
2. Ensure the plan owner is an active member of the associated group.
3. Present the schedule and spending information to the owner for the required final review and confirmation.
4. Generate a UUID idempotency key for this logical Save action.
5. Send the empty-body `POST` with `Authorization`, `Idempotency-Key`, and `If-Match`.
6. On `201`, treat the returned publication as saved and group-visible.
7. On timeout or connection loss, retry with the **same** idempotency key and same `If-Match`.
8. On `200` with `Idempotency-Replayed: true`, treat the returned publication as the result of the original request.
9. On `200` without `Idempotency-Replayed: true`, treat the returned publication as the already-existing publication for that plan revision. Do not assume a new publication was created.
10. On `412 plan-revision-conflict`, reload the plan and require the owner to review the latest revision and spending information before trying again with a new logical Save key.
11. On `409 idempotency-request-in-progress`, retry the same request with the same key after the indicated delay.
12. On `409 idempotency-key-reused`, do not retry with the same key for a different request. Generate a new key only for a genuinely new logical Save action.
13. On `422 plan-validation-failed` or `422 budget-exceeded`, show the returned violations and do not claim the plan was shared.
14. On `404 plan-not-found`, do not reveal whether the plan exists under another user's account or whether the caller lost access through group membership.
15. On `428 precondition-required`, reload the plan and obtain its current ETag. Require the owner to review the current revision before submitting Save again.

## 11. Contract test requirements

The implementation is not contract-complete until automated tests cover at least:

### Success and visibility

- The plan owner can publish a valid current revision while still an active group member.
- The backend validator runs when Save is invoked.
- First successful request returns `201`, a `Location`, and a valid publication representation.
- The publication becomes visible to authorized active group members only after success.
- A failed request creates no publication and exposes no partial schedule.
- A successful publication stores an immutable snapshot of the exact plan revision.
- The publication response contains backend-computed cost and budget information.
- Successful publication requires both the group total budget and per-member spending cap checks to pass.

### Authentication and ownership

- Missing/invalid/expired token returns `401 unauthenticated`.
- Unknown plan ID returns `404 plan-not-found`.
- Another user's plan returns the same `404 plan-not-found`.
- An authenticated group member who is not the plan owner cannot publish another user's plan and receives `404 plan-not-found`.
- The plan owner who has been removed from the associated group cannot publish and receives `404 plan-not-found`.
- The Save authorization test checks both plan ownership and active group membership.
- Ownership and membership are re-checked at commit time.

### Request validation

- Malformed UUID returns `400 invalid-plan-id`.
- Non-empty body returns `400 invalid-request-body`.
- Missing or malformed idempotency key returns `400 invalid-idempotency-key`.
- Weak ETag is rejected.
- Missing `If-Match` returns `428 precondition-required`.
- Malformed `If-Match` returns `400 invalid-if-match`.
- Weak ETag returns `400 invalid-if-match`.
- Wildcard `If-Match: *` returns `400 invalid-if-match`.
- Multiple ETag values in `If-Match` return `400 invalid-if-match`.
- Missing Content-Type returns `415 unsupported-media-type`.
- Unsupported Content-Type returns `415 unsupported-media-type`.
- A syntactically valid strong ETag that is stale for a new logical request returns `412 plan-revision-conflict`.
- Stale ETag returns `412 plan-revision-conflict`.
- The plan retrieval API returns an ETag corresponding to the revision in its response.
- The server does not accept client-provided user IDs, group IDs, validator results, or cost totals as authoritative data.

### Validator and budget

- The validator runs as part of the Save operation.
- Validator rejection returns `422 plan-validation-failed` with violation details.
- A successful validation for an older revision cannot authorize publication of a newer revision.
- Group total exceeding the group budget returns `422 budget-exceeded`.
- A member's spending exceeding the lowest applicable member cap returns `422 budget-exceeded`.
- A plan is not published if either the group total budget or any member spending cap is exceeded.
- Model-provided cost values cannot override backend-computed values.

### Idempotency and concurrency

- Same key and same request publishes once; a successful retry returns `200` with `Idempotency-Replayed: true`.
- A successful replay is checked against current ownership and active group membership before the stored response is returned.
- A completed successful replay returns the original publication representation with `200` and `Idempotency-Replayed: true`, even if the plan's current ETag has changed.
- A completed deterministic business error is replayed with its original HTTP status, headers, and body, subject to current authorization checks.
- Authorization failures and precondition failures are not persisted as completed idempotency results.
- A different valid idempotency key for an already published revision returns `200` with the existing publication and without `Idempotency-Replayed: true`.
- A different key for an already published revision returns the existing publication even if the source plan has since advanced to a newer revision.
- An expired idempotency record does not permit a duplicate publication for the same plan revision.
- A request after idempotency-record expiration that finds an existing publication returns `200` without `Idempotency-Replayed: true`.
- Same key with a different fingerprint returns `409 idempotency-key-reused`.
- A key-reuse error does not overwrite the original idempotency record.
- In-flight duplicate returns `409 idempotency-request-in-progress` and does not create a second publication.
- Different key for an already published revision returns the existing publication with `200`, not a duplicate.
- Two concurrent save requests for the same revision produce at most one publication.
- A simulated failure between publication creation and response delivery can be retried without duplicate publication.
- Deterministic business errors are replayed according to the idempotency policy.
- Authentication and malformed request-envelope failures are not persisted as idempotency results.
- Transient `5xx` failures are not stored as final idempotency outcomes.
- An uncertain commit outcome is reconciled before a retry is processed.
- Idempotency records are retained for 24 hours.
- Publication uniqueness remains enforced after the idempotency record expires.

### Snapshot immutability and lifecycle

- Editing after publication creates a new revision and does not mutate the prior published snapshot.
- The new revision is not group-visible until it passes validation and is saved.
- A later save makes the new revision current while retaining publication history.
- A stale ETag cannot publish an older revision over a newer plan revision.
- An existing plan without the required group association returns `409 plan-state-conflict` and is not published.
- A plan that exists in a deleted or archived lifecycle state returns `409 plan-state-conflict`.
- A plan identifier that does not exist returns `404 plan-not-found`.
- If the plan revision changes after validation but before commit, Save returns `412 plan-revision-conflict` and creates no publication or publication event.
- If the caller loses plan ownership before commit, Save returns `404 plan-not-found` and creates no publication.
- Removing a member does not mutate an existing publication snapshot.
- A removed member cannot read historical publications through the group publication endpoint.

### Publication read authorization

- An active group member can read a publication belonging to that group.
- A user who is not an active member cannot read the group's publication.
- A user who is not an active member receives `404 plan-not-found` from the group publication read endpoint.
- The read endpoint does not disclose whether a publication exists when the caller is not authorized.
- Knowing or guessing a `publicationId` does not bypass group membership checks.
- The read endpoint returns the immutable published snapshot, not mutable source-plan data.

### Error contract

- Each documented problem type is asserted for its exact HTTP status and `Content-Type: application/problem+json`.
- The body `status` equals the HTTP status.
- Clients can identify the error using `type` or `code`.
- Stale `If-Match` returns `412`, not `409`.
- Missing `If-Match` returns `428`.
- Malformed, weak, wildcard, or multiple-value `If-Match` returns `400 invalid-if-match`.
- Missing or unsupported Content-Type returns `415 unsupported-media-type`.
- `invalid-if-match` and `unsupported-media-type` use their documented Problem Details `type` URIs.
- Replayed deterministic business errors preserve their original HTTP status and Problem Details body.
- Error responses do not leak stack traces, SQL, secrets, or private data.
