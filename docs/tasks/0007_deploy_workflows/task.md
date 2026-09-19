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
updated: 2026-09-19
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
- Terraform owns the Actions environments (Sebastian, 2026-09-19, over setting them by hand): `infra/modules/github/actions_environment` copied from diy-infra (`repository`, `environment`, `env_vars`, `env_secrets`); `infra/stacks/app` creates environment `{env}` with variables `AWS_ROLE_ARN`, `LAMBDA_FUNCTION_NAME`, `ASSETS_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID` from its own resources and secret `APP_PASSWORD` from `var.app_password`; `dev` and `prd` roots configure the `github` provider with the same App as `core`. The om-developer applies `dev` and `prd` with the `personal` profile (Sebastian, 2026-09-19). The debt rows "Four Actions variables set by hand" and "Actions variables updated by hand if Terraform recreates a resource" in `docs/ARD.md` and `docs/modules/infra/ard.md` are closed.

## Out of scope

- AWS resources (0003).
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

- GitHub Actions environments `dev` and `prd`, each with variables `AWS_ROLE_ARN`, `LAMBDA_FUNCTION_NAME`, `ASSETS_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID` and secret `APP_PASSWORD`, created by Terraform in `stacks/app` through the GitHub App; applied in `dev` and `prd` by the om-developer.
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

### Scope change 2026-09-19: Terraform owns the Actions environments

Delegation precondition of 2026-09-18 is met: branch rebased on `develop` at 698571f, with `ci.yml` and `infra/` on the base. Everything above still holds.

- The module is copied from `diy-infra` without its `lifecycle { ignore_changes = all }` (om-reviewer): nothing else manages these environments here, and ignoring every change would hide a protection rule or a variable edited by hand. The `nonsensitive(toset(keys(var.env_secrets)))` of its `for_each` is kept, since `for_each` cannot take a sensitive value.
- The App key reaches `dev` and `prd` as a `github_app_pem` variable of each root, same shape and description as `core` (om-reviewer). Reason: it mirrors `core` exactly, leaves `.env` holding only `AWS_PROFILE`, and keeps every secret inside the gitignored `terraform.tfvars` the convention allows. Cost: rotating the App key now edits three `terraform.tfvars`, recorded as debt in `docs/modules/infra/ard.md`.
- `prd` gets an `APP_PASSWORD` environment secret that nothing reads, since no e2e ever runs against prd (Scope). Let pass (om-reviewer): the shared `stacks/app` stays symmetric instead of growing a knob, and the value is already in prd's state through the Lambda's environment, so the secret adds no exposure that the 2026-09-17 Terraform decision in `docs/ARD.md` did not already record.

Constraints added:

- `terraform plan` before either apply, and stop and report if it shows anything beyond the new `github_*` resources. The worktree's `terraform.tfvars` must carry the values the environments were already applied with; a different `app_password` or `session_secret` rewrites the Lambda's environment and breaks login and `e2e-dev`.
- `stacks/app`, `dev` and `prd` all require `integrations/github ~> 6`; `dev` and `prd` declare the `github` provider with `owner` and the same `app_auth` as `core`. The refreshed `.terraform.lock.hcl` of both roots is committed, with `linux_amd64` hashes, because `ci.yml` runs `terraform init -backend=false` on `ubuntu-latest`.
- Docs: close the rows `general | Four Actions variables set by hand after the first apply` and `deploy | Actions variables updated by hand if Terraform recreates a resource` in the debt index of `docs/ARD.md`, correct the `Debt created` and `Revisit when` lines of the 2026-09-17 Terraform decision there and of "pass resource identifiers as Actions variables" in `docs/modules/deploy/ard.md`, and record the new decision in `docs/modules/infra/ard.md` and `docs/modules/deploy/ard.md`.
- The `dev` and `prd` output descriptions ("Value of the AWS_ROLE_ARN Actions variable of this environment") stop being true once Terraform sets those variables; they are reworded.
- Sebastian places `infra/environments/{dev,prd}/.env` and `infra/environments/{dev,prd}/terraform.tfvars` in this worktree. No agent reads, writes, copies or prints them.

## om-developer notes

### Round 1

Rebased on `origin/develop` at `0fa0d09` (0008 merged in the meantime; it touched `app/` and docs only, nothing under `.github/` or `infra/*.tf`, so no conflict with this work).

Written:

