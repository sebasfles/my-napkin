---
updated: 2026-09-17
source: setup
---

# infra

Terraform that provisions the AWS infrastructure my-napkin runs on: one AWS account, one region, two environments (`dev`, `prd`), plus the GitHub rulesets of the repository.
It creates infrastructure only.
It never deploys application code; that is `deploy`'s job.

## Boundaries

- Owns: the assets and scenes S3 buckets, the DynamoDB table, the Lambda function's configuration, CloudFront, the ACM certificate, the `napkin` Route53 records, the GitHub OIDC provider and deploy role.
- Does not own: the Lambda's code (pushed by `deploy`), the table's items and the scenes' content (owned in behavior by `app`), the `sdfles.com` hosted zone itself (read only, never imported).
- Code: `infra/`

## Documents

- [prd.md](prd.md): product behavior
- [trd.md](trd.md): structure and endpoints
- [ard.md](ard.md): decisions and debt
- [database.md](database.md): tables and invariants
- [flows.md](flows.md): diagrams
