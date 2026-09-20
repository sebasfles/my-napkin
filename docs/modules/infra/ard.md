---
updated: 2026-09-20
source: 0013_e2e_dev_red
---

# infra: architecture and debt

## 2026-09-17: Lambda + CloudFront over Fargate + ALB for the app origin

- Decision: The Next.js server (via OpenNext) runs on a Lambda Function URL behind CloudFront, not on Fargate behind an ALB.
- Alternatives rejected: Fargate + ALB.
- Reason: an ALB costs roughly $37/month for a single task, which breaks the $0 fixed-cost target; Lambda and CloudFront both stay inside the AWS free tier for one user.
- Debt created: a cold start of 1 to 2 seconds after inactivity, accepted as a tradeoff for a single user.
- Revisit when: traffic or latency needs no longer fit a single user, or the fixed-cost target changes.
- Source: setup

## 2026-09-17: Terraform state in an S3 backend outside the repo

- Decision: state lives in bucket `napkin-terraform-state-975050033628`, one key per root (`core/`, `dev/` and `prd/terraform.tfstate`), with `use_lockfile = true`; it is never committed.
- Alternatives rejected: state committed in the repo; the plain name `napkin-terraform-state`, which already exists in another AWS account, so `terraform init` could never claim it.
- Reason: the tfstate carries the Lambda's environment variables (`app_password`, `session_secret`) in plain text, and the repo is public.
- Debt created: the state bucket is created by hand once, before the first `terraform init`; Terraform cannot create the bucket that holds its own state.
- Revisit when: never, this is the standard pattern.
- Source: setup

## 2026-09-17: GitHub OIDC over long-lived AWS access keys for deploys

- Decision: GitHub Actions authenticates to AWS through an OIDC provider and one deploy role per environment, never stored access keys.
  Each role trusts the subject of the Actions environment of the same name, `repo:sebasfles/my-napkin:environment:{env}` in both sub shapes; the 2026-09-19 entry below says why the environment and not the branch.
- Alternatives rejected: static IAM access keys as repository secrets.
- Reason: no long-lived credential to leak from a public repo; a fork cannot assume the role because the trust policy is pinned to the exact repo and environment, and the environment admits only its branch.
- Debt created: none.
- Revisit when: never.
- Source: setup

## 2026-09-17: `lifecycle ignore_changes` on the Lambda function

- Decision: the Lambda resource is created from a local zip built by `archive_file` and ignores changes to `filename`, `source_code_hash` and `publish`.
- Alternatives rejected: letting Terraform manage the deployed code on every apply; shipping the bundle through an artifacts bucket, as `auvral-infra` does, which would need a bucket this task grants nobody.
- Reason: Terraform owns the function's configuration; the GitHub Actions workflow owns its code via `update-function-code`. Without `ignore_changes`, every code deploy shows as drift on the next `plan`.
- Debt created: the first apply creates the function against a placeholder zip that answers 503 `not deployed` until the first workflow run deploys real code. With no artifacts bucket the workflow pushes the bundle inline with `update-function-code --zip-file`, which AWS caps at 50 MB zipped.
- Revisit when: never, this is the pattern already used by `auvral-infra` and `diy-infra`.
- Source: setup

## 2026-09-17: Lambda Function URL over API Gateway as the CloudFront origin

- Decision: CloudFront's non-static origin is the Lambda Function URL, with `AWS_IAM` auth and a CloudFront Origin Access Control, not an API Gateway HTTP API.
- Alternatives rejected: API Gateway HTTP API as origin.
- Reason: a Function URL is simpler and carries no per-request cost; the OAC stops the URL from being called directly, bypassing CloudFront's cache, TLS and domain handling.
- Debt created: with OAC in front of the Function URL, a mutating request has to carry the hash of its own body.
  Measured on `dev`: a POST through CloudFront with no `x-amz-content-sha256` answers 403 with the body `The request signature we calculated does not match the signature you provided`, and the same POST carrying the hex SHA256 of the body in that header reaches the function.
  `docs/modules/app/trd.md` owns four such routes, and 0004 and 0005 are already merged against the assumption that a plain browser request works.
