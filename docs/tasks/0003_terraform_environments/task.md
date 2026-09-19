---
id: "0003"
title: terraform_environments
type: feature
branch: feat/0003_terraform_environments
modules: [infra]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-09-17
updated: 2026-09-17
---

# 0003 Terraform environments

## Goal

Every AWS and GitHub resource my-napkin needs exists as Terraform under `infra/`, in three roots (core, dev, prd) following the auvral-infra and diy-infra convention, so that the deploy workflows have roles, buckets, functions and distributions to target and both branches are protected by rulesets.

## Scope

- `infra/environments/core/`: GitHub OIDC provider; GitHub provider as a GitHub App; branch rulesets for `develop` and `main` (no deletion, no force push, PR required, required checks `ci` on both and `e2e-dev` on `main`, zero approvals, repository admin bypass, merge method: merge commit only, on both branches); AWS Budgets alert when monthly cost exceeds a small threshold.
- `infra/stacks/app/`: one environment's AWS side: assets bucket (private, OAC), scenes bucket (private, versioned, CORS from `napkin.{base_domain}` plus `http://localhost:3000` in dev only, noncurrent versions expire after 30 days), DynamoDB table on-demand (PK `id`, PITR and deletion protection in prd), Lambda arm64 `nodejs24.x` 1024 MB 30 s with a bootstrap zip and `ignore_changes` on code fields, log group 14 days, Function URL `AWS_IAM` + CloudFront OAC, CloudFront distribution (price class 100, behaviors: `/_next/static/*` and public files to the assets bucket, default to the Lambda), ACM certificate validated in the existing zone, Route53 alias A and AAAA for `napkin.{base_domain}`, Lambda role with the five DynamoDB actions on the table and the three S3 actions on `scenes/*`, deploy role trusting `repo:sebasfles/my-napkin:ref:refs/heads/{branch}` (both sub shapes) with `lambda:UpdateFunctionCode`, `lambda:GetFunction`, S3 on the assets bucket, `cloudfront:CreateInvalidation`; outputs the four identifiers the workflows need.
- `infra/environments/dev/` (`base_domain = dev.sdfles.com`, branch `develop`) and `infra/environments/prd/` (`base_domain = sdfles.com`, branch `main`), each calling `stacks/app`, each with `.env.example`, `terraform.tfvars.example`, state key `{env}/terraform.tfstate`.
- `infra/modules/aws/{s3,dynamodb_table,lambda_function,cloudfront,acm}` and `infra/modules/github/branch_ruleset`, each with `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`.
- `infra/docs/setup.md` (state bucket created by hand, GitHub App creation, apply order core, dev, prd, what to copy into Actions), `infra/docs/deploy.md`, `infra/.gitignore`, `infra/README.md`.
- `docs/modules/infra/*` updated with what lands.

## Out of scope

- Workflows (task deploy_workflows).
- Setting the Actions variables and secret (Sebastian, by hand, from outputs).
- A `core` root for Terraform to write Actions variables (deferred, ARD debt).
- Deferred: rulesets name `ci` and `e2e-dev` as required checks before those workflows exist (0002, deploy_workflows); Sebastian merges with the admin bypass until they are real.

## Acceptance

1. `terraform fmt -check -recursive` and `terraform validate` pass in the three roots.
2. `terraform plan` in `dev` from a fresh clone with `.env` and `terraform.tfvars` filled shows only creations, no errors.
3. `terraform apply` in `dev` succeeds; `https://napkin.dev.sdfles.com` answers over TLS from CloudFront (the bootstrap Lambda body is acceptable); calling the Function URL directly returns 403.
4. `terraform apply` in `core` creates the OIDC provider and both rulesets; a direct push to `develop` by a non-admin is rejected, and Sebastian's is not.
5. `terraform apply` in `prd` succeeds with the same module code and only `locals.tf` differing from `dev`.
6. Outputs of each environment list role ARN, function name, assets bucket and distribution id.
7. No secret, tfstate or tfvars is tracked; `git ls-files infra` contains only `.example` twins.
8. Every resource carries `Project`, `Environment`, `ManagedBy` tags and the `napkin-{env}-` prefix; buckets append the account id.

