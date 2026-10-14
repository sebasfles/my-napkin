# Replication: 0021 row_menu_autosave

## Preconditions

- Logged in, two or more diagrams in the same folder, the list sorted by last edit.

## Steps

The close, which is what breaks the suite:

1. Open a diagram, draw a shape and wait for "Saved".
2. Right-click the shape, so the editor's context menu is open.
3. With that menu still open, open the row menu of any diagram in the sidebar.
4. Click an item of the row menu.

The jump, the smaller half:

1. Open diagram A and draw a shape.
2. Within 1.5 s, open the row menu of diagram B, a row sitting above A.
3. Wait for the save indicator to go from "Saving" to "Saved".

## Expected

The row menu stays open where it was until the user picks an item or dismisses it, and the item clicked runs.

## Observed

The close: the row menu opens and is dismissed within a few frames, so the item click never lands.
In the suite this is `locator.click` on `menu-delete` timing out after "not stable", "not visible", "detached" (`library-panel.spec.ts:93`, afterEach).
The jump: when the save lands, A moves to the top and B's row and its open menu move down one row; the menu stays open.

## Environment

- App version or commit: `b2f2331`
- Platform, browser or device: any
- Environment: dev and local

## Evidence

- https://github.com/sebasfles/my-napkin/actions/runs/35630985274/job/106437288399, failure 5.
- 0017 round 1 local run: same spec, same hook, snapshot showing a healthy app with a live "Saved" indicator.

## om-developer confirmation

2026-10-13, on `7a717e3`, one serial run of `app/tests/e2e/repro-0021.spec.ts` against AWS dev (MemAvailable 3609832 kB at start).

- Reproduced, but not as `Observed` says. The menu that closes is closed by the editor taking focus back, not by the re-sort.
- `library-panel.spec.ts:93` ends with the editor's context menu open. Its popover closes on a document `pointerdown`, and its `onClose` runs `focusContainer()` once the close commits (`@excalidraw/excalidraw` 0.18.1, `dist/dev/index.js:30020`). The cleanup's click on a row trigger is that same pointerdown.
- Case 4 "open" (`:93`'s shape) failed: trigger pointerdown, focus into `dropdown-menu-content`, menu `open`; 18 ms later focus moves to the `.excalidraw` container, `dismissableLayer.focusOutside` fires on it, the menu reads `closed` 8 ms later and leaves the DOM 100 ms after that. `menu-delete` timed out after two "not stable" retries, as on dev.
- Case 4 "closed" (the same steps with Escape pressed on the context menu first) passed: no focusOutside until the delete dialog took focus, `menu-delete` clicked.
- Case 1 (this file's steps): the save moved the open menu down one row (y 172 to 222 once settled; the 168.6 first recorded was a frame of its open animation) and the menu stayed open on the same trigger. The jump is real, the close does not come from it.
- Case 2 (menu-delete clicked while the save re-sorts): clicked; did not reproduce on this attempt.
- Case 3 (`library-browser.spec.ts:49`'s shape): did not run to its question. Its precondition of one library row failed against 3 libraries already in the shared dev table, so it is neither red nor green and `:49` stays unexplained.
  The case now asserts only its own row, so it can run in the next run; only its red is conclusive.
- Footprint: reading 3 of https://github.com/sebasfles/my-napkin/pull/34#issuecomment-5768613016 (the `e2e no context library` pairs are `:93`'s failed cleanups). This run's own afterEach hooks all completed.

## om-reviewer verification
