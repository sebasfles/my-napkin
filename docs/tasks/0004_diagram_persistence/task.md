---
id: "0004"
title: diagram_persistence
type: feature
branch: feat/0004_diagram_persistence
modules: [app]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-09-18
updated: 2026-09-18
---

# 0004 Diagram persistence

## Goal

Sebastian's diagrams persist: the sidebar lists them, he creates, opens, renames and deletes them, and every edit (pasted images included) is saved automatically and comes back identical after a reload or on another device.

## Scope

- Route handlers per docs/modules/app/trd.md: GET/POST `/api/diagrams`, PATCH/DELETE `/api/diagrams/[id]`, GET `/api/diagrams/[id]/urls`.
- `src/lib/dynamo.ts` (repository over the `diagrams` table: list by Scan, put, update name or updatedAt, delete) and `src/lib/s3.ts` (presigned GET and PUT for `scenes/{id}.json`, delete object). AWS SDK v3, credentials from the default chain (`AWS_PROFILE=personal` locally, the Lambda role in AWS).
- Env: `DIAGRAMS_TABLE`, `SCENES_BUCKET`, `AWS_REGION` read server-side; `.env.example` documents them.
- Sidebar: list sorted by `updatedAt` desc with name and relative date; create button (new diagram named `Napkin DDMMYYYY`, with ` (2)`, ` (3)` appended when the name already exists that day, opened immediately); inline rename; delete with a confirmation dialog naming the diagram, Cancel / Delete, no undo (Sebastian, 2026-09-18); active item highlighted. No empty state: with no diagrams the app creates the first one (Sebastian, 2026-09-18), so `docs/modules/app/prd.md` empty-state line is updated by the task.
- Editor: load scene through the presigned GET into `initialData` (elements, appState subset, files); autosave on `onChange` debounced 1.5 s: presigned PUT of `{ elements, appState subset, files }`, then PATCH to touch `updatedAt`; passive save indicator (saved, saving, failed) next to the name; failed saves retry on the next change; `beforeunload` prompt while dirty.
- Routing: `/d/[id]` per diagram; `/` redirects to the most recently updated diagram, creating the first one when none exists (Sebastian, 2026-09-18).
- Tests: unit for the save state machine and debounce, the repositories with `aws-sdk-client-mock`, and each route handler; e2e `@aws` for create, draw, reload and see the drawing, paste an image and see it after reload, rename, delete; non-`@aws` e2e for first-load auto-create, the list and the delete confirmation with the API mocked at the network layer.
- `docs/modules/app/*` updated with what lands.

## Out of scope

- Password auth and middleware (next task); the API is open until then, which is acceptable while nothing is deployed.
- Multi-tab conflict handling: last write wins.
- Thumbnails, search, folders, sharing.
- Deferred: optimistic list updates.

## Acceptance

1. With `.env.local` pointing at dev's table and bucket, `npm run dev` lists, creates, renames and deletes diagrams and the changes are visible in DynamoDB and S3.
2. Drawing and pasting an image, waiting for the saved indicator, reloading: the scene and the image are back.
3. Scene bodies never pass through the app server: the network tab shows the PUT and GET going to S3.
4. Deleting removes both the item and `scenes/{id}.json`.
5. A failed PUT shows the failed indicator and the next change saves normally.
6. Every behavior above has its unit or e2e test; `@aws` specs pass against dev from a developer machine; non-`@aws` specs pass in `ci`.
7. `styles`, `i18n` and `e2e-worth` checks clean.

## Approach

- Decisions:
  - Repositories in `src/lib/` with an interface, route handlers only validate and call them: testable without AWS, and the pattern the checks can read.
  - Presigned URLs with 5 minute expiry, `Content-Type: application/json` enforced on the PUT signature.
  - appState subset saved: `viewBackgroundColor`, `gridSize`, `zoom`, `scrollX`, `scrollY`, theme excluded (the app owns the theme).
  - IDs are `crypto.randomUUID()`.
  - Delete asks for confirmation in a dialog and is final: chosen over an undo toast because the S3 object is gone and a fake undo would need a soft-delete nobody asked for.

## Database

Owns `diagrams` and `scenes/{id}.json` as docs/modules/app/database.md states; invariants there apply.

## Infra

None new: consumes dev's table and bucket from 0003. `.env.local` values come from `terraform output` in `infra/environments/dev`.

## Design

None.

## Risks

- Excalidraw `files` in `initialData` must be passed as `BinaryFiles` and the images referenced by `fileId`; easy to save and forget to restore.
- Scene size with several images can reach tens of MB; presigned PUT handles it but the debounce must not fire mid-upload (serialize saves).
- CORS on the dev bucket must include `http://localhost:3000` (0003 does).