## Approach

- Copy the shape of auvral-infra (roots, stacks, leaf modules, `lambda_function` lifecycle, `github_actions.tf` trust policy) and local-auctions' `branch_ruleset` module, scaled to one stack and no Cloudflare/Vercel.
- Decisions:
  - Who applies (Sebastian, 2026-09-17): the om-developer applies `dev` with the `personal` profile as real verification; Sebastian applies `core` and `prd` after merge.
  - The state bucket `napkin-terraform-state-975050033628` is created by the om-developer with the `personal` profile, following `infra/docs/setup.md`; the GitHub App is created by Sebastian.
  - GitHub App (private, owner sebasfles): app id `4985607`, installation id `162648841`, literals in `core/locals.tf`; the pem is `github_app_pem` in `core/terraform.tfvars`.
  - Budget alert: $5/month to `budget_notification_email`, a variable in `core/terraform.tfvars` (the address is not committed in a public repo).
  - `nodejs24.x` for the Lambda, matching `.nvmrc`; chosen over `nodejs22.x` from the original plan because the app is built and tested on 24.
  - Budget alert in `core`: chosen over no alert because the $0 target has no other guardrail.
  - Rulesets in Terraform via GitHub App: decided with Sebastian on 2026-09-17.

## Database

Provisions the `napkin-{env}-diagrams` table and both buckets; behavior owned by `app`.

## Infra

This task is the infra. Prerequisites: S3 bucket `napkin-terraform-state-975050033628` (versioned, us-east-1), created by the om-developer per `infra/docs/setup.md`; GitHub App already created by Sebastian (app id 4985607, installation id 162648841), its pem into `core/terraform.tfvars` by Sebastian.

## Design

None.

## Risks

- CloudFront OAC for Lambda Function URLs needs the `lambda:InvokeFunctionUrl` permission granted to the distribution; easy to miss and it shows as 403 from CloudFront.
- ACM validation waits on DNS; apply takes several minutes the first time.
- Ruleset required checks name workflows that do not exist yet (`e2e-dev`); with admin bypass Sebastian can still merge, and the check becomes real in deploy_workflows.
- Terraform GitHub provider permissions for rulesets fail as a bare 403 if the App lacks Administration write.

## Depends on

None. The `ci` check the rulesets require arrives with 0002; until then the admin bypass covers merges.

## Context & decisions

Consolidated 2026-09-17 with Sebastian through the om-manager.

### Decisions

- The state bucket is `napkin-terraform-state-975050033628` (Sebastian): the plain name already exists in another AWS account, so `terraform init` could never work with it.
  `docs/TRD.md#infra`, `docs/modules/infra/ard.md` and the `Infra` section above are corrected by `document-task`.
- Each `terraform.tfvars` is placed in the workspace by the om-reviewer, from values Sebastian hands over directly, once round 1 lands the `.example` twins (Sebastian).
  No agent invents the dev password: it has to match the `dev` Actions secret that `e2e-dev.yml` reads (`docs/modules/deploy/trd.md#Configuration`).
- Ruleset bypass is `actor_type = "RepositoryRole"`, `actor_id = 5`, `bypass_mode = "always"` (om-reviewer): the repo is user-owned, so the `OrganizationAdmin` actor of the `local-auctions-infra` module matches nobody.
  With `ci` and `e2e-dev` not existing yet, a bypass actor that matches nobody locks both branches with no way to merge 0002.
