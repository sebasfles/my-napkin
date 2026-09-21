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

### Round 1, 2026-09-20

Written and committed by the session before this one, at 72dc10b, and never verified: no `verify.log`, no build, no suite.
What it changed is in its commit message.
The three defects found in round 2 were all in it, and none of them is reachable by lint, typecheck or a unit test.

### Round 2, 2026-09-21

Rebased on `origin/develop` at 68f7cd4 (0012 phase 3).
Only `editor.tsx` conflicted.
Phase 3's library panel, its trigger, the drop wrapper and the `napkin-editor` class now live in the one editor instance that survives a switch.

Decisions the plan did not record:

- `panel` is derived from the workspace list (`isDiagram(open)`) rather than from the scene on screen, the same argument round 1 used for `locked`.
  The list knows which kind of canvas this is at the click, so the trigger settles then instead of at the end of the fetch, and `LibraryPanel` is never mounted for a library canvas.
- `LibraryPanel` is keyed by `diagramId`.
  The remount used to reset everything inside it; now that the editor around it survives, its failure line and its open dialog would travel to the next diagram.
  The key is that reset, made explicit, and nothing more.
- Round 1's `import { CaptureUpdateAction } from "@excalidraw/excalidraw"` is replaced by the literal `captureUpdate: "NEVER"`, which is the same type (`CaptureUpdateActionType` is `ValueOf<typeof CaptureUpdateAction>`).
  `editor.tsx` is server rendered (`/d/[id]` is `ƒ` in the build output), and `docs/modules/app/ard.md` 2026-09-17 "Excalidraw loaded client-side only" forbids reaching that package outside a `dynamic(ssr: false)`.
  Line 27's lazy import is again the only path to it.
- `docs/TRD.md` verification table: the app unit row is now `npx vitest run --no-file-parallelism`, approved by the om-manager, for Sebastian's standing rule that suites run serially so memory does not overflow.

Three defects in round 1, each found by running it, each fixed and then green three runs in a row:

- Switching to a locked canvas left it editable.
  `resetScene` puts the whole appState back to the package's defaults, `viewModeEnabled` included, and the package copies that prop into state only when the prop itself changes, never when its state drifts from it.
  With the remount gone nothing re-applied it.
  View mode is asserted again after the reset and only while nothing is shown, which is where the wipe happens and the one window with no saver mounted: every `updateScene` provokes an `onChange`, and one that reaches a saver on open uploads a scene nobody edited.
- The first shape drawn after a switch could wipe the canvas it was drawn on.
  `loaded` is the scene as it was fetched when the canvas was opened, and it survived a navigation, so leaving a canvas and coming back inside the next fetch painted that old snapshot with no cover, and the next stroke saved it over everything drawn since.
  One measured run fetched a rectangle at version 14 and uploaded a different rectangle at version 7: the stored shape was gone.
  This is the stale-scene hazard `Context & decisions` rejected a cache for, arriving through a cache of one that nobody meant to keep.
  `loaded` is now dropped when the route leaves the canvas.
  The remount hid it, since `initialData` is read at mount only and a stale `loaded` was never applied.
- One painted frame of bare chrome on a switch, about one run in three.
  `updateScene` hands the scene over and the editor paints its canvas on a frame of its own, while the cover was lifted in the same commit as the swap.
  The cover now lifts a frame after it.

Round 1's own lock test is what caught the first of those, which is what a guard test is for: it was written to stop the fix buying a persistent instance at the cost of something else, and that is exactly what it found.

A fourth thing, found by the suite rather than by the production build.
`locale.spec.ts` drew a rectangle after a reload and waited for the save indicator, which was never created: the stroke never reached the canvas.
`.excalidraw` is on screen now before the scene is fetched, where before this task the editor was not mounted until the scene was there, so "the editor is visible" has stopped meaning "you can draw on it".
The spec had been racing the cover and winning until the cover began to last one frame longer.
Fixed in `canvasBox()` in `helpers.ts` rather than in the spec, so every canvas gesture waits for the cover to go, which is the only thing a person can do too.
Other specs were certainly winning that race by luck; this closes the class rather than the instance.

