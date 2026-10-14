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

Decided before round 1, om-reviewer, on the om-developer's question: React's `stopPropagation` alone does not reach the Sidebar's listener, because Next 16 hydrates on `document` (`next/dist/client/app-index.js:33`), so React's root and the package's keydown listeners share that node.
The input stops Escape with `stopPropagation` plus `nativeEvent.stopImmediatePropagation()`, which holds because React registers at hydration, before the package's effects; the add-selection dialog stops it in `DialogContent`'s `onEscapeKeyDown`, in Radix's document capture phase.
Both e2e cases are shown red once without the stop, and the listener-order dependency goes to `docs/modules/app/ard.md` as debt through `document-task`.

## om-developer notes

### Round 1

Did:

- `src/lib/library-search.ts`: `itemMatcher` (NFD, marks stripped, lowercase, trimmed query, blank query is no query, an absent or blank name never matches) and `matchingIds`; unit tests in `tests/unit/library-search.test.ts`.
- `library-panel.tsx`: the query lives in `LibraryPanel`, outside the `Sidebar`; the search input sits between the header and the scroll area, hidden with no linked library, not autofocused, with a clear button that returns focus to the input.
  Item loading moved from each section to one `useLinkedItems` hook in the panel, so the panel knows when every section has settled and can show the one panel-wide empty line.
  Non-matching thumbnails stay mounted with `hidden`; a section with no match keeps its grid mounted and hidden.
- Escape: with a non-empty query the input calls `stopPropagation` and `nativeEvent.stopImmediatePropagation()` and clears; with an empty query it falls through and the package closes the panel.
- Add-selection dialog: confirmed by e2e on develop's code that Escape closed the panel along with the dialog (`library-add-selection.spec.ts`, red: panel not found); fixed with `onEscapeKeyDown={(event) => event.stopPropagation()}` on its `DialogContent`.
- Both Escape cases were run red once without their stop: the panel case failed with the panel closed, the dialog case with the panel closed. Green with them.
- e2e: `panelItems` now counts visible items only; three new cases in `library-panel.spec.ts`, fixture `tests/e2e/fixtures/search.excalidrawlib` (Arrow, Señal, Toolbox, one unnamed).
- Screenshots: 12 in `{{WORKSPACE}}/screenshots/` from `{{WORKSPACE}}/screenshots.mjs`, mocked API and S3, never committed.

Decisions not in the plan:

- Escape clears whenever the input holds any text, whitespace included, so a blank query is cleared rather than closing the panel with it hidden in the input.
- A failed section counts as settled for the panel-wide empty line, since it can never load a match; it keeps its own error line.
- The header of a section carries `aria-disabled` and ignores clicks while a query is active, rather than becoming a non-button, so focus order does not change while typing.

Observed, not fixed:

- The first red run's cleanup failed (a row menu detached while another workspace's suite reordered the shared list) and left one diagram; it was removed through the UI.
- Deferred, pre-existing: at 390 px the app sidebar keeps its full width and leaves the editor a sliver, and at 768 px the panel sits with a gap to its right; both predate this task (sidebar layout, 0017), visible in the screenshots.
- Deferred, pre-existing: the lint warning on `window.location.assign` in `src/lib/api.ts` is the documented 401 decision.

Pending:

- e2e is red at this commit, three full runs, a different failure each time, all in the diagram list and folders (row menus and renamed rows not appearing), none in the Libraries panel; details in `verify.log`.
  The first run overlapped the deploy-dev e2e on the shared table; the other two had no CI run alongside.
  Not fixed here, since it is outside Scope: it needs its own investigation of the row list under a shared table.
- Left untouched in the dev table: "e2e menu typed rename mv8bxtnx-1", from 0023's suite, not this one.

### Round 2

Findings applied:

