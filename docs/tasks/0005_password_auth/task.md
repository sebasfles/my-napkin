---
id: "0005"
title: password_auth
type: feature
branch: feat/0005_password_auth
modules: [app]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-09-18
updated: 2026-09-18
---

# 0005 Password auth

## Goal

Nothing in the app is reachable without the password: the first visit from a browser asks for it once, a valid session lasts 30 days, and every page and API route rejects requests without it. Static assets stay public.

## Scope

- `/login` page: one password field (`autocomplete="current-password"`), translated copy and error, submits to `POST /api/login`, on success redirects to the `next` path it was sent from (default `/`).
- `POST /api/login`: constant-time comparison against `APP_PASSWORD`; on success sets the session cookie; on failure waits a fixed 500 ms and answers 401 with a translated error key.
- `POST /api/logout`: clears the cookie; a logout entry in the sidebar.
- Session cookie: httpOnly, Secure outside development, SameSite=Lax, path `/`, 30 days; value is `{issuedAt, expiresAt}` signed with HMAC-SHA256 over `SESSION_SECRET` (Web Crypto, so it runs in the request gate and in route handlers alike); verification checks signature and expiry.
- Request gate (`src/proxy.ts` in Next 16, the file the TRD calls `src/middleware.ts`): everything except `/login`, `/api/login`, `/_next/*`, `/favicon.ico` and public files needs a valid cookie; pages redirect to `/login?next=<path>`, `/api/*` answers 401 JSON.
- `.env.example` documents `APP_PASSWORD` and `SESSION_SECRET`; missing either at startup fails loudly.
- Tests: unit for sign, verify, expiry and tampering, and for the gate's allowlist; e2e (no `@aws`) for wrong password, right password lands on `next`, protected page redirects, protected API returns 401, logout returns to `/login`, cookie survives reload.
- `docs/modules/app/*` updated, including the `middleware.ts` to `proxy.ts` rename in trd.md.

## Out of scope

- Username, accounts, password change or recovery, rate limiting beyond the fixed delay.
- CSRF token: SameSite=Lax plus same-origin POSTs is the protection.
- Deferred: lockout after N failures behind CloudFront (WAF costs money).

## Acceptance

1. Fresh browser on `/` or `/d/anything` lands on `/login?next=...`; `curl /api/diagrams` without cookie gets 401.
2. Wrong password: error shown, still on `/login`, response took at least 500 ms.
3. Right password: redirected to `next`, cookie set with the flags above, reload keeps the session.
4. Logout clears the cookie and the next request redirects to `/login`.
5. A cookie with a tampered payload or a past `expiresAt` is rejected.
6. `/_next/static/*` and public files load without a cookie.
7. Every behavior above has its test; `styles`, `i18n`, `e2e-worth` clean.

## Approach

- Decisions:
  - Web Crypto HMAC over a tiny JSON payload: chosen over `jose`/JWT because there are no claims to carry and no dependency needed.
  - Fixed 500 ms delay on failure and no lockout: chosen over lockout because one user cannot lock himself out of his own tool and the password length is the real defense.
  - `proxy.ts` per Next 16 convention: the TRD was written before 0001 pinned Next 16; the task corrects the docs.
  - Logout in the sidebar: chosen over no logout because a shared machine needs a way to close the session.

## Database

None.

## Infra

None new: `APP_PASSWORD` and `SESSION_SECRET` already arrive from Terraform (0003). Locally in `.env.local`.

## Design

None.

## Risks

- Next 16 request gate runtime and cookie APIs differ from the Next 15 docs most examples follow.
- The gate must not protect `/api/login` or the login page's own assets, or the app locks itself out.

## Depends on

None: no AWS needed. Touches the sidebar and `docs/modules/app/*`, which 0004 also touches; whichever lands second rebases.

## Context & decisions

Consolidated 2026-09-17 with the om-manager and Sebastian.

- Test environment: `playwright.config.ts` loads `app/.env.local` through `loadEnvConfig` from `@next/env` (already a `next` dependency, nothing to install), passes `APP_PASSWORD` and `SESSION_SECRET` to its `webServer` block, and throws a named error when either is missing (Sebastian).
  No sensitive literal enters the repo, test fixtures included; `loadEnvConfig` leaves an existing `process.env` value untouched, so the deployed run wins over the file.
