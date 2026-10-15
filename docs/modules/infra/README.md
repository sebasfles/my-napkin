---
updated: 2026-10-14
source: 0028_account_migration
---

# infra

Terraform that provisions the AWS infrastructure my-napkin runs on: the project's own AWS account `372303522225`, one region, two environments (`dev`, `prd`), plus an account-level `core` root holding the GitHub OIDC provider, the branch rulesets, and the repository's Actions workflow permissions.
Each environment also owns the GitHub Actions environment of the same name, so the values a deploy reads come from the apply that created the resources they name.
It creates infrastructure only.
It never deploys application code; that is `deploy`'s job.

## Boundaries

- Owns: the assets and scenes S3 buckets, the DynamoDB table, the Lambda function's configuration, CloudFront, the ACM certificate, the `napkin` Route53 records, the GitHub OIDC provider and deploy role, the branch rulesets, the repository's Actions workflow permissions, the two Actions environments with their variables, `APP_PASSWORD` and their single allowed branch.
- Does not own: the Lambda's code (pushed by `deploy`), the workflow files that read those Actions variables (`deploy`), the table's items and the scenes' content (owned in behavior by `app`), the `napkin.fless.dev` hosted zone itself (read only, never imported), and the account's monthly budget, both set up by the organization with the account.
- Code: `infra/`

## Documents

- [prd.md](prd.md): product behavior
- [trd.md](trd.md): structure and endpoints
- [ard.md](ard.md): decisions and debt
- [database.md](database.md): tables and invariants
- [flows.md](flows.md): diagrams
