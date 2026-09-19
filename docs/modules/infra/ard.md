---
updated: 2026-09-18
source: 0003_terraform_environments
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

- Decision: GitHub Actions authenticates to AWS through an OIDC provider and a deploy role trusting `repo:sebasfles/my-napkin:ref:refs/heads/main` (both sub shapes), never stored access keys.
- Alternatives rejected: static IAM access keys as repository secrets.
- Reason: no long-lived credential to leak from a public repo; a fork cannot assume the role because the trust policy is pinned to the exact repo and branch.
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
