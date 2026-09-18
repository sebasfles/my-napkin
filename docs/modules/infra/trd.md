---
updated: 2026-09-17
source: setup
---

# infra: technical

Greenfield: nothing in this module is built yet.
Structure below is the planned layout from the project plan, not code that exists.

## Structure (planned)

| Path | What |
|---|---|
| `infra/environments/prd/` | Root module: `versions.tf`, `providers.tf`, `locals.tf` (naming, tags, domain), `variables.tf` (secrets only), `main.tf` (calls `stacks/app`), `oidc.tf` (GitHub OIDC provider), `outputs.tf`, `.env.example`, `terraform.tfvars.example` |
| `infra/stacks/app/` | Composite stack: wires every `modules/aws/*` module together for the single `prd` environment |
| `infra/modules/aws/s3/` | Leaf module, reused for both the assets bucket and the scenes bucket |
| `infra/modules/aws/dynamodb_table/` | Leaf module for the `diagrams` table |
| `infra/modules/aws/lambda_function/` | Leaf module for the Next.js server Lambda, code changes ignored via `lifecycle` |
| `infra/modules/aws/cloudfront/` | Leaf module for the distribution, its Origin Access Controls and behaviors |
| `infra/modules/aws/acm/` | Leaf module for the DNS-validated certificate in `us-east-1` |
| `infra/docs/setup.md` | Prerequisites and apply order |
| `infra/docs/deploy.md` | Where Terraform's job ends and the GitHub Actions workflow's begins |
| `infra/.gitignore` | Excludes `*.tfvars`, `*.tfstate*`, `.terraform/`, `.env*` |

## Endpoints owned

None. This module provisions infrastructure; it exposes no HTTP endpoints of its own.

Jobs, listeners or scheduled work: none.

## Depends on

- AWS provider `~> 6`, region `us-east-1`, profile `personal` (account `975050033628`).
- The existing `sdfles.com` Route53 hosted zone, read with `data "aws_route53_zone"`; never imported, only the `napkin` records inside it are created.
- GitHub's OIDC issuer (`token.actions.githubusercontent.com`), trusted by the deploy role.

## Depended on by

- `deploy`: needs the Lambda function name, the deploy role ARN, the assets bucket name and the CloudFront distribution id to run `update-function-code`, `s3 sync` and `create-invalidation`; read from `terraform output` and set once as Actions variables.
- `app`: runs against the DynamoDB table and S3 buckets this module creates; reads their names from the Lambda's environment variables, set by Terraform.

## Configuration

Root variables, backed by `terraform.tfvars` (gitignored), both sensitive; everything else is a literal in `locals.tf`.

- `app_password`: compared against the login form; injected into the Lambda's environment.
- `session_secret`: HMAC key for the session cookie; injected into the Lambda's environment.

## Testing

- `terraform fmt -check` and `terraform validate`, run from `infra/environments/prd`.
- No automated test suite; `terraform plan` is the practical check before every `apply`.