- Correction 2026-09-18 (Sebastian, through the om-manager): `ci.yml` runs no e2e and holds no secret, so nothing here depends on task 0002.
  E2E runs in exactly two places: a developer machine against `npm run dev` with `app/.env.local` pointing at dev, and `e2e-dev.yml` on pull requests into `main` against the deployed dev with `BASE_URL` and `APP_PASSWORD` from the `dev` environment.
  Precondition: `app/.env.local` does not exist in this worktree and is gitignored, so Sebastian creates it with both values before the e2e block of `verify.log` can be green.
- Scope adjustment: `app/tests/e2e/helpers.ts` gains a programmatic login (`page.request.post("/api/login")`, the browser context keeps the cookie) called from `openEditor` (om-reviewer).
  Without it the gate breaks `editor.spec.ts`, `locale.spec.ts` and `theme.spec.ts`, which all reach the editor through that helper and which Scope never listed.
- The programmatic login in `openEditor` stays, even though `docs/conventions/e2e.md` now asks specs to behave like a person (Sebastian).
  It is a real request to the real route, a fixture and not a mock, and `login.spec.ts` covers the human path by typing the password; if the `e2e-worth` checker flags it, that is my let-pass and the reason is here.
- Scope adjustment: this PR also corrects the three `src/middleware.ts` mentions outside the module, at `docs/TRD.md:22`, `docs/conventions/e2e.md:13` and `docs/checks/e2e-worth.md:12` (Sebastian).
  Verified still unfixed at `origin/develop` 8241682, so all three remain this task's job.
  The dated entries at `docs/ARD.md:42` and `docs/modules/app/ard.md:27` stay as written; they are a log, not a description of the tree.
- Scope adjustment: the `@aws` tag no longer exists after 8241682, and two places still carry it, so this PR clears both (om-reviewer).
  `app/package.json:13` (`test:e2e` keeps `--grep-invert @aws`, while the verification target in `docs/TRD.md` is now a bare `npx playwright test --workers=1`) and `docs/modules/app/trd.md:76` (still says `ci.yml` runs e2e and that `@aws` specs exist).
