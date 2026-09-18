---
updated: 2026-09-17
source: setup
---

# infra: database

This module provisions the DynamoDB table and S3 buckets my-napkin uses.
It does not own their data or access patterns; that belongs to `app`, see `app`'s own `database.md`.

## Tables owned

None. `infra` creates the `napkin-prd-diagrams` table and the `napkin-prd-assets-<account-id>` / `napkin-prd-scenes-<account-id>` buckets as infrastructure; it never reads or writes an item or object.

## Tables referenced

| Table | Owner module | Relationship |
|---|---|---|
| `napkin-prd-diagrams` (DynamoDB) | app | infra creates the table (on-demand, PK `id`) and grants the Lambda's IAM role GetItem/PutItem/UpdateItem/DeleteItem/Scan; app owns the item shape and access patterns. |
| `napkin-prd-scenes-<account-id>` (S3) | app | infra creates the bucket (private, CORS, versioning) and grants GetObject/PutObject/DeleteObject on `scenes/*`; app owns the `scenes/{id}.json` object shape. |
| `napkin-prd-assets-<account-id>` (S3) | app / deploy | infra creates the bucket (private, OAC) that serves `/_next/static/*` and `public/*` through CloudFront; `deploy` uploads its contents on every push. |

## Invariants kept in code

None owned here; see `app`'s `database.md`.

## Migrations of note

None, this module has no schema migrations.
