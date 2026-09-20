---
updated: 2026-09-19
source: 0009_deploy_dev_first_run
---

# infra

Terraform that provisions the AWS infrastructure my-napkin runs on: one AWS account, one region, two environments (`dev`, `prd`), plus an account-level `core` root holding the GitHub OIDC provider, the branch rulesets, the repository's Actions workflow permissions and the monthly budget alert.
Each environment also owns the GitHub Actions environment of the same name, so the values a deploy reads come from the apply that created the resources they name.
It creates infrastructure only.
It never deploys application code; that is `deploy`'s job.

## Boundaries

- Owns: the assets and scenes S3 buckets, the DynamoDB table, the Lambda function's configuration, CloudFront, the ACM certificate, the `napkin` Route53 records, the GitHub OIDC provider and deploy role, the branch rulesets, the repository's Actions workflow permissions, the two Actions environments with their variables, `APP_PASSWORD` and their single allowed branch, and the monthly budget alert.
- Does not own: the Lambda's code (pushed by `deploy`), the workflow files that read those Actions variables (`deploy`), the table's items and the scenes' content (owned in behavior by `app`), the `sdfles.com` hosted zone itself (read only, never imported).
- Code: `infra/`

## Documents

- [prd.md](prd.md): product behavior
- [trd.md](trd.md): structure and endpoints
- [ard.md](ard.md): decisions and debt
- [database.md](database.md): tables and invariants
- [flows.md](flows.md): diagrams
