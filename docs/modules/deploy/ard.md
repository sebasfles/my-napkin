---
updated: 2026-09-19
source: 0009_deploy_dev_first_run
---

# deploy: architecture decisions and debt

## 2026-09-17: authenticate to AWS with OIDC, not stored access keys

- Decision: `deploy.yml` assumes an IAM role through GitHub's OIDC provider via `role-to-assume`; no AWS access keys are stored as secrets.
- Alternatives rejected: long-lived AWS access keys stored as repository secrets.
- Reason: no static credential to leak from a public repo; the role's trust policy is scoped to the Actions environment the deploy job runs in, `repo:sebasfles/my-napkin:environment:{env}`, and that environment admits only its branch, so a fork cannot assume it and gets no OIDC token.
  Corrected by 0009: the subject was written as `ref:refs/heads/main` until then, which is not what a job with an environment carries.
- Debt created: none.
- Revisit when: never, unless GitHub OIDC itself is deprecated.
- Source: setup

## 2026-09-17: repo is public

- Decision: `sebasfles/my-napkin` is a public GitHub repository.
- Alternatives rejected: private repo.
- Reason: public repos get unlimited GitHub Actions minutes, and fixed monthly cost is the stated priority ($0/month target).
- Debt created: none, offset by the deploy roles trusting only the `dev` and `prd` Actions environments, which admit only `develop` and `main` of the origin repo.
- Revisit when: the project needs to keep source or history private.
- Source: setup

## 2026-09-17: deploy from GitHub Actions, apply Terraform by hand

- Decision: `deploy.yml` deploys code on every push to `main`; `terraform apply` is run manually by Sebastian, never from a workflow.
- Alternatives rejected: running `terraform apply` from CI/CD alongside or instead of the code deploy.
- Reason: single environment (`prd`); keeps infrastructure changes deliberate and separate from code deploys.
- Debt created: none.
- Revisit when: a second environment is added and infra changes need review before apply.
- Source: setup

## 2026-09-17: update Lambda code directly, not through Terraform

- Decision: `deploy.yml` zips the OpenNext server output and calls `aws lambda update-function-code` directly, instead of driving the code update through a Terraform resource.
- Alternatives rejected: making the Lambda's code a Terraform-managed attribute, deployed via `terraform apply`.
- Reason: Terraform owns configuration, the workflow owns code; the Lambda resource sets `ignore_changes` on its code fields (filename, source_code_hash) so an `apply` never rolls back the deployed code, and a code deploy never needs a Terraform change.
- Debt created: none.
- Revisit when: never expected under the single-Lambda design.
- Source: setup

## 2026-09-17: pass resource identifiers as Actions variables, not secrets

- Decision: the deploy role ARN, Lambda function name, assets bucket name and CloudFront distribution id are GitHub Actions variables, not secrets and not literals in the workflow.
- Alternatives rejected: storing them as GitHub Actions secrets; hardcoding them in the workflow.
- Reason: none of these values are secret; Terraform is the source of truth for them and the workflow only reads them.
- Debt created: they were set by hand once from `terraform output`, and had to be set again by hand whenever Terraform recreated one of those resources.
- Resolved by: 0007_deploy_workflows. The variables stay variables; Terraform now writes them.
- Revisit when: never, now that the source of truth writes them itself.
- Source: setup

## 2026-09-17: run the workflow linter as an npm devDependency of app/, downloaded per run

- Decision: `actionlint` reaches CI as the `github-actionlint@1.7.12` devDependency in `app/package.json`, invoked by `npm run lint:workflows`. It fetches the official release binary from GitHub Releases on each run, authenticated with `${{ github.token }}`, and is not cached.
- Alternatives rejected: installing `actionlint` globally on the runner with a shell one-liner (undeclared, unpinned, invisible to Dependabot); the npm package named `actionlint` (a wasm library from 2022 with no `bin`, wrapping an old core); caching the downloaded binary with `actions/cache`.
- Reason: the version is pinned in a lockfile and bumped by Dependabot like every other dependency, and the same command runs locally and in CI.
  A 2 MB authenticated download costs less in runtime and in workflow size than a cache save and restore, and the token avoids the rate limit that the shared runner IP would otherwise hit.
