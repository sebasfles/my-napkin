# Replication: 0027 save_indicator_stuck

## Preconditions

- Logged in, two diagrams A and B in the list.

## Steps

1. Open diagram A and draw one shape.
2. Within the save debounce, open diagram B from the sidebar.
3. Wait for the upload to land, then open A again (or watch A's tab).
4. Read the save indicator of the open diagram without editing.

## Expected

The indicator reads saved once the upload lands.

## Observed

The indicator reads "Saving" and stays so until the next edit, although the scene was uploaded.
Found by om-0016-reviewer on 2026-09-20 during 0016's production-build run; reachable on develop.

## Environment

- App version or commit: develop at the start of the task
- Platform, browser or device: desktop Chromium, production build and `npm run dev` (Strict Mode remounts are part of the environment under test)
- Environment: local against dev's table and bucket

## Evidence

- `useCanvasSave` cleanup: `flush()` then `stop()`; `stop()` mutes the success callback.

## om-developer confirmation

2026-10-15, develop at a153682 (sources of `origin/develop` checked out over the branch, spec from the branch), local `npm run dev` against dev: reproduced.

- `tests/e2e/save-switch.spec.ts` on develop's sources: 5 of 5 red, each on the defect itself.
  1. Edit A, open B within the debounce, wait for A's PATCH, open A again: the indicator reads `saving`, never `saved`.
  2. Hold A's first PUT, edit again, switch within the debounce, release: the table keeps 1 element, not 2, so the queued edit is dropped.
  3. Abort the PUT, switch within the debounce, open A again: "Saving", not "Not saved".
  4. Close A's tab within the debounce: the tab comes back, through `fix()` in the cleanup's flush report.
  5. Hold the PUT and switch, then reload: no beforeunload dialog, because the cleanup removed the listener.
- In cases 1 and 3 the suite's own cleanup failed too: `savesSettled` waits for `saved` and the indicator was stuck on `saving`. The four rows it left in dev's table (`e2e outlive ...`) were deleted through the UI in the same slot.
- The real trigger is `CanvasSaving` unmounting on the switch (`canSaveCanvas` goes false when `shown` becomes null), not a rebuilt saver: the memo's deps are stable across saves.
- The same sequence at unit level (`tests/unit/scene-save.test.ts`, the drain cases and the two fold-in cases) is red on develop's `scene-save.ts`. A flush while an upload is in flight ends at `saving, queued, saving`, with nothing left to upload.
- On the fix: the spec is 5 of 5 green, and the full suite passes (110 tests).

## om-reviewer verification