- The hosted zone is the literal `sdfles.com` in each root's `locals.tf` and only the record name derives from `base_domain` (om-reviewer): there is no `dev.sdfles.com` zone, so a lookup keyed on `base_domain` fails in `dev`.
- The Lambda is created from a local zip built by `data "archive_file"` into the gitignored `.placeholder.zip`, so its `ignore_changes` is `[filename, source_code_hash, publish]` (om-reviewer).
  `docs/modules/infra/ard.md` lists the S3 fields instead because `auvral-infra` ships bundles through an artifacts bucket and this task grants none; `document-task` corrects that entry and records the debt that `update-function-code --zip-file` caps at 50 MB zipped.
- The Lambda environment is exactly `APP_PASSWORD`, `SESSION_SECRET`, `DIAGRAMS_TABLE` and `SCENES_BUCKET` (om-reviewer), from `docs/modules/app/trd.md#Configuration`.
- CloudFront's static paths come from a `static_path_patterns` variable defaulting to `/_next/static/*` only (om-reviewer, corrected after 0001 merged).
  The app has no `public/` directory, no `favicon.ico` and no `robots.txt`, and a behavior pointing at a key the assets bucket does not hold answers 403 through the OAC instead of falling through to the Lambda; adding a file under `app/public/` later means adding its pattern.
- The deploy role reads the OIDC provider with `data "aws_iam_openid_connect_provider"` rather than a remote state reference to `core` (om-reviewer); the account has no provider today, so the apply order core, dev, prd holds.
- `budget_notification_email` is a tfvars variable with an `.example` twin and never a literal (Sebastian), because the repo is public; the console budget `My Zero-Spend Budget` stays untouched.

### Adjustments

- Scope, merge methods: both rulesets allow `["merge"]` only and no squash anywhere (Sebastian), replacing "squash for feature PRs and merge commit for the promotion PR".
- Scope, CORS: dev's scenes bucket also allows `http://localhost:3000` and prd only its own origin (Sebastian), because local development runs against the real bucket (`docs/TRD.md#Environments and delivery`) and scenes are written straight from the browser.
- Acceptance 1: the infra row of `docs/TRD.md#Verification targets` splits into `infra-core`, `infra-dev` and `infra-prd`, each `terraform init -backend=false` then `validate`, with `fmt -check -recursive` run once from `infra/`.
- Acceptance 4 and 5 are post-merge, applied by Sebastian: the om-developer runs `terraform plan` in `core` and never applies `core` or `prd`.
- Acceptance 5: every environment difference lives in `locals.tf`, including PITR, deletion protection and force_destroy, and both roots keep an identical `main.tf`, with no `env == "prd"` branching inside the stack.
- Acceptance 7 means no secret, tfstate or tfvars is tracked (om-reviewer, round 1): `.terraform.lock.hcl` is committed on purpose per Terraform's own recommendation, so the tracked set under `infra/` is the `.tf` files, the docs, `.gitignore`, the `.example` twins and the three lock files.
- Apply order (om-reviewer, round 1): the om-developer runs a full `plan` in `core`, then `apply -target=aws_iam_openid_connect_provider.github` and nothing else.
  `stacks/app` cannot resolve `data "aws_iam_openid_connect_provider"` before the provider exists, and Acceptance 3 is the only pre-merge proof that the CloudFront, OAC, ACM and Route53 chain works; no ruleset and no budget is created, and Sebastian's post-merge `core` apply adds them on top of that state.

### Constraints and extra review checks

- The reference repos have no precedent for the Function URL, its OAC or the budget, so those get read closely: origin type `lambda`, an `aws_lambda_permission` for `lambda:InvokeFunctionUrl` scoped to the distribution ARN, and the `AllViewerExceptHostHeader` origin request policy, whose Host header is what turns into the 403 named in `Risks`.
- The default behavior to the Lambda needs caching disabled, cookies and query strings forwarded, and POST, PATCH and DELETE allowed, or the route handlers of `docs/modules/app/trd.md` break.
- `auvral-infra/modules/aws/s3` expires current versions only, so the scenes bucket's 30 day rule needs `noncurrent_version_expiration` added to the module.
- No agent reads a tfvars or names one in a shell command, which `.claude/hooks/block-read.js` enforces; `terraform apply` auto-loads the file without naming it.
- No `Co-Authored-By`, `Claude-Session` or any other agent attribution goes into a commit or the PR, and every `gh` call on this repo runs with `GH_TOKEN=$(gh auth token -u sebasfles)`.

