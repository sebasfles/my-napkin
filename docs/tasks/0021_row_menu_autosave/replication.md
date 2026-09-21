# Replication: 0021 row_menu_autosave

## Preconditions

- Logged in, two or more diagrams in the same folder, the list sorted by last edit.

## Steps

1. Open diagram A (not the most recently edited one) and draw a shape.
2. Within 1.5 s, open the row menu of another diagram B in the sidebar.
3. Wait for the save indicator to go from "Saving" to "Saved".

## Expected

B's row menu stays open where it was.

## Observed

When the save lands, A moves to the top of the list, B's row shifts, and the menu jumps with it or closes.
In the suite: `locator.click` on a menu item times out because the element moved or detached (`library-panel.spec.ts:93`, afterEach).

## Environment

- App version or commit: `b2f2331`
- Platform, browser or device: any
- Environment: dev and local

## Evidence

- https://github.com/sebasfles/my-napkin/actions/runs/35630985274/job/106437288399, failure 5.
- 0017 round 1 local run: same spec, same hook, snapshot showing a healthy app with a live "Saved" indicator.

## om-developer confirmation

## om-reviewer verification