- Resolved by: 0008_oac_payload_hash, 2026-09-19.
  Every browser call to the app's own API now carries the header; see `docs/modules/app/ard.md` for the client-side hash and the narrower debt it leaves open, a third party that cannot compute the hash itself.
- Revisit when: the app needs something a Function URL cannot provide (custom authorizers, usage plans).
- Source: setup

## 2026-09-17: Route53 zone read, never imported

- Decision: Terraform reads the existing `sdfles.com` hosted zone (`Z07789852332B51WUS33Z`) with `data "aws_route53_zone"` and owns only the `napkin` alias and ACM validation records inside it.
- Alternatives rejected: importing the whole zone into this module's state.
- Reason: the zone already holds unrelated records for other projects in the same AWS account; importing it would put those records under this module's lifecycle and risk a `terraform destroy` here deleting them.
- Debt created: none.
- Revisit when: never.
- Source: setup

## 2026-09-17: no VPC, no NAT Gateway

- Decision: the Lambda runs outside any VPC and reaches S3 and DynamoDB over their public endpoints.
- Alternatives rejected: a VPC with a NAT Gateway for outbound access.
- Reason: a NAT Gateway has an hourly cost that breaks the $0 fixed-cost target, and nothing here needs network isolation for a single-user app.
- Debt created: none.
- Revisit when: a future requirement needs network isolation.
- Source: setup

## 2026-09-18: CloudFront in front of a Function URL needs two grants, not one

- Decision: the stack grants the CloudFront service principal both `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction`, each pinned to the distribution ARN, which is the pair AWS's origin access control documentation requires.
- Alternatives rejected: the single `lambda:InvokeFunctionUrl` grant, which is what a non-OAC caller needs and what the reference repositories show.
- Reason: with only the first grant, every request through CloudFront answers 403, the function is never invoked and its log group stays empty, so the symptom points at signing or at the OAC rather than at a missing permission. A sigv4 request signed by hand still succeeds, which makes it easy to conclude the origin is fine.
- Debt created: none.
- Revisit when: AWS changes the documented permission pair.
- Source: 0003_terraform_environments

## 2026-09-19: Terraform owns the two GitHub Actions environments

- Decision: `stacks/app` creates the Actions environment named after `var.env` through `modules/github/actions_environment`, with `AWS_ROLE_ARN`, `LAMBDA_FUNCTION_NAME`, `ASSETS_BUCKET` and `CLOUDFRONT_DISTRIBUTION_ID` taken from the resources of that same stack and `APP_PASSWORD` from `var.app_password`. `dev` and `prd` configure the `github` provider with the same GitHub App as `core`.
- Alternatives rejected: keeping the four variables and the secret as a manual step after each apply, which is how they were defined until now; a `core`-owned module reading the other roots' outputs with `terraform_remote_state`, which would make `core` depend on the environments it is applied before.
- Reason: the value and the resource it names are produced by the same apply, so they cannot drift. The manual step also had no signal: a recreated bucket left a stale variable behind and the next deploy failed against a resource that no longer existed.
  The module is copied from `diy-infra` without its `lifecycle { ignore_changes = all }`, because nothing else manages these environments here and ignoring every change would hide a protection rule or a variable edited by hand.
  Its `for_each = nonsensitive(toset(keys(var.env_secrets)))` is kept: `for_each` cannot take a sensitive value, and the names of the secrets are not the secrets.
  The secret is written through the resource's `value`, not `plaintext_value`, which provider 6 deprecates in favour of it.
