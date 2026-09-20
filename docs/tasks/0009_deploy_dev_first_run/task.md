---
id: "0009"
title: deploy_dev_first_run
type: bug
branch: bugfix/0009_deploy_dev_first_run
modules: [infra, deploy]
repos: ["."]
phases: 0
depends_on: ["0007"]
ticket:
created: 2026-09-19
updated: 2026-09-19
---

# 0009 First run of deploy-dev.yml fails on OIDC and on the promotion pull request

## Goal

A push to `develop` deploys to dev, runs `e2e-dev` and opens or refreshes the promotion pull request, which is what 0007 promised and its first real run did not deliver.
Run 35474120357 failed twice: `deploy / deploy` could not assume the dev role by OIDC, and `promotion-pr` could not create the pull request.

## Scope

- OIDC subject. 0007 put the deploy job inside the GitHub Actions environment `dev` (and `prd`), and a job with an environment gets `sub` `repo:{{owner}}/{{repo}}:environment:{{env}}` in its OIDC token, not `ref:refs/heads/{{branch}}`.
  The trust policy in `infra/stacks/app/github_actions.tf` accepts only the `ref` shape.
  Replace the `ref` subjects with the `environment` shape for both subject forms (plain and id-welded), keyed by the environment name; `git_branch` stays only if something else still reads it, otherwise it goes.
  Applied by hand in `dev` and `prd`, as every apply in this repo.
- Promotion pull request. `gh pr create` with `GITHUB_TOKEN` fails with "GitHub Actions is not permitted to create or approve pull requests" because the repository setting "Allow GitHub Actions to create and approve pull requests" is off.
  Turn it on from Terraform if the GitHub provider exposes it; if it does not, Sebastian flips it by hand and the gap is recorded as debt in `docs/modules/deploy/ard.md` with the reason.
- Docs: `docs/modules/deploy/trd.md` and `docs/modules/infra/trd.md` state the subject shape the roles trust and why; the 0007 decision "deploy roles trust only `refs/heads/develop` and `refs/heads/main`" is corrected wherever it is written.

## Out of scope

- Opening the promotion pull request with a GitHub App token or a PAT: `GITHUB_TOKEN` stays, the reasons in 0007 hold (the `push: develop` trigger on `ci.yml` already attaches the checks).
- Any change to the three jobs' order, the e2e suite or the deploy steps themselves.
- Any change to what the roles may do once assumed.

## Acceptance

1. The replication steps pass: a push to `develop` ends with `deploy`, `e2e-dev` and `promotion-pr` green in one `deploy-dev.yml` run, the change live on `napkin.dev.sdfles.com` and an open pull request `develop -> main`.
2. `terraform plan` in `dev` and `prd` shows only the trust policy change (and the repository setting, if Terraform owns it); no other resource moves.
3. A workflow run from a branch other than `develop` or `main`, or from a fork, still cannot assume either role: the subject is bound to the environment, and the environments exist only for those two branches per 0007's Terraform.
4. `actionlint` passes on every workflow file.

## Approach

- Modules touched: `infra` (primary, `stacks/app/github_actions.tf`, variables and the two environment roots), `deploy` (docs, and the repository setting if it is code).
- The om-developer runs `terraform plan` in both roots and shows the summary before anything is applied; the om-reviewer reads both plans.
- Applies are by hand from Sebastian's machine (recorded decision in `docs/ARD.md`); the om-developer asks through the om-reviewer when the plans are clean.
- The proof is the next push to `develop`: the fix cannot run end to end from the task branch, so the PR's Risk assessment says so, as 0007's did.

## Database

None.

## Infra

- IAM trust policy of `napkin-dev-deploy` and `napkin-prd-deploy`: subject condition moves from `ref:refs/heads/{{branch}}` to `environment:{{env}}`.
- GitHub repository setting "Allow GitHub Actions to create and approve pull requests": on.

## Design

None.

## Risks

- If the environment name in the trust policy and the `environment:` key in `reusable-deploy.yml` drift, every deploy fails the same way; both come from the same Terraform variable or the docs say where each lives.
- Restricting the environments themselves to their branch (deployment branch policy) is what keeps acceptance 3 true; if 0007 did not set that policy, this task adds it.

## Depends on

0007_deploy_workflows (merged; owns the workflows and the Actions environments).

## Context & decisions

Developed 2026-09-19 in Sebastian's own session, without the om-reviewer round trip; the decisions below are the ones the plan left open.

