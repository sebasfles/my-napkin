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

I will also check in review:

- The saver is bound to B before `onChange` can fire for B's content, since `updateScene` provokes `onChange` and `saverRef` must not still hold A's saver.
- `resetScene` before `updateScene`, so B inherits neither A's undo stack nor A's `files`, and B's first save carries none of A's blobs.
- A second switch during a fetch wins over the first, and a scene that fails to load leaves the editor somewhere the user can leave.
- The new e2e fails on the unfixed component for the reason it names, the way phase 4's did.

## om-developer notes
