---
updated: 2026-09-17
source: setup
---

# deploy: product

Planned; no code exists yet.

## Purpose

Sebastian is the sole developer and sole user of my-napkin.
This module ships his pushes to `main` to `napkin.sdfles.com` without him running any manual AWS command.

## User flows

### Ship a change

1. Sebastian opens a pull request; `ci.yml` runs lint, typecheck, unit tests, Playwright e2e, and `terraform fmt -check` / `terraform validate` on `infra/environments/prd`.
2. He merges to `main`.
3. `deploy.yml` builds `app/` with OpenNext, updates the Lambda server function, syncs static assets to S3, and invalidates CloudFront.
4. Within 3 to 5 minutes the change is live at `napkin.sdfles.com`.

Errors and empty states: a failing CI check blocks merge; a failing deploy step leaves the previous Lambda code and assets in place, so the site keeps serving the last successful deploy.

## Rules

- Only a push to `main` on `sebasfles/my-napkin` itself can deploy; pull requests, including from forks, get no AWS credentials.
- A deploy never requires a Terraform change: Terraform owns configuration, this module owns code.
- No AWS access keys are stored anywhere; authentication is OIDC only.

## Out of scope

- No staging or preview environments beyond `dev`; Terraform is applied by hand from `infra`, never from Actions.
- No rollback automation; reverting means pushing a revert commit to `main`.
- No manual approval gate before `deploy.yml` runs.
- No image optimization Lambda, revalidation queue or ISR cache in the OpenNext output.

## Open questions

- None.