1. Suite green: the three round 1 failures had environmental causes. None came from this change, and none of them needed a code change:
   - Run 1, `diagram-list.spec.ts:61`: the top row was "e2e link into mv8celpx-75", created 16:47:08Z by deploy-dev's `e2e-dev` job (16:39:23Z to 16:52:26Z) on the same dev table, 5 s before this suite's row. The test stays as is; the reviewer now checks for a running `e2e-dev` job before granting the token.
   - Run 3, `diagram-list.spec.ts:129` and `folders.spec.ts:82`: the host was suspended. The journal is empty from 12:38 to 13:26 and from 13:30 to 13:57 local (17:38Z to 18:26Z, 18:30Z to 18:57Z). Test 9 created its row at 17:38:34Z and died with "session closed"; test 25 created its row at 18:57:29Z, on resume. Playwright counted 16.3 min for a run whose wall clock spans about 75 min.
   - Run 2, `folders.spec.ts:158`: the open row menu was remounted under the click on Delete ("not stable", then "detached"). It did not reproduce: 3 of 3 alone after run 2, then 10 of 10 with `--repeat-each=10 --trace retain-on-failure` on c46a341, 19:41Z to 19:43Z. It is recorded as a one-off. If it reappears it is a row-menu task after 0023, not this one.
   - Develop baseline at a42a1f9 (origin/develop), full suite with traces kept, 19:26:50Z to 19:41:09Z: 96 of 96 green, no CI run, no journal gap.
   The error-context files of round 1 were deleted after run 3, so this analysis rests on the call logs in `.verify/`, the timestamps in the e2e names and the journal; every run keeps its `test-results` from now on.
2. `verify.log`: from this round the block names the round commit, and every artefact is newer than it.

### Round 3

- Screenshots at 390 retaken with the app sidebar collapsed to its rail (cookie `napkin.shell-layout=closed:diagrams`, as a phone user would leave it): the search input, the counts and the no-match line are on screen in light and dark.
  The earlier 390 shots stay beside them as `*-sidebar-open.png`, evidence of the pre-existing layout where the open sidebar takes 336 of the 390 px.
- Seen in the new shots: the editor package's sidebar stops about 35 px short of the right edge at 390, and the trigger shows through the gap. This is the same gap as at 768 and predates this task; deferred with the other layout item.
- No code change; the round names 8812005 again, and these notes stay uncommitted until the docs commit.

### Round 4

Finding: the panel stopped short of the right edge at 390 and 768.

- Cause, measured in the live DOM:
  - The package's compact layout (`.excalidraw--mobile`, at 390 with the rail and at 768) caps its toolbar row at `98vw` of the viewport, not the editor this shell narrows. It appends our `renderTopRightUI` trigger to that row.
  - The row overflowed `.excalidraw` (overflow-x hidden): 13..425 against 48..390, and 310..795 against 336..768.
  - Clicking the trigger scrolled the surface: scrollLeft 0, then 35 and 27, exactly the gap, with every overlay shifted.
  - A real user at 390 could not reach the trigger at all (389..425); at 768 only 9 px of it showed.
- Fix, scoped under `.napkin-editor` in `globals.css`, no package patch:
  - `overflow: clip` on `.excalidraw`, so the surface can never scroll sideways.
  - In the compact layout the existing `Sidebar.Trigger`'s label is positioned as a second right-edge tab under the package's lock and hand tab, styled like it.
  - An inset focus ring on the trigger, which had none: focus lands on the package's hidden checkbox.
  - 1280 at rest is pixel-identical before and after (0 differing pixels, editor area, light).
- Spec: `library-panel.spec.ts` gained one case at 390 (rail) and one at 768. Each reads the trigger's and editor's boxes before any click, then asserts the open panel's right edge equals the editor's.
  - Red without the CSS: trigger right edge 425.5 > 390 and 794.5 > 768 (`.verify/round-4-red.out`, `test-results/round-4-red`).
  - Green with it.
- Keyboard: Tab from the previous tabbable reaches the trigger at 390, 768 and 1280, before and after, and the ring is fully visible in each.
- Pre-existing, not changed: Space on the focused trigger does not open the panel at any width, before or after.
- Pre-existing debt, recorded for `document-task`: the package's compact toolbar is wider than the editor narrowed by the shell. At 390 the selection tool is clipped on the left, and at 768 the last tool runs under the right-edge tab.
- Screenshots: 390 and 768 retaken (filtered, no match, closed; light and dark); 1280 unchanged.
