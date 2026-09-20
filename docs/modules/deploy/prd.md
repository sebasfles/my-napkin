---
updated: 2026-09-19
source: 0007_deploy_workflows
---

# deploy: product

Pull request checks and the whole deploy flow exist.

## Purpose

Sebastian is the sole developer and sole user of my-napkin.
This module ships his pushes to `main` to `napkin.sdfles.com` without him running any manual AWS command.

## User flows

### Ship a change

1. Sebastian opens a pull request into `develop`; `ci` runs lint, typecheck, unit tests, the workflow linter, and `terraform fmt -check` plus `terraform validate` on every root under `infra/environments/`.
   He reads one check, not a list.
   `ci` runs no e2e: the browser tests run after the merge, against deployed dev, which is where a page that compiles but no longer renders is caught.
2. He merges into `develop`.
   The deploy workflow builds `app/` with OpenNext, updates the dev Lambda, syncs static assets to S3 and invalidates CloudFront, and within 3 to 5 minutes the change is live at `napkin.dev.sdfles.com`.
3. The full Playwright suite then runs against that deployed dev, and the workflow opens the pull request `develop -> main` titled `Promote develop to main`, or leaves the open one alone because its head is `develop` and already carries the change.
4. Sebastian reads that pull request: `ci` and `e2e-dev` on its head commit are the proof the change works deployed. A red suite leaves it blocked by the `main` ruleset.
5. He merges it with a merge commit, and the same deploy runs against prd. Within 3 to 5 minutes the change is live at `napkin.sdfles.com`.

No browser test ever runs against prd. The proof for those commits is the `e2e-dev` run they already passed on dev.

Errors and empty states: a failing `ci` check blocks merge; a failing deploy step leaves the previous Lambda code and assets in place, so the site keeps serving the last successful deploy.
A failing suite still gets its promotion pull request opened, carrying the red check, so the broken change is visible rather than silently unpromoted.
A stalled step fails the check after 20 minutes instead of leaving the merge blocked by a check that never reports.

### Keep dependencies current

Once a week Dependabot opens pull requests against `develop` for the GitHub Actions it uses and for `app`'s npm dependencies.
Each one is gated by `ci`, so Sebastian merges the green ones and reads only the red ones.

## Rules

- Only a push to `develop` or `main` on `sebasfles/my-napkin` itself can deploy, each to its own environment; pull requests, including from forks, get no AWS credentials.
- `ci` runs on every pull request with no path filter: a check that is skipped never reports, and a required check that never reports blocks the merge forever.
- A deploy never requires a Terraform change: Terraform owns configuration, this module owns code.
- No AWS access keys are stored anywhere; authentication is OIDC only.

## Out of scope

- No staging or preview environments beyond `dev`; Terraform is applied by hand from `infra`, never from Actions.
- No rollback automation; reverting means a revert pull request through the same flow.
- No manual approval gate before the deploy workflow runs.
- No image optimization Lambda, revalidation queue or ISR cache in the OpenNext output.

## Open questions

- None.
