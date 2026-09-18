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
- Every spec is real: it runs against the app backed by dev's DynamoDB table and S3 bucket, never against mocks. Nothing in the network is mocked, with one exception: a spec may block the browser's own request to make a failure path observable (the failed-save indicator), because a person cannot make S3 fail on demand.
- Where specs run: in `e2e-dev.yml`, on every pull request into `main`, against the deployed `https://napkin.dev.sdfles.com` with `BASE_URL` and `APP_PASSWORD` from the `dev` environment; and on a developer machine against `npm run dev` with `.env.local` pointing at dev. `ci.yml` (pull requests into `develop`) runs no e2e.
- Specs run serially (`--workers=1`), behave like a person (navigate, click, type, paste, read the screen; no test-only handles, no internal state) and clean up the diagrams they create.
- A spec asserts what the user sees, not implementation details; no assertions on network payloads unless the flow is the network call itself.

## Not a user flow

- Styling and i18n changes that keep behavior.
- Refactors with identical behavior.
- Changes under `infra/`, `.github/` or `docs/`.
- Unit-level logic already covered by Vitest and not reachable through the UI.
