---
phase: 3
branch: feat/0011_workspace_redesign-phase-3
updated: 2026-09-19
---

# Phase 3: tabs

## Scope

- Tab bar above the editor: single click opens a preview tab (italic) replaced by the next single click; double click or an edit promotes it to fixed; close button per tab.
- Keyboard: Alt+1..9 jump, Alt+Shift+Left/Right cycle, Alt+W close; bindings do not fire while Excalidraw owns the key.
- Open tabs, the preview tab and the active tab persisted in `localStorage`; a tab whose diagram was deleted closes itself; a tab whose diagram was renamed updates.
- The open diagram is highlighted in the sidebar and its path shows in the breadcrumbs.
- Pure tab reducer in `src/lib/` with unit tests; Playwright spec for tabs.

## Acceptance

1. Task acceptance 6, 7, and 9 for this phase's flows.
2. Task acceptance 10 completed: PRD and app module docs describe the final product.
3. PR description carries screenshots, light and dark, of the tab bar with a preview and fixed tabs.

## om-developer notes

## Result
