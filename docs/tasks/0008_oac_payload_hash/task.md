---
id: "0008"
title: oac_payload_hash
type: chore
branch: chore/0008_oac_payload_hash
modules: [app, infra]
repos: ["."]
phases: 0
depends_on: ["0003", "0004"]
ticket:
created: 2026-09-18
updated: 2026-09-19
---

# 0008 OAC payload hash on mutating requests

## Goal

Every mutating request the browser sends to the app (login, create, rename, delete, touch) reaches the Lambda through CloudFront, so the deployed app works exactly as it does locally.
Today CloudFront's OAC signs the request to the Function URL without hashing the body, Lambda rejects the unsigned payload with 403, and only GET works on `napkin.dev.sdfles.com`.

## Scope

- One helper in `app/src/lib/` that wraps `fetch` for same-origin calls: computes the hex SHA-256 of the request body with WebCrypto (`crypto.subtle.digest`), the hash of the empty string when there is no body, and sets `x-amz-content-sha256`.
- Every browser call to the app's own API goes through it: `app/src/lib/api.ts` and the login form (`login-form.tsx`, already a `fetch` in `onSubmit`).
- Presigned S3 uploads and downloads stay untouched: they do not pass through CloudFront and are signed with an unsigned payload.
- A unit test for the helper: hash of a known body, hash of the empty body, header present, presigned URLs left alone.
- The debt entry "a mutating request has to carry the hash of its own body" in `docs/modules/infra/ard.md` and its row in `docs/ARD.md` are closed; `docs/modules/app/trd.md` states that browser calls to the API carry the header and why.

## Out of scope

- Any change under `infra/`: OAC stays, the Function URL stays `AWS_IAM` (Sebastian, 2026-09-18, over `NONE` and over Lambda@Edge signing).
- Deferred: Lambda@Edge signing (SST's `oac-with-edge-signing`), only if a third party ever has to POST to the app (webhooks).
- Server Actions or native form posts: the app has none and must not add any, since a browser cannot set the header on them.

## Acceptance

1. Unit tests prove the helper produces the hex SHA-256 of the body and of the empty body, and sets the header on same-origin requests only.
2. The full local Playwright suite stays green: the header is harmless without CloudFront.
3. On deployed dev, after the first deploy through 0007, login, create, rename, delete and touch succeed through `napkin.dev.sdfles.com`; `e2e-dev` on the first promotion PR is the proof.
4. No request to a presigned S3 URL carries the header.
5. The debt entry is closed in both ARD files.

## Approach

- Module and layers touched: `app` client only (`lib/api.ts`, `lib/` helper, `login-form.tsx`), docs of `app` and `infra`.
- Decisions:
  - Client-side hash: chosen over Lambda@Edge signing because we control every POST source, it adds no resource, no latency and no 1 MB body cap; chosen over `NONE` on the Function URL because that leaves the Lambda invocable outside CloudFront (cost and abuse surface). Sebastian, 2026-09-18.
  - One wrapper rather than a header per call site, so a new route cannot forget it.
  - Verification against deployed dev cannot happen from the task branch (nothing deploys until 0007 runs on `develop`); acceptance 3 is proven on the first promotion PR and the om-reviewer states it in the PR's Risk assessment.

## Database

None.

## Infra

None. Reference: `docs/modules/infra/ard.md`, "Function URL with OAC" entry, measured on dev: POST without the header answers 403, with the hex SHA-256 of the body it reaches the function.

## Design

None.

## Risks

- A request with a streamed or `FormData` body needs the body read fully before hashing; the app sends JSON only, keep it that way.
- The empty-body hash for `DELETE` without body: the AWS docs mandate the header for PUT and POST; sending it for every same-origin mutating method is the safe choice.

## Depends on

0003_terraform_environments (the ARD debt entry lives there), 0004_diagram_persistence (owns `lib/api.ts` and the call sites).

## Context & decisions

Consolidated 2026-09-18 with the om-manager and Sebastian.

- Ordering: 0008 waits for 0004 to merge, then rebases `chore/0008_oac_payload_hash` on `develop` and does the full scope (om-manager, 2026-09-18).
  `app/src/lib/api.ts` and the create, rename, delete and touch call sites do not exist on `develop@00c8b05`; they arrive with 0004.
  The om-developer starts only after that rebase, so every call site the Scope names is present.
- Insertion point: `api.ts` funnels every same-origin call through one private `call()`, and that is where the header goes.
  The direct `fetch` calls in `loadScene` and `putScene` go to presigned S3 URLs and stay untouched, which is Acceptance 4.
- Scope adjustment: logout enters Scope (Sebastian, 2026-09-18).
  `app/src/components/logout-button.tsx:9` is a native form post today, so it is the one request that cannot carry the header and would answer 403 on dev.
  `LogoutButton` becomes a client component that calls the helper and then navigates; `/api/logout` keeps the 303 contract `docs/modules/app/trd.md` documents.
- Acceptance adjustment: logout joins the flows of Acceptance 3 (Sebastian, 2026-09-18).
- Out of scope adjustment: the line claiming the app has no native form post is wrong.
  It now reads that the app has exactly one, logout, which this task removes, and that no new native form post or Server Action is added (Sebastian, 2026-09-18).
- The helper owns the same-origin test: it resolves the URL against `location.origin`, sets the header only when the origin matches, and lets a cross-origin URL through untouched (om-reviewer).
  Without that logic the "same-origin only" and "presigned URLs left alone" tests of Acceptance 1 cannot fail, and a test that cannot fail is a finding.
- The header goes on every same-origin request whatever the method, not on a method allowlist (om-reviewer).
  A method list rots the day a route is added, and the empty-string hash is correct for GET.
  GET already works on dev without the header, so the change must not break it.
- The helper throws when the body is neither absent nor a string (om-reviewer).
  Hashing a `FormData`, `Blob` or stream would not match the bytes `fetch` puts on the wire and would produce a 403 nobody can diagnose, which is the risk `task.md#Risks` names.
- Docs: close the debt entry in `docs/modules/infra/ard.md` and its row in the `docs/ARD.md` index as resolved by 0008, record the wrapper and the no-native-form-post, no-Server-Action rule as a decision in `docs/modules/app/ard.md`, and keep one narrower debt row for a third-party POST behind the OAC (Sebastian, 2026-09-18).
  The constraint survives the fix, so deleting the row alone would take its reason with it.
- Constraints: `docs/modules/infra/ard.md`, "Function URL over API Gateway as the CloudFront origin", keeps the OAC and `AWS_IAM`, so nothing under `infra/` changes.
  `docs/TRD.md` verification targets apply: for `app`, lint, typecheck, `npx vitest run` and `npx playwright test --workers=1`.
- Acceptance 3 cannot be proven on this branch, since nothing deploys until 0007 lands on `develop`.
  The proof is `e2e-dev` on the first promotion PR, and the PR's Risk assessment states it.
- Beyond the Pipeline I check: that no header reaches the two presigned S3 calls, that logout still ends on `/login` with the cookie cleared, and that the unit test asserts a known hex digest rather than re-implementing the hash next to the code under test.

## om-developer notes
