---
updated: 2026-09-17
source: add-check
---

# End-to-end tests

Playwright specs are the proof that a user flow works; a change to a user flow ships with its spec or with a written reason not to.

## What a user flow is

- A page or layout under `app/src/app/`.
- `app/src/middleware.ts`.
- A route handler under `app/src/app/api/` that the UI calls.
- The scene save and load path (debounce, presigned URLs, `updatedAt` touch).
- The login and logout path.

## Rules

- A pull request that changes a user flow adds or updates a spec under `app/tests/e2e/` that exercises that flow as the user would, or its description contains a line `No e2e: <reason>`.
- Specs are named after the flow: `app/tests/e2e/{flow}.spec.ts`, for example `login.spec.ts`, `diagram-list.spec.ts`, `save-reload.spec.ts`.
- A spec that needs a deployed environment (real DynamoDB, real S3) carries the tag `@aws` in its title and runs only in `e2e-dev.yml` against `napkin.dev.sdfles.com`; every other spec runs in `ci.yml` against a local dev server.
- Specs run serially (`--workers=1`) and clean up the diagrams they create.
- A spec asserts what the user sees, not implementation details; no assertions on network payloads unless the flow is the network call itself.

## Not a user flow

- Styling and i18n changes that keep behavior.
- Refactors with identical behavior.
- Changes under `infra/`, `.github/` or `docs/`.
- Unit-level logic already covered by Vitest and not reachable through the UI.