- The missing-variable check throws from a per-request accessor, never at module import, so `next build` and `open-next build` stay green in CI where no secret exists (Sebastian).
- Acceptance adjustment, new criterion 8: `next` is accepted only as a same-origin path starting with a single `/`, never `//` or `/\`, anything else falls back to `/`, with a unit test (om-reviewer).
  Scope defines the parameter and never bounds it, and an unbounded one is an open redirect.
- `POST /api/login` answers a stable machine code on failure and the client maps it to the translated message, so the API carries no presentation (om-reviewer).
- Logout is an icon button in the sidebar's bottom control row beside the two toggles, a plain form POST answered 303 to `/login`, which keeps the sidebar a server component (om-reviewer).
- Acceptance 1 exercises `/api/diagrams`, which task 0004 owns and this branch does not have; the gate answers before routing, so the 401 is real proof and no stub route is created (om-reviewer).
- `/login` stays reachable with a valid session; redirecting an authenticated visitor to `/` is not in Scope and is not to be added (om-reviewer).

Constraints the om-developer respects:

- `src/proxy.ts` is right for Next 16.3.5 and runs on the Node runtime (`PROXY_FILENAME` in `next/dist/lib/constants.js`, `build/index.js:1605`), so Web Crypto and `node:crypto` are both available in the gate and in the route handlers.
- Token-only colors (`docs/checks/styles.md`), every string through `next-intl` in `es` and `en` (`docs/checks/i18n.md`), one spec per flow (`docs/conventions/e2e.md`).
- `.env.example` lives at `app/.env.example` and carries only this task's two variables, which keeps the rebase against 0004 small.
- Never read or edit `.env*` or `*.tfvars`, only their `.example` twins (`AGENTS.md`).
- No `Co-Authored-By`, `Claude-Session` or any other agent attribution in commits or PR text (Sebastian).
- Base branch `develop`; every `gh` call runs with `GH_TOKEN=$(gh auth token -u sebasfles)` and never `gh auth switch`.
- Only `login.spec.ts` types the password; every other spec authenticates through `page.request.post("/api/login")`, so no trace or report of the editor specs ever holds it (om-reviewer).

Checked in review beyond the Pipeline:

- The HMAC is verified over the payload string as received, never over a re-serialized object, and signatures are compared in constant time.
- The gate's allowlist is a pure unit-tested function that cannot exempt a protected path by prefix accident (`/loginx`, `/api/loginx`).
- The 500 ms delay is asserted as a lower bound with a small tolerance, so a timer firing a hair early is not a flake.
- Not preconditions of this task, carried as notes for the `deploy_workflows` draft (om-manager, 2026-09-18): no workflow uploads `playwright-report/`, `test-results/` or a trace as an artifact, since a trace records the password as it is typed; and `APP_PASSWORD` and `SESSION_SECRET` exist as repository secrets and as Dependabot secrets.

## om-developer notes

### Round 1

Built the whole Scope: `src/lib/session.ts` (sign, verify, password match), `src/lib/gate.ts` (allowlist and `next` bounding), `src/lib/env.ts` (per-request accessors), `src/proxy.ts`, `POST /api/login`, `POST /api/logout`, the `/login` page with its client form, the sidebar logout button, `app/.env.example`, the `es` and `en` copy, and the tests.
Also cleared the dead `@aws` tag in `app/package.json` and `docs/modules/app/trd.md`, and renamed the three `src/middleware.ts` mentions at `docs/TRD.md`, `docs/conventions/e2e.md` and `docs/checks/e2e-worth.md`.

Decisions this round that `Approach` and `Context & decisions` did not already record:

- `playwright.config.ts` demands `APP_PASSWORD` always and `SESSION_SECRET` only when it starts the dev server itself.
  With `BASE_URL` set the server already holds its own secret, and `e2e-dev.yml` passes only `BASE_URL` and `APP_PASSWORD`, so demanding both there would fail the promotion PR for a variable nobody needs.
- `src/proxy.ts` exports no `config.matcher`; `isPublicPath` is the single source of truth for what is public.
  A matcher would duplicate the allowlist in a place no unit test can reach, and the cost is the gate running on `/_next/*` in development only, since CloudFront serves those from the assets bucket.
- Public files are matched as a root-level path carrying an extension (`/favicon.ico`, `/robots.txt`), which is exactly what the `public/` folder serves, so `/d/anything.png` stays protected.
- The password is compared as two SHA-256 digests, byte by byte, instead of `node:crypto.timingSafeEqual`, so the gate and the route handlers run the same Web Crypto path and the comparison is constant time over a fixed 32 bytes whatever the input length.
- The session signature is checked with `crypto.subtle.verify` over the payload string exactly as received, never over a re-serialized object.
- The new components carry no `data-testid`: `login.spec.ts` finds the field by its label, the buttons by their accessible name and the error by the text on screen, which is what `docs/conventions/e2e.md` now asks for.
- `src/components/ui/input.tsx` came from `npx shadcn add input` and is kept as generated, only Prettier-formatted, per the ARD entry on the shadcn CLI.
- The past `expiresAt` half of Acceptance 5 is proved by unit tests; e2e proves the tampered payload.
  Forging an expired cookie in a spec would need `SESSION_SECRET` inside the test process, which the deployed run does not have.

Pending:

- The e2e block of `verify.log`.
  Lint, typecheck and unit are green; `app/.env.local` does not exist in this worktree and only Sebastian can create it.
  The suite itself is proved green: it was run end to end with throwaway values passed in the shell, 17 of 17 passing, without writing any file.

Deferred:

- `docs/modules/deploy/trd.md:22` still claims `ci.yml` runs "Playwright e2e without the `@aws` tag".
  It is the `deploy` module's doc and 0002's ground, so it is not touched here.
- Everything else under `docs/modules/app/` waits for `document-task` on the clean signal.
