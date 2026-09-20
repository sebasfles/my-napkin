---
phase: 1
branch: feat/0011_workspace_redesign-phase-1
updated: 2026-09-19
---

# Phase 1: foundation

## Scope

- Geist Sans and Geist Mono through `next/font`, applied to every text outside the canvas.
- Tokens in `globals.css` reworked: spacing, radii, surfaces, borders, focus rings, motion; light and dark.
- Every existing surface reworked to them: login, sidebar, diagram rows, save indicator, confirmation dialog, empty and error states, theme and locale controls, logout.
- Three-dot menu on every diagram row with Rename (dialog), Lock / Unlock, Delete (confirmation naming the diagram; a locked diagram asks to unlock first), Info (dialog).
- Metadata: `lockedAt`, `elementCount`, `sceneBytes` stored on the item; the browser sends the last two on every save; Info shows name, created, last edited, locked since, element count, scene size.
- Lock: locked diagram opens in view mode (laser, pan, zoom allowed), saver not mounted, lock glyph on the row.
- shadcn components added through its CLI: dropdown-menu, dialog, tooltip.
- Unit tests for the new pure logic; Playwright spec for the item menu (rename, lock, delete, info).

## Acceptance

1. Task acceptance 1, 2 and 8 (minus Pin and Move), and 9 for this phase's flows.
2. Existing flows (login, create, open, rename in place if kept, delete, save) still pass the full local suite.
3. PR description carries screenshots, light and dark, of login, sidebar, menu and each dialog.

## om-developer notes

## Result