## om-developer notes

### Round 1

Built the whole `infra/` tree: three roots (`core`, `dev`, `prd`), the `stacks/app` composite, six leaf modules, `infra/docs/setup.md` and `deploy.md`, `infra/README.md`, `infra/.gitignore` and the `.example` twins.
`docs/TRD.md` splits the old `infra` verification row into `infra-core`, `infra-dev` and `infra-prd`, per the adjustment in `Context & decisions`.

Rebased on `origin/develop` at `7d140c2`, which had moved by four commits (0005 password auth and two docs commits).
One conflict, in the verification targets table of `docs/TRD.md`: upstream had dropped `--grep-invert @aws` from the app e2e command, so the resolution keeps upstream's app row and adds the three infra rows.

Verified: `fmt -check -recursive` and `validate` in the three roots, all green, logged in `verify.log`.

Real runs against AWS with the `personal` profile:

- `core`: `terraform init` with the real S3 backend, then a full `plan`.
  4 to add, 0 to change, 0 to destroy: the OIDC provider, the budget and one ruleset per branch.
  The GitHub provider configured and read the repository without error, so the App's credentials and its Administration permission are good.
- `dev`: `init` with the real backend, then `plan`.
  27 creations, 0 changes, 0 destroys, and no cycle between the assets bucket policy and the distribution: the policy plans as a creation and its document reads during apply.
  The only error is `data "aws_iam_openid_connect_provider"` not finding a provider that does not exist yet, exactly as `Context & decisions` predicted, and it holds back only the deploy role and its policy.

Pending, blocked on a permission denial, not on the code:

- `terraform apply -target=aws_iam_openid_connect_provider.github` in `core` is refused by this session's auto mode classifier as a blind apply, with `-auto-approve` and with `plan -out` alike.
  Without the provider, the `dev` apply cannot run either, so Acceptance 2's clean plan is proven but Acceptance 3 (`https://napkin.dev.sdfles.com` over TLS and a direct Function URL call returning 403) and Acceptance 6's four output values are still unproven.
  Reported to the om-reviewer and surfaced to Sebastian rather than worked around.

Findings 1 and 2 of the om-reviewer's round 1 message, applied before any apply so no resource has to be replaced later:

- `environments/core/locals.tf` gains `name_prefix = "napkin-${local.env}"`, and the budget and the OIDC provider tag use it.
  `core` now follows the `napkin-{env}-` prefix of `docs/TRD.md#Conventions` like `stacks/app` already did, giving `napkin-core-monthly` and `napkin-core-github-actions`.
- The deploy role's `SyncAssets` statement drops `s3:DeleteObject`.
  `docs/modules/deploy/trd.md` syncs the assets with `aws s3 sync` and no `--delete`, so nothing in the design needs it, and a workflow that later wants `--delete` adds the action with the change that needs it.

Finding 3, the verify.log blocks naming the base commit instead of the round's, is left for the post-apply run, when the final blocks can name the commit the om-reviewer reviews.

CloudFront answered 403 for every request after the first `dev` apply, with Lambda's own Function URL authorization body and no invocation ever reaching the function.
A sigv4 GET signed by hand against the Function URL returned the placeholder's `503 not deployed` and created the first log stream, which proves the function, the URL, `AWS_IAM` auth and logging all work and puts the fault on the CloudFront side.
AWS's "Restrict access to an AWS Lambda function URL origin" requires two grants to the CloudFront service principal, `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction`, both pinned to the distribution ARN, and the stack had only the first.
`stacks/app/cdn.tf` now carries `aws_lambda_permission.cdn_invoke` for the second, with the same principal and `source_arn` and no auth-type condition, so nothing but this distribution gains anything.
The `dev` plan for it is 1 to add, 0 to change, 0 to destroy.

