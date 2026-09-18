---
updated: 2026-09-18
source: 0004_diagram_persistence
---

# app: database

The module reads and writes both stores through `src/lib/dynamo.ts` and `src/lib/s3.ts`.
The schema lives in `infra` (Terraform), not here; what follows is what the code guarantees.

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

- Every diagram has exactly one scene object at `scenes/{id}.json`.
  POST writes the empty scene first and the item second, so a diagram is never listed without its object; DELETE removes the item first and the object second, so a failure leaves an unreachable object rather than a diagram with no scene.
  A reader still treats a missing object as an empty scene.
- `updatedAt` is only accurate after a PATCH follows a scene PUT, and the browser is what calls PATCH once the presigned upload finishes.
  A PUT that succeeds and a PATCH that fails counts as a failed save, so the next change repeats both.
- No presigned PUT is ever issued for an id with no item: `/urls` reads the diagram first and answers 404 when it is gone.
  The browser also stops uploading as soon as the user deletes the diagram, before the request leaves.
  What survives is a PUT already on the wire when the DELETE lands, which can leave an object no code will delete; accepted, see `ard.md`.
- The scene JSON always includes `files`, or pasted images are lost on reopen.
- Soft deleted elements are stripped before every save, so the scene does not grow forever.
- Scene bodies never pass through the app server, only presigned URLs do.
- Listing uses a full Scan, paginated, acceptable only because the table stays small for one user.
- Concurrent editing is last write wins; nothing compares versions.

## Migrations of note

- 2026-09-17: initial design, table and bucket created by Terraform, not yet applied.
- 2026-09-18: first code to read and write both stores; no data existed before it, so nothing had to be migrated.
