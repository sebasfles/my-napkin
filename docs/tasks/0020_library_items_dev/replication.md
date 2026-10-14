# Replication: 0020 library_items_dev

## Preconditions

- Logged in at `https://napkin.dev.sdfles.com`.
- `develop` at `b2f2331` or later deployed on dev.

## Steps

1. Create a library, add two items to it (from a diagram, as the e2e helpers do).
2. Open a diagram, link the library, open the editor's Libraries panel.
3. Separately, import a `.excalidrawlib` file from the Libraries section.

## Expected

The panel section for the library shows two items; the imported library opens as a canvas with one frame per item.

## Observed

The panel section is there with 0 items; the imported library canvas shows the empty state (`empty-library-canvas`).
Locally, through `npm run dev` with the admin profile, both pass.

## Environment

- App version or commit: `b2f2331` on dev
- Platform, browser or device: chromium in GitHub Actions, `e2e-dev` job
- Environment: dev

## Evidence

- https://github.com/sebasfles/my-napkin/actions/runs/35630985274/job/106437288399: 85 passed, 5 failed, 4 of them on library items.
- Same 4 specs passed locally in 0012 phase 3 (83/83) and 0017 (90/91).

## om-developer confirmation

2026-09-21, on `b2f2331` as deployed to dev. Reproduced.

Not by re-running the steps: no agent on this machine may run Playwright against dev, and the
reproduction did not need it, because run 35630985274 left the evidence behind and the scenes
bucket is versioned, so the delete markers the suite's cleanup wrote hid nothing.

For `2952a1f5-1aad-4f01-baa4-0f1106000916`, the library of `library-insert.spec.ts:29`:

| time | object | bytes | what wrote it |
|---|---|---|---|
| 17:24:55 | `scene.json` | 40 | the POST, `libraryStore.createEmpty` |
| 17:24:56 | `scene.json`, `items.json` | 2241, 2753 | the import, both correct |
| 17:24:57 | `scene.json`, `items.json` | 128, 112 | a second save that emptied both |
| 17:25:24 | both | delete markers | the suite's cleanup |

The 112-byte file is `"libraryItems": []`. The same shape on the other three libraries of the run:
`8042c921` 2755 then 112, `cca10d54` 2753 then 112, `b7b97fe3` 2755 then 112, each one to two
seconds apart.

So the steps' `Observed` is confirmed and its reading is not: the panel shows 0 items because the
library really does hold 0 by then, not because anything failed to read it. The import writes
correctly on dev and the app destroys what it wrote about a second later.

Two details name the writer. Only `writeLibrary` writes `scene.json` and `items.json` together, so
the second write came through the editor's saver. Its appState is `scrollX: 0, scrollY: 0,
zoom: 1`, the package's defaults after `resetScene`, where `writeImportedLibrary` writes
`libraryLayout.clearOfTheEditorChromeX/Y`, and it carries `viewBackgroundColor` and `gridSize`,
which `emptyScene()` does not have. The scene that was saved is the editor's own empty one, read
back out of the live instance by `toScene`, not an `emptyScene()` written by any route.

## om-reviewer verification

2026-09-21, on `52270d3`. Not run, and the reason is not a shortcut.

The steps need Playwright against dev, and no agent on this machine may run it: the classifier
refused the om-developer three times, for the `BASE_URL` run and for the plain local one, which
`docs/TRD.md` makes the same thing. I did not run it in its place, because that would bypass a
boundary set on that session rather than satisfy it, and because I do not run lint, typecheck or
tests in this role at all. The bug also cannot reproduce locally by construction: it needs a scene
load slower than the editor's own mount, which is the one thing a local run does not have.

What I verified instead, each of it checked rather than accepted:

- The om-developer's table holds. `JSON.stringify(emptyScene())` is exactly 40 bytes, matching the
  first object byte for byte, so the 128-byte clobber cannot be a retried `createEmpty` under any
  timing. That makes the writer's identity exact instead of circumstantial.
- The fix would have prevented the write that was recorded. The clobber carries the package's
  post-`resetScene` appState, and under `canSaveCanvas` no saver is subscribed in that window, so
  there is nothing there to issue it.
- The fix drops no write that used to be made. Tracing the swap from one canvas to another,
  `shown` already goes null while `itemId` runs ahead of `loaded`, so the saver unmounted and
  flushed there before this change too; the gate only delays the remount by one frame after the
  scene lands.
- The two unit cases that were red before the `painted` term went in are the two states that lose
  the scene, so the regression can fail for the reason that matters.

What stays unverified: the steps passing against dev. That is the second half of acceptance 1 and
all of acceptance 2, both post-merge on `e2e-dev`, which is where `Context & decisions` puts them
with Sebastian's confirmation.