What that fallout really is, and it belongs in the ARD entry rather than in a note about `canvasBox()`:
this task changed what "the editor is visible" means for every spec in the suite.
Before it, `.excalidraw` could not exist until the scene was there, so visible implied drawable.
Now the chrome is up while the scene is still in flight, deliberately, because that is what Sebastian asked for.
Every spec written from here inherits that, and the ones that get it wrong fail intermittently and read as flakes.

Two consequences of those fixes, worth knowing before touching this again:

- The cover is load-bearing, not decoration.
  It holds the pointer off a canvas that is still being fetched, which is what stops a stroke landing on a scene about to be replaced.
  Two specs were drawing into that window and now wait for the cover to go, the way a person would.
- `inspect` in `editor-switch.spec.ts` gained one assertion: every switch shows the cover in at least one sampled frame.
  That is "every switch fetches, nothing is kept from the last visit" made observable, and it is what goes red on the second defect.

Verified on a local production build, out of `verify.log` and separate from the suite, because `npm run dev` and `next start` are not interchangeable for this measurement (0011 phase 4 measured 271ms in production against 367 to 441ms in dev):
`editor-switch.spec.ts` against `npm run build && npm run start` with `BASE_URL=http://localhost:3000`, five tests, three consecutive green runs.
That run is what `Approach` asked for and what this round nearly treated as a formality.
It found three defects, none of them reachable by lint, typecheck or a unit test, one of them silent data loss.
It has earned its place in the recipe.

The one assertion in that spec never shown failing, checked once and kept out of `verify.log`:
with the cover moved from `z-[3]` to `z-[50]`, above the package's `--zIndex-layerUI: 4`, the `covered` probe went red on all three switches and named both `.excalidraw .App-toolbar` and `.napkin-library-trigger`.
Reverted, and `git diff` carries no z-index line.

The library panel against the cover, which is what the check above was for:
`.excalidraw .sidebar` is `z-index: 5` and the trigger rides the UI layer at 4, so neither can ever sit under a cover at 3.
The panel cannot be open during a switch anyway, for two independent reasons in the package: its own outside-click handler closes it, and the tab bar and the app sidebar are both outside it; and `resetScene` resets `openSidebar` with the rest of the appState.
It closed on every switch before this task too, through the remount.
The probe carries `.napkin-library-panel` regardless, so it arms itself if the panel is ever made to survive one.

Deferred, not this task:

- `useCanvasSave`'s cleanup does `flush()` then `stop()`, and `stop()` mutes the success callback, so a saver recreated while dirty uploads correctly and leaves the save indicator reading "Saving" until the next edit.
  The saver is rebuilt whenever `items` changes identity, which every save does, so this is reachable on develop today.
  Deferred by the om-reviewer, who kept this pull request to the swap and its fallout rather than widening it into the saver's state machine.
  It wants a task of its own rather than a queue position, for the reason that makes it worse than a wrong label: it *masked* the second defect, turning data loss into a stuck indicator.
- Making the library panel survive a switch, which would need `openSidebar` restored after `resetScene`.
  It is a change in behaviour rather than a repair, and the click that starts a switch closes the panel before any of our code runs.

Cut by the om-reviewer when Sebastian asked for the pull request, recorded here rather than left silent:

- The heavier fixture for a before and after recording, so Acceptance 3 ships without a visually meaningful one.
  The assertions are the proof; the recording would have shown a paint that is below the threshold the eye catches at these scene sizes.
- Any further assertion, spec or run beyond the suite that produced the last block of `verify.log`.

`verify.log` is written at `docs/tasks/0016_diagram_switch_flicker/verify.log` and is not in the commit: `.gitignore` carries `*.log`, so this repo has never tracked one.
It lives in the workspace for the om-reviewer to audit.