- The subject is bound to `var.env`, the same variable that names the Actions environment in `stacks/app`, so the trust policy and the environment cannot drift inside Terraform.
  The workflow side is the literal `dev` and `prd` each caller passes to `reusable-deploy.yml`; `docs/modules/deploy/trd.md` says so.
- `git_branch` stays: the role no longer reads it, the environment's deployment branch policy does.
- The deployment branch policy is added, per Risks: `gh api repos/sebasfles/my-napkin/environments` showed `deployment_branch_policy: null` on both environments, so 0007 left any branch free to reference `dev` or `prd`, and acceptance 3 held only through the old branch-bound subject this task removes.
  It is a custom branch policy with one pattern, not `protected_branches`, which reads branch protection rules and not the rulesets this repository uses.
- The repository setting is Terraform's: provider 6.13.0 exposes `github_workflow_repository_permissions`.
  It lives in `core`, next to the rulesets, because it is repository-wide.
  `default_workflow_permissions` is written as `read`, which is what the API reported, so the resource states the whole setting rather than half of it.
- The stale comment in `core/github.tf` saying the checks belong to workflows that do not exist yet goes with the edit; both workflows exist since 0007.
- Applies are Sebastian's, in the order `core`, `dev`, `prd`: the promotion pull request needs `core`, the deploy needs its environment's root.
- `docs/tasks/0007_deploy_workflows/task.md` keeps its "trust only `refs/heads/develop` and `refs/heads/main`" wording as the record of what 0007 believed; every living doc is corrected.
- Beyond the plan, four unused-variable lint warnings in `app/tests/unit/scene-save.test.ts` are cleared while the suite ran; the remaining warning, `window.location.assign` in `app/src/lib/api.ts`, is a deliberate full navigation to the login page and is left for its own decision.

## om-developer notes

### Round 1

Reproduced first: run 35474120357 shows `deploy / deploy` red at `configure-aws-credentials` and `promotion-pr` red at `gh pr create` with `GitHub Actions is not permitted to create or approve pull requests (createPullRequest)`; the repository reported `can_approve_pull_request_reviews: false` and both environments `deployment_branch_policy: null`.

Written:

- `infra/stacks/app/github_actions.tf`: both subject shapes now end in `:environment:${var.env}`; the module call passes `deployment_branch = var.git_branch`.
- `infra/stacks/app/variables.tf`: `git_branch` described as the branch admitted into the environment.
- `infra/modules/github/actions_environment/`: `deployment_branch_policy { protected_branches = false, custom_branch_policies = true }` on the environment and one `github_repository_environment_deployment_policy` with `branch_pattern = var.deployment_branch`, a new required variable.
- `infra/environments/core/github.tf`: `github_workflow_repository_permissions` with `can_approve_pull_request_reviews = true` and `default_workflow_permissions = "read"`.
- Docs: `docs/modules/infra/{README,trd,ard,prd}.md`, `docs/modules/deploy/{trd,ard}.md`, `docs/ARD.md`, `docs/TRD.md`, `infra/docs/{deploy,setup}.md`.

Verified: `terraform fmt -check -recursive` from `infra/`, `terraform validate` in `core`, `dev` and `prd`, `npm run lint:workflows`, and `app`'s lint, typecheck and unit suite (113 tests); no e2e, since nothing under `app/src/` changed and the suite runs against dev only from `deploy-dev.yml`.

Plans:

- `core`: `Plan: 1 to add, 0 to change, 0 to destroy`, the `github_workflow_repository_permissions` resource and nothing else.
- `dev` and `prd`: `Plan: 1 to add, 2 to change, 0 to destroy` each, and exactly the three resources expected: `module.app.aws_iam_role.deploy` updated in place (`assume_role_policy`, both subjects from `ref:refs/heads/{branch}` to `environment:{env}`), `module.app.module.actions_environment.github_repository_environment.this` updated in place (`deployment_branch_policy`), and `module.app.module.actions_environment.github_repository_environment_deployment_policy.this` created with `branch_pattern` `develop` and `main`.
  The `terraform.tfvars` of both roots in this checkout predated 0007 and lacked `github_app_pem`; Sebastian had the same key as `core` copied into them before the plans ran.

Applied 2026-09-19 at Sebastian's request, in the order `core`, `dev`, `prd`, each `Apply complete` with exactly its plan's counts: `1 added` in `core`, `1 added, 2 changed` in `dev` and in `prd`.

Acceptance 1 is proven by the next push to `develop`, as Approach says; acceptance 2 by the plans above; acceptance 3 by the branch policy plus the environment-bound subject; acceptance 4 by `actionlint` on the unchanged workflows.