- Debt created: `github-actionlint` depends on `adm-zip@0.5.18`, which carries GHSA-xcpc-8h2w-3j85 (high) and GHSA-vwc7-r8mq-g2x9 (moderate), both fixed in `adm-zip@0.6.1`, and `npm audit` reports no fix because the dependency's own range excludes 0.6.
  Accepted, because the vulnerable code path never executes here: `dist/lib/platform.js` picks the archive extension as `zip` only when the platform is `win32` and `tar.gz` otherwise, and `dist/lib/download.js` routes `tar.gz` to `tar` and reaches `adm-zip` only in the `zip` branch.
  On `ubuntu-latest`, and on the WSL machine the repo is developed on, the archive is always a `tar.gz`, so `adm-zip` is installed and never invoked.
  An `overrides` pin to 0.6.1 was rejected for the opposite reason: it would risk the merge gate on an untested transitive bump to fix a path we do not enter.
- Revisit when: this linter runs on Windows, or `github-actionlint` widens its `adm-zip` range.
- Source: 0002_ci_workflow

## 2026-09-17: the Terraform steps guard themselves in shell rather than with workflow conditions

- Decision: one step checks for `infra/`, exits early when it is absent, and otherwise runs `terraform fmt -check -recursive infra` and then `init -backend=false` plus `validate` for every `infra/environments/*/` that holds a `main.tf`.
- Alternatives rejected: `if: hashFiles('infra/**') != ''` on separate steps; adding the Terraform steps later, in the Terraform task.
- Reason: both states have to pass today, an absent `infra/` and a present one with no root yet, and a shell guard covers both in one place while a glob that matches nothing cannot fail the loop.
  Writing the steps now means the Terraform task inherits a check instead of authoring one alongside its first root.
- Debt created: none.
- Revisit when: a root needs a different validate invocation, such as a workspace or a variable file.
- Source: 0002_ci_workflow

## 2026-09-17: bound the ci job at 20 minutes

- Decision: the `ci` job sets `timeout-minutes: 20`.
- Alternatives rejected: GitHub's 6 hour default; a per-step timeout on each network step.
- Reason: `ci` is a required check on both rulesets, and its network steps (`npm ci`, `playwright install`, the actionlint download) bound nothing themselves, while Playwright's `webServer` timeout bounds only the dev server's start.
  A stalled step would hold the check pending with no signal and block the merge.
  20 minutes is about twice the cold-cache budget, so a healthy run never trips it.
- Debt created: none.
- Revisit when: the pipeline legitimately approaches 20 minutes, which means splitting the job before raising the number.
- Source: 0002_ci_workflow

## 2026-09-17: pin actions to a floating current major, not to a snapshot of one

- Decision: every action in `ci.yml` is pinned to its major tag at the version that is current when the workflow is written, and Dependabot carries those majors forward.
  The task plan named `actions/checkout@v4`, `actions/setup-node@v4` and `hashicorp/setup-terraform@v3`; what ships is `@v7`, `@v7` and `setup-terraform@v4`, the current majors.
- Alternatives rejected: pinning to commit SHAs (Dependabot can bump those too, but every PR then carries an opaque 40 character diff for a single-user repo); keeping the majors the plan wrote.
- Reason: a major tag is only as safe as it is current.
  The tags the plan named were already three, three and one majors behind and target the deprecated Node 20 runtime, so GitHub annotated every run, and `ci` is the permanent merge gate for both branches.
  The plan's own reason for choosing major tags was that Dependabot keeps them current, which argues for starting current rather than handing Dependabot four bump PRs in its first week.
- Debt created: none.
  A floating major can still break the gate on an upstream release, which is what the red proofs and a green baseline on each Dependabot PR are for.