- `.github/workflows/reusable-deploy.yml`, `deploy-dev.yml` (`deploy` -> `e2e-dev` -> `promotion-pr`), `deploy-prd.yml`, and the `ci.yml` adjustment.
- `infra/modules/github/actions_environment/`, wired from `infra/stacks/app/github_actions.tf`, with the `github` provider added to `stacks/app`, `dev` and `prd`, and both roots' lock files refreshed.
- The docs Scope names, plus the two the om-reviewer added (`docs/conventions/e2e.md`, `docs/TRD.md`), plus three more listed under "Decisions taken" below.

Every constraint of `Context & decisions` is in the code: `function-updated-v2`, no `--delete`, workflow-level concurrency with `cancel-in-progress: false`, `environment:` on the reusable job, `id-token: write` on the caller, zip built from inside `server-functions/default`, two `s3 sync` passes, `fetch-depth: 0` plus an explicit fetch of `main`, no artifact upload, job id `e2e-dev`, `promotion-pr` under `if: ${{ !cancelled() }}`.

Decisions taken that `Approach` and `Context & decisions` did not record:

- The environment secret is written with the resource's `value`, not `plaintext_value`. Copying `diy-infra` verbatim looked wrong at first because `plaintext_value` is the attribute I expected; reading the provider source settled it: in `integrations/github` 6 both exist, and `plaintext_value` is marked `Deprecated: "Use value."`. The module keeps `value`.
- `ci.yml`'s concurrency group is `${{ github.workflow }}-${{ github.event.pull_request.number || github.sha }}`. Grouping pushes by `github.ref` would still have collapsed them into one group and let a newer push cancel an older commit's `ci`; any commit on `develop` can become the promotion pull request's head, so a cancelled run there is a required check that never reports. Per-commit grouping costs a few free runner minutes and removes that hole.
- `promotion-pr` exits early when `git rev-list --count origin/main..HEAD` is 0. Without it `gh pr create` fails with "No commits between main and develop" and paints the job red on a genuine no-op.
- The deploy logs the zip's size (`ls -lh`) after packaging. The 50 MB `--zip-file` cap is open debt whose "revisit when" is the bundle approaching it, and nothing was measuring it. Measured on this build: 4.6 MB.
- The assets sync's second pass uses `public,max-age=300,must-revalidate`. It is not a no-op: `.open-next/assets` holds `BUILD_ID` next to `_next/static/`.
- Three docs outside Scope's list were corrected because this change makes them false, each a single line: `docs/PRD.md` ("deployed automatically whenever `main` changes"), `docs/modules/app/trd.md` (e2e "in `e2e-dev.yml`"), and `docs/TRD.md`'s "Secrets exist in exactly two places" convention, which is now three, since Terraform writes `app_password` into the environment's `APP_PASSWORD` secret.
- `infra/docs/setup.md` now names the GitHub App permissions the apply needs. See "Pending" below; this is the one thing that can still block the apply.

Pending, both waiting on the om-reviewer:

- `terraform apply` in `dev` and `prd`. Not run: `infra/environments/{dev,prd}/.env` and `terraform.tfvars` are not in this worktree yet, and the om-reviewer gates the applies. `terraform plan` will be run first in each root and its summary sent before anything is applied.
- The GitHub App's repository permissions. `infra/docs/setup.md` recorded only "Administration read and write, Metadata read"; creating an environment needs Administration, and writing its variables and secret needs the Variables and Secrets permissions. I could not read the installation's grants with my own token (`/repos/.../installation` needs App auth), so this is unverified: if the App was created with only the two original permissions, the `dev` apply fails with 403 on the variables. Raised with the om-reviewer.

Deferred, not done, each out of this task's Scope:

- `app/tests/e2e/diagram-list.spec.ts:18` failed once on the first full local run of the suite and passed alone and on a warm rerun; both runs are in `verify.log`. The diff touches no file under `app/`, so it is not from this round. The cause is the local `webServer` compiling the editor route on demand past the 15s `expect` timeout, which is a local-only condition: `e2e-dev` sets `BASE_URL`, starts no server, and CI already retries once. Worth a look in an `app` task; fixing it here would mean editing a module this task does not touch.
- `docs/modules/app/ard.md` mentions `e2e-dev.yml` twice inside the Reason of two dated 2026-09-18 entries. Left alone: those are historical records of what was decided then, not statements of current layout.
