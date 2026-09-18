---
updated: 2026-09-17
source: 0002_ci_workflow
---

# deploy: architecture decisions and debt

## 2026-09-17: authenticate to AWS with OIDC, not stored access keys

- Decision: `deploy.yml` assumes an IAM role through GitHub's OIDC provider via `role-to-assume`; no AWS access keys are stored as secrets.
- Alternatives rejected: long-lived AWS access keys stored as repository secrets.
- Reason: no static credential to leak from a public repo; the role's trust policy is scoped to `repo:sebasfles/my-napkin:ref:refs/heads/main`, so a fork cannot assume it and gets no OIDC token.
- Debt created: none.
- Revisit when: never, unless GitHub OIDC itself is deprecated.
- Source: setup

## 2026-09-17: repo is public

- Decision: `sebasfles/my-napkin` is a public GitHub repository.
- Alternatives rejected: private repo.
- Reason: public repos get unlimited GitHub Actions minutes, and fixed monthly cost is the stated priority ($0/month target).
- Debt created: none, offset by the OIDC trust policy scoping deploy access to pushes on `main` of the origin repo only.
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

- Decision: the deploy role ARN, Lambda function name, assets bucket name and CloudFront distribution id are GitHub Actions variables, set by hand once from Terraform outputs after the first `apply`.
- Alternatives rejected: storing them as GitHub Actions secrets; hardcoding them in the workflow.
- Reason: none of these values are secret; Terraform is the source of truth for them and the workflow only reads them.
- Debt created: the values are set by hand once and must be updated by hand if Terraform ever recreates one of these resources with a new identifier.
- Revisit when: Terraform starts writing these outputs into the Actions environment automatically, as `auvral-infra` does.
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
  The task plan named `actions/checkout@v4`, `actions/setup-node@v4` and `hashicorp/setup-terraform@v3`; what ships is `@v7`, `@v7`, `actions/cache@v6` and `setup-terraform@v4`, the current majors.
- Alternatives rejected: pinning to commit SHAs (Dependabot can bump those too, but every PR then carries an opaque 40 character diff for a single-user repo); keeping the majors the plan wrote.
- Reason: a major tag is only as safe as it is current.
  The tags the plan named were already three, three and one majors behind and target the deprecated Node 20 runtime, so GitHub annotated every run, and `ci` is the permanent merge gate for both branches.
  The plan's own reason for choosing major tags was that Dependabot keeps them current, which argues for starting current rather than handing Dependabot four bump PRs in its first week.
- Debt created: none.
  A floating major can still break the gate on an upstream release, which is what the four red proofs and a green baseline on each Dependabot PR are for.
- Revisit when: an action ships a breaking change inside a major, or a supply chain incident makes SHA pinning worth the diff noise.
- Source: 0002_ci_workflow

## 2026-09-17: the ci e2e step carries the app's two secrets, and fork pull requests stay red

- Decision: the `End-to-end tests` step of `ci.yml`, and no other step, receives `APP_PASSWORD` and `SESSION_SECRET` from repository secrets, with no literal and no fallback value.
  The `webServer` Playwright spawns inherits the step's environment, so the test and the server it runs against are covered in one place.
  The same two values also exist as Dependabot secrets, because a Dependabot pull request never reads the repository store.
- Alternatives rejected: skipping the e2e step on pull requests whose head repository is not `sebasfles/my-napkin`, which would turn the required check green on a pull request nobody verified; an empty-string default, which would make the app fail at runtime instead of at the missing secret.
- Reason: from task 0005 the app requires both values to serve a page and to log in, so without them the e2e suite cannot run at all.
- Debt created: pull requests from forks of this public repo can no longer pass `ci`, permanently, because forks receive no secrets.
  Accepted for a repository that takes no outside contributions, where an honest red is better than a green check on unverified code.
- Permanent constraint, and the reason this decision is safe: `ci.yml` never uploads `playwright-report/` or a Playwright trace as an artifact.
  GitHub masks registered secrets in log output, but it does not mask them inside a trace or an HTML report, where a password typed into a login form is captured as an input value, and `trace: "on-first-retry"` records precisely the retried login test.
  An artifact upload would publish both secrets on a public repository, so it is never added to this workflow.
- Revisit when: the project accepts outside contributions, which would need a separate workflow for forks that runs everything except the e2e suite.
- Source: 0002_ci_workflow
