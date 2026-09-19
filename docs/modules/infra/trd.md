---
updated: 2026-09-19
source: 0007_deploy_workflows
---

# infra: technical

Every path below exists.
`core` and `prd` are written but not applied: `dev` is the only environment that has been through an `apply`.

## Structure

| Path | What |
|---|---|
| `infra/environments/core/` | Root: GitHub OIDC provider (one per account), branch rulesets for `develop` and `main` through the GitHub provider as a GitHub App, and the monthly budget alert. Its resources live in `oidc.tf`, `github.tf` and `budget.tf`, so this root has no `main.tf`; state key `core/terraform.tfstate` |
| `infra/environments/dev/` | Root for `dev`: `locals.tf` (`env = "dev"`, `base_domain = "dev.sdfles.com"`, naming, tags, the GitHub App ids), `variables.tf` (`github_app_pem`, `app_password`, `session_secret`), `providers.tf` (`aws` and `github` as the App), `main.tf` (calls `stacks/app`), `outputs.tf`, `.env.example`, `terraform.tfvars.example`; state key `dev/terraform.tfstate` |
| `infra/environments/prd/` | Same shape as `dev` with `base_domain = "sdfles.com"`; state key `prd/terraform.tfstate` |
| `infra/stacks/app/` | Composite stack: one environment's AWS side in `storage.tf`, `database.tf`, `compute.tf`, `cdn.tf` and `github_actions.tf`, deriving `napkin.{base_domain}`, creating that environment's deploy role trusting its branch, and the Actions environment that names all four resources |
| `infra/modules/aws/s3/` | Leaf module, reused for the assets bucket and the scenes bucket |
| `infra/modules/aws/dynamodb_table/` | Leaf module for the `diagrams` table |
| `infra/modules/aws/lambda_function/` | Leaf module for the Next.js server Lambda, its log group, its role and its `AWS_IAM` Function URL, code changes ignored via `lifecycle` |
| `infra/modules/aws/cloudfront/` | Leaf module for the distribution, its Origin Access Controls and behaviors |
| `infra/modules/aws/acm/` | Leaf module for the DNS-validated certificate in `us-east-1` |
| `infra/modules/github/branch_ruleset/` | Leaf module, copied from `local-auctions-infra` with zero required approvals and repository admin bypass |
| `infra/modules/github/actions_environment/` | Leaf module, copied from `diy-infra` without its `ignore_changes = all`: one environment, its variables and its secrets |
| `infra/docs/setup.md` | Prerequisites (state bucket, GitHub App) and apply order: core, dev, prd |
| `infra/docs/deploy.md` | Where Terraform's job ends and the workflows' begins |
| `infra/.gitignore` | Excludes `*.tfvars`, `*.tfstate*`, `.terraform/`, `.env*` |

## Endpoints owned

None. This module provisions infrastructure; it exposes no HTTP endpoints of its own.

Jobs, listeners or scheduled work: none.

## Depends on

- AWS provider `~> 6`, region `us-east-1`, profile `personal` (account `975050033628`).
- The existing `sdfles.com` Route53 hosted zone, read with `data "aws_route53_zone"`; never imported, only the `napkin` records inside it are created.
- GitHub's OIDC issuer (`token.actions.githubusercontent.com`), trusted by both deploy roles: dev trusts `refs/heads/develop`, prd trusts `refs/heads/main`.
- A GitHub App owned by Sebastian, installed only on `my-napkin`, used by `core` for the rulesets and by `dev` and `prd` for their Actions environment. Repository permissions: Administration, Environments, Secrets and Variables read and write, Metadata read.

## Depended on by

- `deploy`: per environment, needs the Lambda function name, the deploy role ARN, the assets bucket name and the CloudFront distribution id, plus `APP_PASSWORD` for the suite; this module writes all five into the Actions environment of the same name on every apply.
- `app`: runs against the DynamoDB table and S3 buckets this module creates; reads their names from the Lambda's environment variables, set by Terraform.

## Configuration

Root variables, backed by each root's `terraform.tfvars` (gitignored), all sensitive; everything else is a literal in `locals.tf`.

- `dev`, `prd`: `app_password` (compared against the login form, and written as the environment's `APP_PASSWORD` secret), `session_secret` (HMAC key for the session cookie), both injected into that environment's Lambda, and `github_app_pem`.
- `core`: `github_app_pem`, the private key of the GitHub App, and `budget_notification_email`, which is a variable rather than a literal because the repository is public.
- `github_app_pem` is the same key in all three roots; the App ids are literals in each `locals.tf`.
- Everything that differs between environments lives in that root's `locals.tf`, including the CORS origins, PITR, deletion protection and `force_destroy`, so `dev/main.tf` and `prd/main.tf` are identical.

## Testing

- `terraform fmt -check -recursive` from `infra/`, `terraform validate` from each root after `terraform init -backend=false`, both run on every pull request by `ci.yml`.
- No automated test suite; `terraform plan` is the practical check before every `apply`.
