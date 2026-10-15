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

## om-reviewer verification