- Debt created: the App's private key now lives in the `terraform.tfvars` of all three roots, so rotating it means editing three files. `prd` also gets an `APP_PASSWORD` secret that nothing reads, since no suite runs against prd; it is already in prd's state through the Lambda's environment, so it adds no exposure.
- Revisit when: a secret manager holds the App key for every root, or a third environment makes the copies worth removing.
- Source: 0007_deploy_workflows

## 2026-09-19: the deploy role trusts the Actions environment, and the environment admits one branch

- Decision: the trust policy in `stacks/app/github_actions.tf` matches `token.actions.githubusercontent.com:sub` against `repo:{owner}/{repo}:environment:{env}`, in the plain and the id-welded shape, with `{env}` the same `var.env` that names the Actions environment.
  `modules/github/actions_environment` sets the environment's deployment branch policy to custom branch policies with exactly one pattern, `var.git_branch`: `develop` for `dev`, `main` for `prd`.
- Alternatives rejected: keeping the `ref:refs/heads/{branch}` subject and dropping `environment:` from the reusable deploy job, which would lose the per-environment `vars.*` and the `APP_PASSWORD` secret 0007 put there; trusting both subject shapes, which would let a job with no environment assume the role from the branch alone and double what has to be reasoned about; `protected_branches = true` on the environment, which reads branch protection rules and says nothing about rulesets, which is what this repository uses.
- Reason: a job that references an environment gets that environment as its OIDC subject, not its branch.
  The first run of `deploy-dev.yml` after 0007 (run 35474120357) failed at `configure-aws-credentials` with `Not authorized to perform sts:AssumeRoleWithWebIdentity` because the trust policy applied by 0003 still matched the branch shape.
  Binding the subject to the environment moves the branch restriction onto the environment itself, and 0007 had left that policy unset, so any branch could reference `dev` or `prd`; both halves are needed for a run from another branch, or from a fork, to stay unable to assume either role.
- Debt created: none.
- Revisit when: GitHub changes the subject a job with an environment gets, or a third environment appears.
- Source: 0009_deploy_dev_first_run

## 2026-09-20: the CDN serves two prefixes from the bucket, and `public/static/` is the only public folder

- Decision: `static_path_patterns` is `["/_next/static/*", "/static/*"]`, the default of `infra/stacks/app/variables.tf` rather than a per-environment local, and every file of `app/public/` lives under `public/static/`.
  Everything else is the server's, the Next metadata routes included.
- Alternatives rejected: listing each public file as its own pattern; a `/*.png` wildcard; keeping the files at the root of `public/` and adding a pattern per file as they appear.
- Reason: a pattern the bucket does not hold answers 403 through the origin access control instead of falling through to the server, so a wildcard is not a safe superset.
  It was checked against production rather than reasoned about: `/icon.png`, `/apple-icon.png`, `/icon.svg`, `/favicon.ico` and `/manifest.webmanifest` all answer 200 from the Lambda today, so `/*.png` would have broken the app's own icons to fix its manifest's.
  A prefix ends the drift instead of managing it: a new file under `public/static/` is a deploy and needs no apply, which a file list would have required forever, in two environments, by hand.
  The list covers exactly what the build emits, taken from `.open-next/assets` after a real build rather than from the repository, since the bucket only ever receives the former: `BUILD_ID`, `favicon.ico`, `static/icon-192.png`, `static/icon-512.png` and `_next/static/*`.
  `favicon.ico` is emitted as a key and is also a working Lambda route, and it keeps no pattern: adding one would move a working route onto a behavior for no gain, and every pattern is a hand apply in two environments forever.
  It is a stack default because nothing about it differs between environments, and `dev/main.tf` and `prd/main.tf` have to stay identical.
- Debt created: none, but `/static/*` is served with no session by construction, so nothing private may ever be placed under `app/public/static/`. Nothing enforces that beyond this entry and the module's `trd.md`.
- Revisit when: the app needs a public file that cannot live under one prefix, or CloudFront gains a way to fall through to the origin on a bucket miss.
- Source: 0013_e2e_dev_red

