---
id: "0010"
title: e2e_login_payload_hash
type: bug
branch: bugfix/0010_e2e_login_payload_hash
modules: [app]
repos: ["."]
phases: 0
depends_on: ["0008", "0009"]
ticket:
created: 2026-09-20
updated: 2026-09-20
---

# 0010 The e2e login helper posts to the API from outside the browser and gets 403 on deployed dev

## Goal

`e2e-dev` passes against `napkin.dev.sdfles.com`, which the first run after 0009 (run 35478504608) did not: every spec failed at `login()` with `Expected: 200, Received: 403`.

## Scope

- `app/tests/e2e/helpers.ts`: `login()` posts through Playwright's request context, which bypasses the browser's `signedFetch` of 0008, so its POST reaches CloudFront's origin access control with a body and no `x-amz-content-sha256` and is refused with 403 before the app sees it.
  The helper now opens `/login`, types the password and submits the form, as a person does, and waits to leave the login page.
- `docs/conventions/e2e.md` says that login is no exception to behaving like a person, and why; `docs/modules/app/ard.md` records that nothing posts from outside the browser.

## Out of scope

- The app, the infrastructure and the workflows: the deploy and the promotion pull request of 0009 both worked in that run.
- Any other direct request in the specs: the remaining ones are GETs without a body, which the origin access control already lets through.

## Acceptance

1. `e2e-dev` green on the next push to `develop`, with the promotion pull request carrying it on its head.
2. Locally, the helper with a wrong `APP_PASSWORD` against `BASE_URL=https://napkin.dev.sdfles.com` stays on the login page with the wrong-password message, which means the form reached the app and was answered.
3. `app` lint, typecheck and unit suite unchanged.

## Approach

Modules touched: `app` (the e2e helper only).
Confirmed the cause with `curl` before the change: a POST to `/api/login` on dev without the header answers 403, the same POST with the header answers 401.

## Database

None.

## Infra

None.

## Design

None.

## Risks

- A spec that later posts through the request context without the header passes locally against `npm run dev` and fails only in `e2e-dev`; the convention names the rule so the review catches it.

## Depends on

0008_oac_payload_hash (the header), 0009_deploy_dev_first_run (the run that first exercised the suite against deployed dev).

## Context & decisions

Developed 2026-09-20 in Sebastian's own session while monitoring the 0009 pipeline, on his instruction to treat any error it showed.

- First version signed the helper's POST with the same header the browser sends; Sebastian rejected it, since the suite must behave exactly like a user, and the helper now logs in through the form.
  The cost is one form submit per spec, about twenty per run.
- The helper selects the field and the button by `name` and `type`, not by label, because `locale.spec.ts` opens the app from a Spanish browser and the labels differ; `login.spec.ts` keeps asserting the English labels itself.
- The debt row of 0008 in `docs/ARD.md` stays: the suite is this app's own code and knows the rule; a third party still does not.

## om-developer notes

### Round 1

- `app/tests/e2e/helpers.ts`: `login()` goes to `/login`, fills the password field, submits, and expects the URL to leave `/login` within the 30s AWS ceiling.
- Verified: `npm run lint` (the one pre-existing warning in `api.ts`), `npm run typecheck`, and the helper against deployed dev with `APP_PASSWORD=not-the-password`, which now fails on the login page showing the wrong-password message, where the run failed at 403.
  The full suite could not run locally: this checkout has no `app/.env.local`, and the password is not read from anywhere else. The proof is `e2e-dev` on the push to `develop`.