## Depends on

None to start: the om-developer implements against the mocked suite and unit tests. The final `@aws` round and the publish wait for 0003 to merge and Sebastian to apply dev; the om-manager notifies the om-reviewer then (Sebastian, 2026-09-18).

## Context & decisions

Consolidated 2026-09-18 with Sebastian through the om-manager.

### Decisions

- Every read and write reaches the browser through `/api/*` fetched from client components; no server component or page touches DynamoDB or S3 (Sebastian).
  `ci.yml` runs the non-`@aws` suite with no AWS credentials (`docs/modules/deploy/trd.md#Jobs owned`) and browser-level mocking only intercepts browser requests.
  The sidebar shows a skeleton while the list loads.
- The first-load auto-create is a POST issued by the client, never a side effect of rendering `/` (om-reviewer), so a prefetch cannot create diagrams.
- POST writes the empty scene object at `scenes/{id}.json` server-side (Sebastian), keeping the first invariant of `docs/modules/app/database.md`.
  Acceptance 3 reads as user scene content never passing through the app server, and the loader still treats a missing object as an empty scene.
- `app/.env.local` is placed in the workspace by the om-reviewer from `terraform output` in `infra/environments/dev` once Sebastian applies dev (Sebastian).
  The om-developer never reads or writes it; `.env.example` is its documentation and lists `AWS_PROFILE` too.
- The region comes from the ambient environment, never from an explicit variable (om-reviewer): `AWS_REGION` is reserved in Lambda and is not among the four env vars 0003 grants.
- PATCH always sets `updatedAt`, and sets `name` when the body carries one (om-reviewer).
- The default name is computed in the browser from its local date as `Napkin DDMMYYYY`, with the ` (2)` suffix taken from the names already in the loaded list (om-reviewer).
  It is user content, never a translated string and never formatted with `Intl`.
- Deleting the open diagram navigates to `/`, which opens the most recently updated remaining diagram or creates the first one; `/d/[id]` with an unknown id redirects to `/` (om-reviewer).
- Saves serialize through a pure state machine in `src/lib/` (idle, saving, queued, failed): a change during an upload fires once it completes (om-reviewer).
  Vitest runs in the node environment and no jsdom is added, so the state machine and the name generator stay pure modules rather than hooks.
- Soft-deleted elements are stripped before saving (om-reviewer), or the scene grows forever.
- The presigned PUT URL is reused for its lifetime and re-requested near expiry (om-reviewer), instead of one `/urls` call per save.

### Adjustments

- `Infra`: a CORS-only change in `infra/stacks/app` is allowed, recorded as a deviation, if dev's applied CORS blocks the presigned PUT or GET (Sebastian).
- Acceptance 1 to 5 are proven on the final round by the om-developer running the `@aws` suite against `http://localhost:3000` with `.env.local` pointing at dev, with the summary in `om-developer notes` (Sebastian).
  `verify-task` keeps excluding `@aws`, so that run is the only evidence for them.
- Phases stay 0, one PR (Sebastian).

### Constraints and extra review checks

- The om-developer starts only after 0003 merges and Sebastian applies dev, and rebases on the post-0003 `develop` first.
- AWS clients are constructed lazily and never throw at import time, or the build and the mocked suite break with no credentials.
- The presigned PUT is signed with `Content-Type: application/json` and the browser sends exactly that header, not the charset a Blob adds by default.
- `files` is saved and restored as `BinaryFiles` through `initialData` (`docs/modules/app/ard.md`); the `@aws` paste-an-image spec is what proves it.
- Relative dates use `useFormatter`, never `toLocaleString` (`docs/checks/i18n.md`), and `@aws` specs delete the diagrams they create (`docs/conventions/e2e.md#Rules`).
- Acceptance 3 is asserted by request URL in an `@aws` spec, which the e2e convention allows because there the flow is the network call itself.
- Every e2e spec behaves like a real person using the app: it navigates, clicks, types, pastes and reads what the screen shows (Sebastian).
  No test-only window handle, no inspection of internal state and no shortcut into the app; network mocking in the non-`@aws` suite is the only allowed artifice, and `review-task` checks it every round against `docs/conventions/e2e.md`.
- No `Co-Authored-By`, `Claude-Session` or any other agent attribution goes into a commit or the PR, and every `gh` call on this repo runs with `GH_TOKEN=$(gh auth token -u sebasfles)`; Sebastian merges with merge commits only.

## om-developer notes
