# Replication: 0016 Switching diagrams flashes a full-screen loading state

## Preconditions

- `develop` at f7116f6 or later deployed on dev (0011 all phases merged).
- Two diagrams with content, both open as tabs.

## Steps

1. Open `https://napkin.dev.sdfles.com`, log in.
2. Open diagram A, then diagram B (double click so both stay as tabs).
3. Click tab A, then tab B, a few times; also single click other rows in the sidebar.

## Expected

The canvas content changes in place; sidebar, tab bar and the editor's toolbar stay painted; no loading text anywhere.

## Observed

On every switch the editor area is replaced by a full-screen loading state ("Loading" or "Loading scene") for a visible moment before the new diagram paints.

## Environment

- App version or commit: f7116f6
- Platform, browser or device: Chrome on Windows (WSL2 host), dev
- Environment: dev

## Evidence

- Sebastian, 2026-09-20, after 0011 phase 4 (PR #15) merged and deployed.
- `app/src/components/editor.tsx`: `loaded` state per `Editor` instance and `key={shown.id}` on `EditorCanvas`; either path yields a loading paint on switch if the instance or the canvas remounts.

## om-developer confirmation

Reproduced on deployed dev (`https://napkin.dev.sdfles.com`), 2026-09-20, on `934acdb` (0012 phase 1), before any code change.
Evidence lives under `.workspaces/0016_diagram_switch_flicker/repro/` and is never committed: a trace of a logged-in session carries the session cookie.

Measured, and this is the invariant Acceptance 2 names:

- The `.excalidraw` root is a different DOM node after a switch.
  On the first switch the sampler saw the original node at +10ms and a different one at +457ms, which matches the scene fetch that precedes the remount.
  Every switch refetches: six scene `GET`s for two opens and four switches, so nothing is served from a cache.
- Between the remount and the new content there is at least one painted frame with the editor chrome intact and the canvas empty: at +483ms the canvas is blank, at +503ms the rectangle is there.

Not observed, and it must not be read as absent:

- No Excalidraw `.LoadingMessage` and no app placeholder was observed in any sampled frame across the four switches of that run.
  The sampler reads about one state per frame (606 frames over the run), so this is "not observed in any sampled frame", not "did not paint".
- Only the first switch is independent evidence of a remount.
  The sampler compared each frame against the node captured when it installed, so once that node was replaced every later frame reported "replaced" whether or not it had changed again.
  Fixed afterwards (the comparison is now frame to frame), but the run that produced this confirmation carried the flaw.

Why the splash was on screen for Sebastian and not for the sampler, from the bundle rather than from inference:

- `LoadingMessage` is mounted twice by Excalidraw. The language gate renders it with **no delay** while the locale chunk for `langCode` loads, and `isLoading` renders it with `delay: 250`.
- Both are tied to mount, so the remount re-runs them on every switch.
  Warm, with the locale chunk already in the module registry and a scene of 600 to 1100 bytes, both windows close inside a frame.
  Cold, the same paint lasted over 1.6s in the first diagnosis run.
- So the fixtures used here (one and two rectangles) are below the threshold that makes the paint visible, and a before/after recording needs a heavier scene to show anything to the eye.

Recorded incidentally, and worth keeping: `repro/artifacts-run1-contaminated/` holds a frame where a rectangle belonging to the previously open diagram is painted under the next diagram's tab, while the sidebar and tab bar already show the new one.
That is the stale canvas `Context & decisions` drops, caught without looking for it.

## om-reviewer verification