- Revisit when: an action ships a breaking change inside a major, or a supply chain incident makes SHA pinning worth the diff noise.
- Source: 0002_ci_workflow

## 2026-09-18: the ci root guard follows Terraform files, not a `main.tf`

- Decision: `ci.yml` validates every `infra/environments/*/` that holds any `.tf` file, replacing the `main.tf` test of the entry above.
- Alternatives rejected: giving `core` a `main.tf` it does not need so the old guard would match it; leaving the guard alone and letting `ci` report success while skipping a root.
- Reason: `core`'s resources live in `oidc.tf`, `github.tf` and `budget.tf`, so the old guard skipped it in silence while `docs/TRD.md` lists `infra-core` as a verification target, and a required check that passes without running what it claims to check is worse than a missing check.
- Debt created: none.
- Revisit when: a root needs a different validate invocation, such as a workspace or a variable file.
- Source: 0003_terraform_environments

## 2026-09-19: one deploy-dev.yml with three jobs, not a separate e2e workflow on the promotion pull request

- Decision: `deploy-dev.yml` runs `deploy`, then `e2e-dev`, then `promotion-pr` on every push to `develop`, and `ci.yml` gains a `push: develop` trigger. The suite and the CI checks attach to the commit `develop` points at, which is the promotion pull request's head, which is what the `main` ruleset reads.
- Alternatives rejected: an `e2e-dev.yml` on `pull_request` into `main`, which is what every doc described until now.
- Reason: a pull request opened with `GITHUB_TOKEN` fires no `pull_request` event, so neither `e2e-dev` nor `ci` would ever report on that pull request and both required checks would need an admin bypass forever. A `pull_request` run would also race the deploy it is supposed to verify.
  Chaining the jobs makes the order explicit: nothing tests dev before dev has the code.
- Debt created: `e2e-dev` runs after every push to `develop`, so a flaky spec blocks promotion until it is rerun or fixed.
- Revisit when: GitHub lets a `GITHUB_TOKEN` pull request trigger workflows, or the suite grows long enough that running it on every merge costs more than it proves.
- Source: 0007_deploy_workflows

## 2026-09-19: the promotion pull request opens whatever the suite's result

- Decision: `promotion-pr` declares `needs: [deploy, e2e-dev]` with `if: ${{ !cancelled() }}`, so it opens the pull request even when the deploy or the suite failed, and the pull request carries the red check.
- Alternatives rejected: gating it on both jobs succeeding, which is the default.
- Reason: the ruleset already blocks the merge, so the gate adds no safety; what it removes is visibility. A change that broke dev is exactly the one Sebastian needs to see sitting in a pull request with a red check, rather than absent with nothing to read.
- Debt created: none. The ordering is kept; only the gate on failure is lifted.
- Revisit when: never expected.
- Source: 0007_deploy_workflows

## 2026-09-19: the repository lets `GITHUB_TOKEN` create pull requests, set from `core`

- Decision: `infra/environments/core/github.tf` declares `github_workflow_repository_permissions` with `can_approve_pull_request_reviews = true` and `default_workflow_permissions = "read"`, which is the repository setting "Allow GitHub Actions to create and approve pull requests".
- Alternatives rejected: flipping the setting by hand in the repository's Actions settings, which is undeclared and drifts, the same reason the rulesets are Terraform's; a PAT or a GitHub App token for `promotion-pr`, rejected by 0007 and still not needed.
- Reason: the first run of `deploy-dev.yml` failed at `gh pr create` with "GitHub Actions is not permitted to create or approve pull requests"; the setting defaults to off, and the provider exposes it, so the fix stays in Terraform like every other GitHub setting of this repository.
- Debt created: none.
  The token may now open and approve pull requests, but no workflow here approves anything, both rulesets require a pull request with checks, and the `main` ruleset requires `e2e-dev`.
- Revisit when: a workflow needs to approve a pull request, which is a security review and not a configuration change.
- Source: 0009_deploy_dev_first_run
