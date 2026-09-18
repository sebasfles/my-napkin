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
  Sebastian wants the list fetched client-side; the testing reason this decision first carried is gone with the 2026-09-18 update below.
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
- Acceptance 1 to 5 are proven on the final round by the om-developer running the Playwright suite against `http://localhost:3000` with `.env.local` pointing at dev, with the summary in `om-developer notes` (Sebastian).
- Phases stay 0, one PR (Sebastian).

### Constraints and extra review checks

- The om-developer starts only after 0003 merges and Sebastian applies dev, and rebases on the post-0003 `develop` first.
- AWS clients are constructed lazily and never throw at import time, or the build and the mocked suite break with no credentials.
- The presigned PUT is signed with `Content-Type: application/json` and the browser sends exactly that header, not the charset a Blob adds by default.
- `files` is saved and restored as `BinaryFiles` through `initialData` (`docs/modules/app/ard.md`); the paste-an-image spec is what proves it.
- Relative dates use `useFormatter`, never `toLocaleString` (`docs/checks/i18n.md`), and every spec deletes the diagrams it creates (`docs/conventions/e2e.md#Rules`).
- Acceptance 3 is asserted by request URL in a spec, which the e2e convention allows because there the flow is the network call itself.
- Every e2e spec behaves like a real person using the app: it navigates, clicks, types, pastes and reads what the screen shows (Sebastian).
  No test-only window handle, no inspection of internal state and no shortcut into the app, and `review-task` checks it every round against `docs/conventions/e2e.md`.
- No `Co-Authored-By`, `Claude-Session` or any other agent attribution goes into a commit or the PR, and every `gh` call on this repo runs with `GH_TOKEN=$(gh auth token -u sebasfles)`; Sebastian merges with merge commits only.

### Update 2026-09-18: every e2e spec is real, the `@aws` tag is gone

- There is no mocked suite and no tag: one Playwright suite drives the app backed by dev's real table and bucket (Sebastian, `docs/conventions/e2e.md` at 8241682).
  It runs on the developer machine against `npm run dev` with `.env.local` on dev, and in `e2e-dev.yml` on pull requests into `main` against the deployed dev; `ci.yml` runs no e2e.
- Scope, tests: the `@aws` and non-`@aws` split and the network-mocked specs are replaced by one real suite covering the same flows (create, draw, reload, paste an image and reload, rename, delete, first load auto-create, the list, the delete confirmation).
- Acceptance 6 now reads: every behavior has its unit or Playwright test, the suite passes on a developer machine against dev, and `ci.yml` runs lint, typecheck and unit only.
- The single permitted artifice is blocking the browser's own PUT to S3 to reach the failed-save indicator, then letting the next change save (Sebastian, acceptance 5). Nothing else in the network is mocked, ever.
- `docs/TRD.md#Verification targets` now runs `npx playwright test --workers=1` with no exclusion, so from this task on every verify round needs dev applied and `.env.local` in place.
  Until then the om-developer verifies lint, typecheck and unit only, and no round is clean without a green e2e block at that round's commit.
- The three shell specs (`editor`, `locale`, `theme`) go through `/`, which now auto-creates and redirects, so this task updates them and they create and clean up real diagrams. `editor.spec.ts` loses its empty-state assertion, which the task already removes from `docs/modules/app/prd.md`.

## om-developer notes

### Round 1

What landed.
The five route handlers, the two repositories behind interfaces in `src/lib/diagrams.ts`, the client data layer, the sidebar with create, inline rename, delete and the save indicator, `/d/[id]` with the scene loaded into `initialData`, the debounced serialized autosave, and the whole test suite.
77 unit tests, one Playwright spec per flow.

Decisions the plan did not already record.

- The pages live in a route group, `src/app/(editor)/`, whose layout holds `DiagramsProvider` and the sidebar.
  The list is then fetched once and survives navigation between diagrams, and `/login` in 0005 stays outside the group with no sidebar.
  `src/app/page.tsx` is gone, replaced by `(editor)/page.tsx`.
- `DiagramsProvider` owns the list, its mutations and the save status of the diagram being edited.
  The save indicator renders as the second line of the active sidebar item, in place of the relative date, which is where the name is and needs no new chrome in the editor.
  The status is keyed by diagram id, so a status left behind by one diagram never shows on another.
- The save machinery is a plain factory, `createSceneSaver` in `src/lib/scene-save.ts`, with its three ports injected (presign, put, touch).
  The debounce, the serialization of saves and the retry are therefore unit tested in the node environment with fake timers, which a hook could not be without jsdom.
  `src/lib/use-scene-save.ts` is only lifecycle: the `beforeunload` guard, and flush plus stop on unmount.
  It sits in `src/lib/` next to `use-hydrated.ts`, the existing home for hooks; `docs/modules/app/trd.md` gets the line in document-task.
- Change detection has two layers: `sceneVersion`, the sum of element versions, on every `onChange`, and a full comparison of the serialized scene against the last saved one when the debounce fires.
  The second layer is what keeps the `onChange` Excalidraw fires while importing `initialData` from producing a save on open.
- `sceneVersion` is a four line reimplementation of the package's `getSceneVersion` rather than an import.
  Importing `@excalidraw/excalidraw` outside the `next/dynamic` boundary would evaluate the package during server rendering, which is exactly what `docs/modules/app/ard.md` forbids.
