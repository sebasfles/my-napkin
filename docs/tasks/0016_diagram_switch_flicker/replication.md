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

## om-reviewer verification
