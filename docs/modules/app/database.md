---
updated: 2026-09-17
source: setup
---

# app: database

No code exists yet.
Schema is planned, defined in `infra` (Terraform), not in this module.

## Tables owned

| Table | Purpose |
|---|---|
| `diagrams` (DynamoDB) | Index of diagrams: id, name, createdAt, updatedAt |

## Objects owned

| Store | Key | Purpose |
|---|---|---|
| S3 scenes bucket | `scenes/{id}.json` | Full scene JSON: elements, appState subset, files |

## Tables referenced

None. This module is the only one that reads or writes the `diagrams` table and the scenes bucket.

## Invariants kept in code

- Every diagram has exactly one scene object at `scenes/{id}.json`; the app creates both on POST and deletes both on DELETE.
- `updatedAt` is only accurate after a PATCH follows a scene PUT; the app is responsible for calling PATCH once the presigned upload finishes.
- The scene JSON always includes `files`, or pasted images are lost on reopen.
- Listing uses a full Scan, acceptable only because the table stays small for one user.

## Migrations of note

- 2026-09-17: initial design, table and bucket created by Terraform, not yet applied.