Measured on the applied `dev` environment, all four confirmed against the deployed stack:

- `https://napkin.dev.sdfles.com/` answers `503 not deployed` over TLS through CloudFront, the placeholder body, which closes the first half of Acceptance 3.
- The Function URL called directly still answers 403, which closes the second half and proves the fix opened nothing.
- A POST through CloudFront with no `x-amz-content-sha256` header answers 403 with the body `The request signature we calculated does not match the signature you provided`.
- The same POST carrying `x-amz-content-sha256` set to the hex SHA256 of the body reaches the function and answers `503 not deployed`.

The last two are the empirical limit of OAC in front of a Function URL: a mutating request has to carry the body hash, and a viewer that computes it gets through.
That is recorded as debt on the existing Function URL decision in `docs/modules/infra/ard.md` by `document-task`, with the status codes and the signature error string, since that string is what a future reader searches for.

Decisions taken in this round that `Approach` and `Context & decisions` did not already record:

- `*.pem` is in `infra/.gitignore`.
  Neither that file nor the root `.gitignore` covered it, the repository is public, and a key dropped in a root by hand would be one `git add -A` from publication.
- The state bucket gets default AES256 encryption and no lifecycle rule expiring noncurrent versions, both written into `infra/docs/setup.md`.
  An old state version is the only remaining copy of a secret if a `terraform.tfvars` is ever lost.
- The Lambda placeholder is an inline `archive_file` answering 503 `not deployed`, so a request that reaches the function before the first real deploy says so instead of failing opaquely.
- The scenes bucket's lifecycle rule also aborts incomplete multipart uploads after 7 days, which costs nothing and stops orphaned parts from accruing storage.
- The deploy role's S3 grant splits `s3:ListBucket` on the bucket ARN from the object actions on `{arn}/*`, because `aws s3 sync` fails without the first.

Deferred, out of this task's scope:

- `.claude/hooks/block-read.js` was deleted in the worktree before this session and is restored here.
  If it is to go for real it belongs in its own change, not in this PR.
- The `core` root writes no Actions variables; Sebastian sets them by hand from the outputs, already recorded as ARD debt.
- `.github/workflows/ci.yml`, merged with 0002, validates a root only when it holds a `main.tf`, and `core` holds none because its resources live in `oidc.tf`, `github.tf` and `budget.tf`.
  CI therefore skips `infra-core` silently while `docs/TRD.md` lists it as a target.
  The fix is one line in the workflow's loop, which belongs to `deploy_workflows` and not here.

### Round 2

One finding, one line, in a file this task otherwise does not own.

`.github/workflows/ci.yml` validated a Terraform root only when it held a `main.tf`, so `core`, whose resources live in `oidc.tf`, `github.tf` and `budget.tf`, was skipped in silence while `docs/TRD.md#Verification targets` lists `infra-core` as a target.
The guard now tests for any `.tf` file in the root, `[ -n "$(find "$root" -maxdepth 1 -name '*.tf' -print -quit)" ] || continue`, so the loop follows the roots that exist instead of a naming convention.
Ran the loop locally against this layout: it now selects `core`, `dev` and `prd`, where before it selected two.

This is a deliberate one-line excursion into the `deploy` component, agreed with the om-reviewer rather than left as a note for `deploy_workflows`.
The reason is that this task is what creates a root without a `main.tf`, so it is what breaks the workflow's assumption, and a required check that reports success without running the thing it claims to check is worse than no check at all.

`npm run lint:workflows` needs `app/`'s dependencies, which this worktree had never installed, so round 2 also ran `npm ci` there.
That touches nothing tracked.
