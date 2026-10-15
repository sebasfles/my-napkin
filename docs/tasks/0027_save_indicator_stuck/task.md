---
id: "0027"
title: save_indicator_stuck
type: bug
crew: pair
clearance: repo
branch: bugfix/0027_save_indicator_stuck
modules: [app]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-10-14
updated: 2026-10-14
---

# 0027 The save indicator no longer sticks on "Saving"

## Goal

After the user edits and switches diagram quickly, the indicator of the diagram he comes back to reads "saved" once its upload lands, instead of "Saving" until the next edit, so the indicator can be trusted as the one sign that work is on disk.

## Scope

- Reproduce end-to-end first, as `replication.md` says, and record where the indicator sticks.
- Fix the cause in `useCanvasSave`: the cleanup calls `flush()` then `stop()`, and `stop()` mutes the success callback, so a saver recreated while dirty uploads correctly but never reports it.
  Direction: let the flush's success reach the indicator before muting, or make `stop()` cancel only pending timers; the om-reviewer decides which once the replication shows the sequence.
- Unit test on the saver's state machine for the recreate-while-dirty path; one e2e case in the save specs.

## Out of scope

- Any change to what is saved or when; only the reporting of a save that already happens.
- The stale `loaded` data-loss bug of 0016, already fixed.

## Acceptance

1. Edit diagram A, switch to B within the debounce, switch back to A: once the upload lands the indicator reads saved, never "Saving" at rest.
2. A save that fails still reads "not saved".
3. Unit test for the recreate-while-dirty path; e2e case; suite green.

## Approach

- Module and layers touched: `app`, `src/lib/` save machine (`scene-save.ts`) and the `useCanvasSave` hook, tests.
- Entities, endpoints, tables: none.
- Decisions:
  - Fix the saver, not the indicator: chosen over resetting the indicator on remount because a reset would also hide a save that is still in flight.

## Database

None.

## Infra

None.

## Design

None.

## Replication

See `replication.md`.

## Risks

- This bug masked a data-loss bug once (0016); the fix must not change which bytes are uploaded or when.

## Depends on

None.

## Context & decisions

Consolidated 2026-10-14 by om-0027-reviewer with the om-manager and Sebastian.

Decisions:

1. Drain on stop (Sebastian). `stop()` accepts no new input and arms no timer, but what the cleanup's flush handed over is uploaded, a queued scene included, and every status it reaches is reported to the end. A failure after stop reads "not saved" and is not retried. `abandon()`, the `deleted` marker and `resume()` keep their meaning.
   Why: today a change flushed while an upload is in flight is queued and then dropped (`scene-save.ts:67`, `:90`), losing the last edit silently and leaving "Saving" at rest.
   This reverses `docs/modules/app/ard.md` 2026-09-18 ("a queued change cannot outlive the editor"): record the reversal there in `document-task` and rewrite `tests/unit/scene-save.test.ts` "starts no upload once stopped..." (both cases) and "stops reporting once stopped..." to the new contract.
2. Reporting fix is option A plus the drain (om-0027-reviewer): the outcome of an upload that already started is reported, never muted.
3. The beforeunload warning stays until the stopped saver has finished draining (Sebastian); today the cleanup removes it before the flushed upload lands (`use-scene-save.ts:82-91`).
4. A stopped saver never touches the tabs (Sebastian): `onStatus` calls `fix(itemId)` and `fixTab` opens a closed tab, replacing the preview one (`tabs.ts:34-46`). Reproduce "close A's tab within the debounce of an edit" in `replication.md`; if it reopens, fix it in this PR.
5. A late report never overwrites a report about another diagram, nor one from a newer saver of the same diagram (om-0027-reviewer): the indicator is one `{id, status}` slot (`workspace-provider.tsx:71`, `:130`), and hiding an in-flight save is what the Approach rejects.

Adjustments:

- Scope: also `workspace-provider.tsx` and `CanvasSaving` in `editor.tsx`, for decisions 4 and 5.
- Out of scope 1 and Risks 1 now read: the bytes of a scene the user drew are never dropped; the drain is the only change to what is uploaded, and nothing changes when an open canvas saves.
- Acceptance gains: 4. edit, wait for the upload to start, edit again, switch within the debounce, come back: the second edit is on the canvas and the indicator reads saved. 5. closing a tab within the debounce does not bring it back. 6. leaving the page while a stopped saver drains warns.
- Replication: the indicator lives in the open diagram's sidebar row, not its tab, so step 3 is "open A again"; precondition adds "sidebar expanded, A and B in the folder it shows". The `ard.md` 2026-09-21 claim that every save rebuilds the saver no longer matches the code (memo deps are stable); confirm the real trigger (CanvasSaving unmounting on the switch) and correct that entry in `document-task`.

Constraints: `docs/modules/app/ard.md` 2026-09-18 (saver factory with injected ports, unit-tested with fake timers, Node environment, no jsdom), 2026-09-20 (the first status report promotes the tab while mounted), 2026-09-21 (`canSaveCanvas` gate, cover); `trd.md` Testing. Uploads still check `abandoned` and `deleted()` before writing.

Review focus: each e2e case added must fail on develop before the fix (show the red in `replication.md`); the queued variant holds the S3 PUT with `page.route` rather than relying on timing; unit tests cover drain, failure after stop, and no retry after stop.

Playwright: ask the om-manager for the e2e token before every run, one suite at a time on this machine.

clearance: repo

## om-developer notes