- The scene loader returns the presigned pair with the scene, and the saver reuses that pair for its first PUT.
  A save costs one PUT and one PATCH; a failure drops the cached pair, since an expired URL is the likely cause.
- `getSignedUrl` needed `signableHeaders: new Set(["content-type"])` on the PUT.
  Without it the signature does not cover the header, and the constraint that the browser sends exactly `application/json` would have been unenforced.
  The unit test found this, not the review.
- `GET /api/diagrams/[id]/urls` reads the diagram before signing and answers 404 when it is gone, so no PUT URL is ever handed out for an id with no item.
  This adds `get` to the repository interface, one method beyond the four Scope lists.
- `DELETE` removes the item before the object, and the unmount flush is skipped for a diagram the user just deleted, through `isDeleted` on the provider.
  Without that skip, deleting within the debounce window recreates `scenes/{id}.json` as an orphan and breaks the first invariant of `docs/modules/app/database.md`.
- An unknown `/d/[id]` is detected by the 404 from `/urls`, not by looking in the loaded list: the server is the authority and the editor needs no list dependency.
- The editor no longer uses `useHydrated`.
  Its canvas mounts only after a client side fetch resolves, so it never renders during server rendering and the gate the ARD describes has nothing to gate.
- Each row carries a pencil and a trash button, revealed on hover or keyboard focus; delete opens a shadcn `alert-dialog` added with the CLI.
  The sidebar went from `w-56` to `w-64` now that a row holds a name, a date and two actions.
- The list is re sorted after every write, so a renamed or just saved diagram moves to the top.
  That is what `updatedAt` desc means once PATCH always touches `updatedAt`.
- Failures are visible without toasts: the sidebar shows a retry when the list fails, `/` shows a retry when the first create fails, and any single action that fails leaves one muted line.
  API error bodies stay developer facing English, never translated.
- `package.json`'s `test:e2e` lost `--grep-invert @aws` to match the new row in `docs/TRD.md`.
  `.env.example` documents `DIAGRAMS_TABLE`, `SCENES_BUCKET` and `AWS_PROFILE`; the region stays ambient.

Not verified in this round.

- e2e did not run at all: 0003 is not applied, so dev's table and bucket do not exist.
  Lint, typecheck and unit are green; `verify.log` says `not run` for e2e with that reason, and acceptance 1 to 5 stay unproven until the e2e round against dev.
- `npm run build` could not run on this machine: the OS killed it with about 900 MB free while the other sessions were working.
  Nothing here is build specific, and the build is not a verification target, but it is unproven.
- Two things in the specs I could not exercise and will watch on the e2e round.
  The pasted image is proved by counting red pixels on the static canvas, which is the only way to see what a canvas shows.
  And every spec that draws waits for `Saved` before reloading, so the `beforeunload` guard should never raise a dialog Playwright would have to dismiss.

Deferred.

- Optimistic list updates, as Scope already defers.
- A save still in flight when the tab closes is lost after the prompt; a presigned PUT cannot go through `sendBeacon`, so there is no background flush.
- A presigned PUT issued by a second tab can still orphan a scene object after a delete.
  The single tab path is closed; multi tab conflict handling is out of scope.
- The Scan paginates but sets no page size, since the table stays small by design.

### Round 2

All six findings applied.

1. `loadScene` now treats only a 404 as "no scene yet".
   Every other non ok status, 403 included, throws, the editor shows `loadFailed` and mounts no canvas, so the saver never takes an empty baseline over a real drawing.
2. `stop()` starts no further upload: `advance` no longer dispatches one once stopped, and `upload()` returns at its entry.
   I split the finding in two methods rather than one, and this is the one place I did not follow the wording literally.
   Returning early "before calling `options.put`" in every case would also kill the flush the hook fires on unmount, which is what saves a change made in the last 1.5 s before switching diagrams, so a plain read of it trades an orphan object for lost work.
   `stop()` therefore means "start nothing new, let what is running finish", and the new `abandon()` means "put nothing, ever", including an upload already past its `await`.
   The hook calls `abandon()` when the diagram was deleted and `flush()` plus `stop()` otherwise, so the orphan path the finding names is closed and the last save still lands on a normal switch.
3. `remove` clears the deleted marker when the DELETE fails, so a failed delete leaves the diagram fully alive, flush included.
4. Opening a diagram cannot save it, by construction rather than by luck.
   The first report the editor makes after a mount is adopted as the baseline when it changes no element (same version sum), instead of being uploaded; from the second report on, a change that touches no element (a pan, a zoom, a background change) is saved as before.
   That makes the property hold whatever Excalidraw's `restore()` normalizes, which I cannot observe until the e2e round.
   The spec opens a diagram that has a drawing, samples the indicator across four seconds and asserts the list order does not move; the order is the definitive half, since a save reorders the sidebar through `markSaved`.
5. The save indicator belongs to the active row only; every other row shows its relative date.
6. Rebased on `c69450f`.

Tests added: seven unit tests over the adoption, `stop()` and `abandon()`, and one spec.
I checked the new guard tests by reverting each guard: the adoption test and both `stop()` tests fail without the code, then pass with it.

Unchanged from round 1: e2e still cannot run, so `verify.log` keeps the same honest hold, and acceptance 1 to 5 stay unproven.
