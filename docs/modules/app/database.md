---
updated: 2026-09-20
source: 0011_workspace_redesign
---

# app: database

The module reads and writes both stores through `src/lib/dynamo.ts` and `src/lib/s3.ts`.
The schema lives in `infra` (Terraform), not here; what follows is what the code guarantees.

## Tables owned

| Table | Purpose |
|---|---|
| `diagrams` (DynamoDB) | Every item of the workspace, diagrams and folders alike: name, parent, the timestamps that matter (created, edited, pinned, locked), and what the last saved scene weighed |

## Objects owned

| Store | Key | Purpose |
|---|---|---|
| S3 scenes bucket | `scenes/{id}.json` | Full scene JSON: elements, appState subset, files |

## Tables referenced

None. This module is the only one that reads or writes the `diagrams` table and the scenes bucket.

## Invariants kept in code

- One table holds two kinds of item, told apart by `kind`: absent means a diagram, `"folder"` means a folder.
  A folder owns no scene object, so POST writes none for it and `/urls` answers 404, which keeps the next invariant literally true.
- Every diagram has exactly one scene object at `scenes/{id}.json`.
  POST writes the empty scene first and the item second, so a diagram is never listed without its object; DELETE removes the item first and the object second, so a failure leaves an unreachable object rather than a diagram with no scene.
  A reader still treats a missing object as an empty scene.
- `updatedAt` means the scene was edited, nothing else.
  Only the PATCH that follows a scene PUT moves it, and that same PATCH carries the element count and byte size the browser measured on the bytes it uploaded, so the three always agree.
  A rename or a lock leaves it alone, which is why the list order reads as last edited rather than last written.
  A PUT that succeeds and a PATCH that fails counts as a failed save, so the next change repeats both.
- A locked item refuses scene writes in the table itself, not in the browser that locked it: the scene PATCH is conditional on `lockedAt` being absent, and `/urls` signs no upload at all while it is set.
  A second tab that had the diagram open therefore fails loudly on its next save instead of overwriting a finished drawing.
  A signature handed out before the lock stays usable until it expires; see `ard.md`.
- Items written before a field existed carry none of `parentId`, `pinnedAt`, `lockedAt`, `elementCount` or `sceneBytes`, and read as a root level, unpinned, unlocked diagram of unknown size.
  Nothing backfills them; the first save after an edit fills the two counters, and a first move fills the parent.
- Deleting a folder walks its subtree deepest first and pairs each diagram's row with its own scene object, folder last.
  A cascade that stops halfway therefore leaves a smaller subtree that is still reachable from the root, and at worst an unreachable object, never a row whose parent is gone.
  There is no transaction; the order is the whole of the guarantee.
- No item is ever its own ancestor.
  `PATCH` puts a new `parentId` through the same `tree.ts` rule the Move dialog offers its choices from, and answers 400 for the item itself, one of its descendants, a missing item or a diagram.
  A cycle would make a subtree unreachable and the delete cascade non-terminating.
- `pinnedAt` belongs to diagrams only, and a pin moves nothing: the item keeps its `parentId` and shows in both places.
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
- 2026-09-20: `lockedAt`, `elementCount` and `sceneBytes` added to the item. DynamoDB is schemaless and every reader treats them as optional, so no migration ran and no item was rewritten.
- 2026-09-20: `kind`, `parentId` and `pinnedAt` added, and with them folder items in the same table.
  Absent means diagram, root and unpinned, so again nothing was rewritten.
