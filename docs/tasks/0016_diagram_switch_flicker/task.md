---
id: "0016"
title: diagram_switch_flicker
type: bug
branch: bugfix/0016_diagram_switch_flicker
modules: [app]
repos: ["."]
phases: 0
depends_on: ["0012"]
ticket:
created: 2026-09-20
updated: 2026-09-20
---

# 0016 Switching diagrams flashes a full-screen loading state

## Goal

Switching from one open diagram to another repaints only the canvas content: no full-screen "Loading" or "Loading scene" flash, the shell and the editor chrome stay where they are.
0011 phase 4 closed this as fixed ("an editor that does not blank on a tab switch", 02cd570) and Sebastian still sees it on dev after all four phases merged.

## Scope

- Reproduce on deployed dev as a user does (two open tabs, click between them) with a Playwright trace that shows what paints. Sebastian confirms it is Excalidraw's own centred "Loading scene..." over a blank canvas, which `EditorCanvas`'s `key={shown.id}` remount triggers on every switch; 0011 phase 4 saw it and scoped it out.
- Switch behaviour, decided by Sebastian (2026-09-20): clicking another tab leaves the current diagram at once (no frozen A under B's tab); while B's scene is fetched, a loader shows only over the canvas area, never the shell nor the editor chrome. Every switch fetches; no scene cache (Sebastian dropped the LRU idea on 2026-09-20 to avoid stale-scene hazards for a one-second gain).
- Fix at the root: the Excalidraw instance survives the switch; the scene is swapped through its API (`updateScene`, files, history reset) instead of remounting `EditorCanvas`; no full-screen state of any kind on a switch.
- The saver must still bind to the right diagram after a switch: a change made in B after switching from A saves to B and never to A; a switch with A's save in flight lets it finish.
- Lock, view mode, theme and language must still apply on switch without a remount.
- Playwright: the Excalidraw root node identity survives a tab switch; undo right after a switch cannot bring A's elements into B; B's next save carries none of A's files.

## Out of scope

- The first load of the app or of a diagram opened from a cold page: a loading state there is expected.
- Any change to the tab model or the sidebar.

## Acceptance

1. Replication steps pass: switching between two open diagrams shows no full-screen loading state; the loader is confined to the canvas area while the scene fetches.
2. Playwright proves the Excalidraw root element is the same node before and after a switch; the save-after-switch, lock-after-switch, undo-after-switch and files-after-switch cases pass.
3. Full local suite green; a before and after screen recording or trace as workspace paths in the PR description.

## Approach

- Module `app`: `editor.tsx`, `editor-surface.tsx`, `(editor)/d/[id]/page.tsx` and layout, `use-scene-save.ts`; nothing server-side.
- The om-developer reproduces first with a Playwright trace against deployed dev (`BASE_URL`) as confirmation, then verifies the fix on a local production build (`npm run build && npm run start`, `BASE_URL=http://localhost:3000`) plus the normal suite; deployed dev confirms after the merge.
- Sequencing: 0012 phase 1 merges first (it renames and rewrites the same editor and saver files); 0016's code starts on that develop. Diagnosis runs before.
- Evidence (traces, recordings) stays under the workspace and is never committed nor attached: a trace of a logged-in session carries the cookie.

## Database

None.

## Infra

None.

## Design

None.

## Risks

- Excalidraw's `updateScene` does not reset everything a remount does (history, selection, collaborators, files); the fix must reset history and selection explicitly so B does not inherit A's undo stack.
- The e2e token: one suite at a time on this machine.

## Depends on

0012 phase 1 (libraries): it renames and rewrites the editor and saver files this task touches; 0016 codes on the develop that carries it (Sebastian, 2026-09-20).

## Context & decisions

Consolidated 2026-09-20 with Sebastian through the om-manager; Goal unchanged.

Decided by Sebastian:

- The paint is Excalidraw's own "Loading scene..." over a blank canvas, triggered by the `key={shown.id}` remount of `EditorCanvas`.
  `docs/tasks/0011_workspace_redesign/phase_4.md` records that round seeing it at 533ms and scoping it out, so this task is the half it declined, not a regression.
- A tab click leaves the current diagram at once, so phase 4's stale-canvas trick is dropped.
- While B fetches, a loader covers the drawing surface only, never the shell, the tab bar or Excalidraw's own toolbars.
  That forces one Excalidraw instance that stays mounted with its chrome painted and the loader as an overlay: unmounting the canvas would bring the splash back and take the chrome with it.
- No scene cache: every switch fetches.
  An LRU of the last 10 scenes was decided and then dropped the same day, because a cached switch would paint v1 while another tab or device had saved v2, and the first stroke would upload v1 plus that stroke over v2.
  `docs/modules/app/ard.md` 2026-09-20 "the open scene lives above the route segment" had already rejected a cache for that same reason, so it stands rejected twice and a third proposal should start from there.
- 0012 phase 1 merges first; the diagnosis runs now and the code starts on that develop.
- Acceptance 1 is discharged in three moves: reproduce on deployed dev, verify on a local production build plus the suite, confirm on deployed dev after the merge.
  The PR is not held for a dev confirmation that cannot exist before it merges.
- Evidence stays under `.workspaces/`, never committed nor attached: a trace of a logged-in session carries the session cookie and the repo is public.

Constraints:

- `docs/modules/app/ard.md` 2026-09-20 "the open scene lives above the route segment": this task reverses one of its choices, the canvas that holds the previous scene until the next has loaded, and reaffirms its rejection of a cache.
  `document-task` rewrites that entry rather than appending a second one.
- `docs/TRD.md#Conventions`: colours from tokens only, every string through next-intl in `es` and `en`, a changed user flow updates a spec.
- `editor.tsx` renders `loading` and `loadFailed` as a full-area paragraph.
  Scope now forbids a full-screen state of any kind on a switch, so the failure path is confined to the canvas area too, not only the loader.
  The loader is on screen at every switch now, so it has to be quiet and must not shift the layout it sits in.
- `app/tests/e2e/tabs.spec.ts` asserts that no painted frame falls back to a placeholder, which a loader over the canvas now breaks by design.
  Rewrite that assertion; do not delete it or weaken it to nothing.

After the rebase on 934acdb (0012 phase 1), 2026-09-20:

- A library canvas now opens in the same editor surface (`library = urls.items !== undefined`), so removing the remount changes every switch through that surface, not only diagram to diagram.
  Diagram to library, library to library and library to diagram are in scope because they are the same code path; Goal and Scope predate 0012 and only name diagrams.
- `EditorCanvas` seeds `hint` with `useState(() => library ? libraryCanvasHint(scene) : null)`, which runs at mount only.
  Without the remount a stale `LibraryHints` overlay survives the swap, so the hint is re-derived when the scene is.
- `CanvasSaving` takes `write={library ? writeLibrary : writeDiagram}`, so the saver-binding hazard is now cross-kind: an `onChange` for a diagram reaching the previous library's saver would write a diagram through `writeLibrary`.


Reproduction, settled 2026-09-20 after five diagnosis runs produced no measurement:

- The dedicated diagnosis runs are bounded (om-manager). If the last one yields nothing, reproduction is not skipped, it moves into the spec that ships: the Acceptance 2 e2e is written first and run red against the current tree, then the fix, then green from the same spec.
  A red run of the instrument that will guard this afterwards is stronger evidence than a throwaway trace, and it is what Sebastian's rule about reproducing before fixing asks for.
- Proceeding on the established mechanism with reasoning as the "before" was rejected: that is what 0011 phase 4 did, and this task is the result.
- In that case the deployed-dev confirmation after the merge is load-bearing, not a formality: Sebastian looks at dev once it deploys, before the promotion PR merges (om-manager, 2026-09-20).

Acceptance 2, added 2026-09-20 from the round 0 measurement (om-reviewer):

- The symptom is a canvas that is present and empty, not the splash text: on deployed dev the chrome was fully painted at +483ms after a switch with the canvas blank, and content arrived at +503ms.
  So the spec asserts on drawn content, not on the canvas element existing: no frame between the click and the settle may show painted chrome over an undrawn canvas.
- `LoadingMessage` is mounted twice in the package, once behind a 250ms delay on the scene path and once with no delay at all while the locale chunk loads, both at mount.
  One persistent instance does not shorten those windows, it stops re-entering them, which is the argument for the fix being a surviving mount rather than a faster load.

Files and scope, corrected 2026-09-20 from the package rather than from my note (om-reviewer):

- `resetScene` does **not** clear `files`, and nothing on the imperative API removes them; only `componentWillUnmount` does, so the remount this task deletes is the only thing that has ever cleared them.
  The files hazard is therefore certain once the remount goes, not theoretical, and it cannot be solved through Excalidraw.
- It is solved where we serialize: `toScene` (`src/lib/scene.ts`) keeps only the files referenced by the elements it writes, which is deterministic whatever the instance holds and also prunes blobs of deleted images.
  This touches the save path for every diagram, wider than "the switch" and not covered by `Out of scope`; accepted as necessary and as a strict improvement, and it wants an ARD entry at `document-task`, since normalizing on write cuts against the recorded debt that a stored scene keeps the shape it was written in.
- Risk to check before that lands: a scene written before this fix can carry unreferenced files, so the first `onChange` after opening it serializes differently from the baseline read out of S3.
  If that reaches `advance("change")`, every diagram uploads on open and `updatedAt` churns without an edit, against `docs/modules/app/ard.md` 2026-09-20.
  `fire()`'s `opening` branch absorbs it, since `sceneVersion` is blind to files: proved by a unit test that was also shown to fail when that branch is disabled.
  The invariant it rests on belongs in the ARD: the rebase happens only on the first report after open, so pruning must stay a pure function of the elements and files in that same report, and breaks if it ever depends on anything outside the scene.
- `onChange` is never synchronous (it fires from `componentDidUpdate`, gated on `!isLoading`), and `api.onChange(cb)` returns an unsubscribe, so the saver binds by subscription rather than through a mutable ref and the binding race goes away by construction.

I will also check in review:

- The saver is bound to B before `onChange` can fire for B's content, since `updateScene` provokes `onChange` and `saverRef` must not still hold A's saver.
- `resetScene` before `updateScene` for the undo stack. The files half of this note was wrong and is corrected below.
- A second switch during a fetch wins over the first, and a scene that fails to load leaves the editor somewhere the user can leave.
- The new e2e fails on the unfixed component for the reason it names, the way phase 4's did.

## om-developer notes
