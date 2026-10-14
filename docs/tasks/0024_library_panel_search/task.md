---
id: "0024"
title: library_panel_search
type: feature
crew: pair
clearance: repo
branch: feat/0024_library_panel_search
modules: [app]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-10-14
updated: 2026-10-14
---

# 0024 Search the items of the editor's Libraries panel

## Goal

With many items in his libraries, the user types part of a name in the editor's Libraries panel and sees only the matching items, across every linked library, so he finds a component without scrolling the grids.

## Scope

- One search input at the top of the Libraries panel, above the sections, with a localized placeholder, cleared with Escape or its clear button.
- Filtering by item name, case and accent insensitive, substring match, across all linked libraries at once; unnamed items match nothing.
- While a query is active every section stays visible with its matching items and a count "n of m"; a section with no match collapses to its header and says so; the panel says no item matches when nothing matches anywhere.
- Clearing the query restores every section as it was, collapsed state untouched.
- A pure filter function in `src/lib/` with unit tests; the panel spec gains the search case.

## Out of scope

- Searching the library canvas or the sidebar's Libraries browser.
- Searching by tags or by the drawing's content; persisting the query.
- Deferred: fuzzy matching.

## Acceptance

1. Typing "arr" shows only items whose name contains "arr", any case, accent insensitive, in every linked library; the others are hidden.
2. A library with no match shows its header with "0 of m" and no grid; no match anywhere shows one empty-state line.
3. Escape or the clear button restores the full panel.
4. Insert by click and by drag keeps working on a filtered item.
5. Unit tests for the filter; the panel spec covers search; suite green; screenshots of the panel (filtered, no match) in light and dark in the workspace.

## Approach

- Module and layers touched: `app`, `library-panel.tsx`, `src/lib/` (filter), `messages/{es,en}.json`, `tests`.
- Entities, endpoints, tables: none; filtering runs over the items already loaded, no fetch.
- Decisions:
  - One global input over every linked library: chosen over one input per section because the user does not know which library holds the item.
  - Unnamed items never match: chosen over matching them on an empty query because a search is a search by name.
  - The input lives inside the package's `Sidebar`, so keystrokes must not reach the editor's shortcut handler while typing; follow what the add-selection dialog already does.

## Database

None.

## Infra

None.

## Design

None.

## Risks

- Keystrokes inside Excalidraw's `Sidebar` may reach the editor's shortcut handler.

## Depends on

None.

## Context & decisions

Consolidated 2026-10-14 by om-0024-reviewer with the om-manager and Sebastian.

Decisions:

- Collapse during a query (Sebastian): a section with matches shows them even if the user collapsed it, and its header is not a toggle while a query is active; clearing gives each section back its own collapsed state.
- A section with no match (Sebastian): header only, count reading "0 of m", chevron closed, no extra line; the one panel-wide empty line is shown only when nothing matches anywhere.
- Lifetime (Sebastian): the query lives in `LibraryPanel`, outside the package's `Sidebar` (which unmounts its content on close), so it survives closing and reopening the panel on the same diagram; it goes with a diagram switch (the panel is keyed by diagram) or a reload.
- Escape (Sebastian): with a query, Escape clears it and stops there; with an empty query it falls through and the package closes the panel as today.
- Matching (om-reviewer): NFD, combining marks stripped, lowercase, on both sides, so "n" matches "ñ"; the query is trimmed, a whitespace-only query is no query, and an item whose name is absent, empty or whitespace never matches.
- "n of m" (om-reviewer): m is the section's loaded items; a loading section keeps its skeleton, a failed one its error line, and the panel-wide empty line appears only once every section has loaded.
- Layout (om-reviewer): the input sits fixed between the header and the scroll area, is not autofocused, has a localized placeholder and clear button label, and is hidden when no library is linked.
- Performance (om-reviewer): non-matching thumbnails stay mounted and hidden, so typing never re-exports a thumbnail SVG.

Adjustments:

- Scope, added (Sebastian): Escape inside the add-selection dialog very likely closes the panel along with the dialog, by the same listener; the e2e confirms it and, if confirmed, this task fixes it with the same stop. Record what the run showed in `om-developer notes`.
- Acceptance 5, widened (Sebastian, global rule): screenshots at 390, 768 and 1280 px, light and dark, filtered and no match (12), mocked data, in `{{WORKSPACE}}/screenshots/`, refreshed every round, never committed.

Constraints:

- The Approach's "follow the add-selection dialog" holds for every key but Escape: the editor's container `onKeyDown` ignores writable targets except Escape, and the package's `Sidebar` adds a document `keydown` that closes an undocked sidebar on Escape (`@excalidraw/excalidraw` 0.18.1, dev build). Stop Escape at the input with React's `stopPropagation`; no document or window listener of our own, and no new chord in `shortcuts.ts` (`docs/modules/app/trd.md#Keyboard`).
- The filter is pure in `src/lib/`, `import type` only from the package (`docs/modules/app/ard.md`, the lazy serializer entry, and the debt on `library-file.ts`); unit tests in `tests/unit/`.
- Strings in `es` and `en` through next-intl, colours from theme tokens only (`docs/checks/i18n.md`, `docs/checks/styles.md`); `src/components/ui/` stays as generated.
- The e2e drives the real app against dev, mocks no network, cleans up through `removeItemsCreatedHere` (`docs/checks/e2e-worth.md`); screenshots are a separate script, not a spec.
- One suite at a time on this machine (om-manager): ask `om-my-napkin-manager` for the e2e token before every Playwright run and wait for it; 0023 shares the port and the dev table.

Review focus beyond the Pipeline: `library-panel.spec.ts` covers filtering across two linked libraries, "n of m", a zero-match section, the panel-wide empty line, the clear button, Escape clearing with the panel still open, typing in the input (a tool key and Backspace with a shape selected) leaving the canvas untouched, and click and drag insert of a filtered item.

clearance: repo (workspace commands, plus the local e2e against dev through `.env.local` as `docs/TRD.md` defines)

## om-developer notes
