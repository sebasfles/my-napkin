---
updated: 2026-09-18
source: 0003_terraform_environments
---

# infra: database

This module provisions the DynamoDB table and S3 buckets my-napkin uses.
It does not own their data or access patterns; that belongs to `app`, see `app`'s own `database.md`.

## Tables owned

None. `infra` creates the `napkin-{env}-diagrams` table and the `napkin-{env}-assets-<account-id>` / `napkin-{env}-scenes-<account-id>` buckets as infrastructure, once per environment; it never reads or writes an item or object.

## Tables referenced

| Table | Owner module | Relationship |
|---|---|---|
| `napkin-{env}-diagrams` (DynamoDB) | app | infra creates the table (on-demand, PK `id`) and grants the Lambda's IAM role GetItem/PutItem/UpdateItem/DeleteItem/Scan; app owns the item shape and access patterns. |
| `napkin-{env}-scenes-<account-id>` (S3) | app | infra creates the bucket (private, CORS, versioned, noncurrent versions expiring after 30 days) and grants GetObject/PutObject/DeleteObject on `scenes/*`; app owns the `scenes/{id}.json` object shape. |
| `napkin-{env}-assets-<account-id>` (S3) | app / deploy | infra creates the bucket (private, OAC) that serves `/_next/static/*` through CloudFront, the only pattern routed to it while the app has no `public/` directory; `deploy` uploads its contents on every push. |

## Invariants kept in code

None owned here; see `app`'s `database.md`.

## Migrations of note

None, this module has no schema migrations.
