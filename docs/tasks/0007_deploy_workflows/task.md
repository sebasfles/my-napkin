---
id: "0007"
title: deploy_workflows
type: feature
branch: feat/0007_deploy_workflows
modules: [deploy, infra]
repos: ["."]
phases: 0
depends_on: ["0002", "0003"]
ticket:
created: 2026-09-18
updated: 2026-09-18
---

# 0007 Deploy workflows

## Goal

Merging into `develop` puts the change live on `napkin.dev.sdfles.com` and opens or updates the promotion PR `develop -> main`; that PR carries the proof of the full Playwright suite run against deployed dev; merging it puts the change live on `napkin.sdfles.com`.
Sebastian never deploys by hand.

## Scope

- `.github/workflows/reusable-deploy.yml` (`workflow_call`, input `environment`): checkout, Node from `.nvmrc`, `npm ci` in `app/`, `npx open-next build`, `aws-actions/configure-aws-credentials` over OIDC with the environment's `AWS_ROLE_ARN`, zip only `.open-next/server-functions/default`, `aws lambda update-function-code --zip-file`, `aws lambda wait function-updated`, `aws s3 sync .open-next/assets` to `ASSETS_BUCKET` (`_next/static/*` immutable one year, the rest short cache), `aws cloudfront create-invalidation` on `CLOUDFRONT_DISTRIBUTION_ID`.
- `.github/workflows/deploy-dev.yml` (push to `develop`), three chained jobs:
  - `deploy`: the reusable workflow with `dev`.
  - `e2e-dev`: `npx playwright install --with-deps chromium`, `npx playwright test --workers=1` with `BASE_URL=https://napkin.dev.sdfles.com` and `APP_PASSWORD` from the `dev` environment secret; never uploads `playwright-report/` or traces as artifacts.
  - `promotion-pr`: if no open PR `develop -> main` exists, `gh pr create` with title `Promote develop to main` and a body with the compare link and the subjects of the commits not yet in `main`; if one exists, nothing (its head is `develop`, so it already carries the new commits). `pull-requests: write` only on this job.
- `.github/workflows/deploy-prd.yml` (push to `main`): the reusable workflow with `prd`, nothing else. No e2e runs against prd, ever (Sebastian, 2026-09-18); the proof is the `e2e-dev` job on the same commits before promotion.
- Concurrency group per environment, queued, never cancelled.
- `infra/docs/deploy.md`, `docs/modules/deploy/*` and the repo README updated to this design: no `e2e-dev.yml`, no `@aws` tag, how a change reaches prd.

## Out of scope

- Terraform resources (0003).
- Creating the Actions environments `dev` and `prd`, their four variables and the `dev` secret `APP_PASSWORD`: Sebastian, by hand, from `terraform output`, before delegation.
- Rollback automation: a rollback is a revert PR through the same flow (Sebastian, 2026-09-17).
- Deferred: a `workflow_dispatch` that redeploys a given `main` SHA to prd, only if a revert ever proves too slow.
- Deferred: an artifacts bucket and `--s3-bucket` upload if the server bundle ever exceeds the 50 MB `--zip-file` cap.
- The warmer bundle (draft `lambda_warmer`).
- Any e2e, smoke or Playwright run against `napkin.sdfles.com` (prd).

## Acceptance

1. A merge into `develop` ends with the change live on `napkin.dev.sdfles.com` and an open PR `develop -> main`, or the existing one carrying the new commits.
2. That PR shows `ci` and `e2e-dev` green on its head; `e2e-dev` logged in on dev and ran the whole suite; a failing suite leaves the PR blocked by the `main` ruleset.
3. Merging it ends with the change live on `napkin.sdfles.com`.
4. No access key anywhere; both deploys assume roles by OIDC.
5. A deploy takes under 5 minutes.
6. `actionlint` passes on every workflow file.

## Approach

- Module and layers touched: `deploy` (three workflow files), `infra` docs only (`infra/docs/deploy.md`).
- Decisions:
  - One `deploy-dev.yml` with `deploy -> e2e-dev -> promotion-pr`: chosen over a separate `e2e-dev.yml` on `pull_request` because a PR created with `GITHUB_TOKEN` does not trigger `pull_request` workflows and a `pull_request` run would race the deploy. The checks attach to `develop`'s head commit, which is the PR head, so the `main` ruleset (0003) keeps requiring `ci` and `e2e-dev` unchanged; `ci.yml` (0002) already runs on pull requests into `main`. Sebastian, 2026-09-18.
  - Acceptance 1 to 5 are proven on the first merge into `develop` and the first promotion, not in the PR: the deploy roles trust only `refs/heads/develop` and `refs/heads/main`, so nothing runs end to end from the task branch. The PR proves `actionlint`, a workflow review and a local `npx open-next build` producing `.open-next/server-functions/default` and `.open-next/assets`; the om-reviewer states this in the PR's Risk assessment. Sebastian, 2026-09-18.
  - Direct `--zip-file` upload: chosen over an artifacts bucket because the bundle is far under 50 MB today.
  - Promotion PR body from `GITHUB_TOKEN`: chosen over a PAT or App token because nothing needs the PR creation to trigger a workflow anymore.
  - Fork pull requests into `main` run none of this and receive no secret; e2e runs only from `develop`'s own push.

## Database

None.

## Infra

- GitHub Actions environments `dev` and `prd`, each with variables `AWS_ROLE_ARN`, `LAMBDA_FUNCTION_NAME`, `ASSETS_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`; `dev` also holds secret `APP_PASSWORD`, equal to `app_password` in dev's `terraform.tfvars`. Set by hand by Sebastian; not Terraform (ARD debt).
- AWS: nothing new; consumes the deploy roles, buckets, functions and distributions from 0003.

## Design

None.

## Risks

- OpenNext 4.1.5 output layout (path of the server function). Note from 0001: upload only `server-functions/default` and `assets`, never the whole `.open-next/`.
- The first deploy replaces the bootstrap Lambda; acceptance 1 only passes once code and assets are both in.
- `e2e-dev` runs after every push to `develop`, so a flaky spec blocks promotion; specs are serial and real by convention (`docs/conventions/e2e.md`).

## Depends on

0002_ci_workflow (owns `ci.yml` and shares `.github/workflows/`), 0003_terraform_environments (applied in dev, core and prd, with the Actions environments filled from its outputs).

## Context & decisions

Consolidated 2026-09-18 with Sebastian through the om-manager.

### Decisions

- Base: 0007 is not delegated until PR #2 (0002) and 0003 are merged into `develop`, and the branch is rebased on `develop` at delegation (Sebastian). Everything below assumes that base, where `.github/workflows/ci.yml`, `infra/docs/deploy.md` and the deploy docs rewritten by 0002 exist.
- `aws lambda wait function-updated-v2`, not `function-updated` as Scope words it (om-reviewer). The plain waiter polls `GetFunctionConfiguration` and the deploy role grants only `lambda:UpdateFunctionCode` and `lambda:GetFunction` (`infra/stacks/app/github_actions.tf`), so it would fail with AccessDenied on the first real deploy, after this PR is merged.
- `aws s3 sync` never with `--delete` (om-reviewer): the role has no `s3:DeleteObject`, and old `_next/static` chunks must outlive a deploy for sessions already open.
- Concurrency declared at workflow level in each caller, `cancel-in-progress: false` (om-reviewer). GitHub still drops an older pending run when a newer one queues, so "never cancelled" holds for the run in flight only; accepted, the newest commit wins.

### Adjustments

- Scope, added (Sebastian): `ci.yml` gains `push: branches: [develop]` and its concurrency group stops collapsing every push run into one (`github.event.pull_request.number` is empty on push). Reason: a promotion PR created with `GITHUB_TOKEN` fires no `pull_request` run, so without this the `ci` check that `main`'s ruleset requires never lands on the PR's head and Acceptance 2 needs an admin bypass. The ruleset stays as 0003 has it.
- Scope, changed (Sebastian): `promotion-pr` uses `needs: [deploy, e2e-dev]` with `if: ${{ !cancelled() }}`, so the PR is opened or updated whatever the suite's result and carries the red check. The jobs stay ordered; only the gate on failure is lifted.
- Scope, added (om-reviewer): `docs/conventions/e2e.md` ("Where specs run") and `docs/TRD.md` (the `deploy` layout row, and the e2e line under Conventions) also name `e2e-dev.yml` and are corrected with the rest of the docs. `docs/checks/e2e-worth.md` cites the convention by path only and needs no edit.

### Constraints

- The job id stays `e2e-dev`: `infra/environments/core/github.tf` requires that exact check name on `main`.
- The caller job carries `id-token: write`; the reusable workflow's job carries `environment: ${{ inputs.environment }}` so `vars.*` and the `dev` secret resolve per environment.
- Zip from inside `.open-next/server-functions/default` so `index.mjs` sits at the zip root; a nested folder breaks the handler.
- Two `s3 sync` passes, `_next/static/*` with the immutable header first and the rest excluding it second, since `sync` skips what it already uploaded and would leave the wrong `cache-control`.
- The promotion PR body needs `fetch-depth: 0` and an explicit fetch of `main` to list the commits not yet in `main`.
- Never upload `playwright-report/` or a trace: the repo is public and a trace captures the password typed into the login form (`docs/modules/deploy/trd.md`, 0002).

### Checked beyond the Pipeline

- `npx open-next build` run locally in `app/`: the om-developer reports the command's tail and the `.open-next/` tree read from disk in its round message, and I quote it in the PR's Risk assessment.
- Acceptance 1 to 5 cannot run from this branch, since the deploy roles trust only `refs/heads/develop` and `refs/heads/main`. That build, `actionlint` and the workflow review are the whole proof this PR carries.

## om-developer notes
