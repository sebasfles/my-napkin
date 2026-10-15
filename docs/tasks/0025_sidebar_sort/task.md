---
id: "0025"
title: sidebar_sort
type: feature
crew: pair
clearance: repo
branch: feat/0025_sidebar_sort
modules: [app]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-10-15
updated: 2026-10-15
---

# 0025 Choose how the sidebar orders a folder's diagrams

## Goal

The user chooses how the diagrams of a folder are ordered in the sidebar: by name, by creation date or by last edit, each ascending or descending, and the choice persists per browser, so a folder with many diagrams is read in the order that suits how he works.

## Scope

- A sort control in the header of the sidebar's Diagrams section: field (name, created, edited) and direction (ascending, descending), localized in es and en.
- Default is edited, descending, which is today's order; folders stay first, by name, whatever the choice.
- The pinned section keeps pin order; it is not sorted.
- The choice is persisted in localStorage, like the collapsed rail and the location, and read on load.
- The order held still under an open row menu (0021) keeps working under every sort.
- A pure comparator in `src/lib/tree.ts` with unit tests; the diagram-list spec gains one case.

## Out of scope

- Sorting folders by anything but name; sorting the pinned section; sorting the Libraries section.
- Server-side persistence of the choice.

## Acceptance

1. The Diagrams header shows the current sort; picking name, created or edited and a direction reorders the diagrams of the current folder at once, folders stay first by name.
2. Reloading the page keeps the chosen sort; a fresh browser shows edited, descending.
3. Pinned diagrams keep pin order under every sort.
4. With a row menu open the list holds still; it re-sorts when the menu closes, as today.
5. Unit tests for the comparator; the diagram-list spec covers the sort; suite green; screenshots of the sidebar with the control open at 390, 768 and 1280 px, light and dark, mocked data, in the workspace.

## Approach

- Module and layers touched: `app`, `src/lib/tree.ts` (comparator), the sidebar panel header component, the workspace provider or the localStorage helper that already keeps the rail and the location, `messages/{es,en}.json`, tests.
- Entities, endpoints, tables: none; `name`, `createdAt` and `updatedAt` are already on every item.
- Decisions:
  - One control with field and direction: chosen over two separate buttons because the header is narrow and one menu reads as one setting.
  - Name order is locale-aware (`localeCompare` with numeric collation): chosen over code-point order so "diagram 2" sorts before "diagram 10".
  - Default stays edited descending: chosen so nobody's list changes until he picks.

## Database

None.

## Infra

None.

## Design

None.

## Risks

- The header already holds the breadcrumb and actions; the control must fit at 390 px without wrapping.

## Depends on

None.

## Context & decisions

Decisions (Sebastian, through the om-manager):

- Adjustment to Scope bullet 4: the sort is stored in the `napkin.shell-layout` cookie, not in localStorage. The rail already lives there and `(editor)/layout.tsx` reads it on the server, so the control paints the stored sort on the first frame (`docs/modules/app/ard.md`, "the collapsed sidebar is a cookie"). Old cookie values parse to the default, edited descending. It is still per browser; nothing is persisted server-side.
- Adjustment to Scope: under "created" a row's time line shows when the diagram was created; under name and edited it shows the edit time, as today. The save indicator still replaces it on the open diagram. Without it a list sorted by created reads as unsorted.
- Adjustment to Approach decision 2: one name rule with numeric collation everywhere `byNameAsc` reaches (folders, the Move dialog's choices, the Libraries list), so "2" precedes "10" in every list. No user-chosen sort is added to Libraries.

Decisions (om-reviewer):

- Field and direction are independent, persisted as a pair; direction labels read in the field's terms (A to Z, Z to A; newest first, oldest first).
- Every sort breaks ties deterministically (another field, then id), so equal names or timestamps never swap between renders.
- The comparator is pure in `src/lib/tree.ts` and `childrenOf` takes the sort; folders keep the name rule whatever the choice.
- Risk correction: the breadcrumb sits on its own row, not in the header; the header holds the heading and two icon buttons, and the panel is `w-72` at every viewport, so 390 px is the same 288 px header.

Constraints:

- `holdOrder` keeps working unchanged under every sort; the ARD entry "the Diagrams list holds its order while a row menu is open" names this task as its revisit point and is updated in `document-task`.
- The cookie store keeps the `useSyncExternalStore` shape of `use-shell-layout.ts`, one cookie, one parser in `shell-layout.ts` with unit tests (`docs/modules/app/ard.md`, 2026-09-20 entries on stores).
- Colors only from theme tokens, every string in es and en (`docs/checks/styles.md`, `docs/checks/i18n.md`).
- E2E runs one suite at a time on this machine; ask the om-manager for the token before every Playwright run.

What review-task checks beyond the Pipeline:

- The diagram-list case creates its own folder with named diagrams (names that prove numeric order, an older diagram edited to tell created from edited), asserts order inside that folder only, and reloads to prove persistence.
- Unit tests cover each field and direction, ties, folders first by name, and a malformed or old cookie value.
- Screenshots of the sidebar with the control open at 390, 768 and 1280 px, light and dark, mocked data, in the workspace.

clearance: repo

## om-developer notes

### Round 1

Done:

- `src/lib/tree.ts`: `DiagramSort` (field and direction), `defaultDiagramSort` (edited, descending) and the pure `compareDiagrams`; `childrenOf` takes the sort, folders keep the name rule with the id as the last tie breaker.
- `byNameAsc` in `src/lib/diagrams.ts` collates numerically, so folders, the Move dialog's choices and the Libraries list read "2" before "10".
- `src/lib/shell-layout.ts`: the cookie carries `{panel}:{section}:{field}:{direction}`; an old two-part value or an unknown half parses to the default pair; `toggleSection`, `togglePanel`, the new `openSection` and `sortDiagrams` keep what they do not change, and `openShellPanel` now reads the stored layout so opening Libraries from the editor keeps the sort.
- `src/components/diagram-sort-menu.tsx`: one non-modal menu in the Diagrams header, trigger showing the field and an arrow; two radio groups, field and direction, with direction labels in the field's terms; picking keeps the menu open so both halves can be set while the list reorders behind it.
- `DiagramRow` takes `time`: under "created" the line shows `createdAt`, otherwise `updatedAt`; the line is now a `<time dateTime>`, test ids `created-at` and `updated-at`.
- Strings in es and en; unit tests in `tree.test.ts` and `shell-layout.test.ts`; one case in `diagram-list.spec.ts` with a `newDiagramNamed`, `diagramNames`, `diagramSort` and `sortDiagramsBy` in the helpers.

Decisions not in the plan:

- Ties: name breaks by creation (oldest first, which never moves), then id; created and edited break by name, then id. The direction flips only the primary field, so equal timestamps always read A to Z.
- The pinned section follows the time line rule too: the same diagram appears there and in its folder, and two different times for one diagram would read as a defect. Its order is untouched.
- The direction items are listed in the field's natural order: A to Z first for name, newest first for the dates.
- The sort menu repeats the row menu's `modal={false}` and its editor focus guard, for the same reason.

Pending:

- E2E (`diagram-list.spec.ts`) and the screenshots wait for the Playwright token; the screenshot script is ready in `.workspaces/0025_sidebar_sort/shots/` (mocked list, its own dev server on port 3100 with throwaway secrets, no AWS).

Deferred:

- `docs/modules/app/trd.md` still names `use-sidebar-collapsed.ts` and `sidebar-cookie.ts`, which are now `use-shell-layout.ts` and `shell-layout.ts`; fixed in `document-task`.

### Round 2

Done:

- Finding 1: `sortBy(field)` in `src/lib/tree.ts` gives a field its natural direction (name A to Z, created and edited newest first); picking a field in the menu applies it, the direction group then flips it, and the natural direction is listed first. Unit test added.
- Finding 2: the spec asserts the trigger's accessible name ("Sort: Edited, Newest first" and the rest) instead of `data-sort`, which is gone from the component; `sortDiagramsBy` asserts each radio item is checked.
- Finding 3: the restating comment in `tree.test.ts` is gone.
- Rebased on `origin/develop` after PR #42 (0028 account migration); round 1 is now `5938a65`.
- Finding 4: `diagram-list.spec.ts` ran on :3000 against the new dev account, 10 of 10 green, the sort case included; the dev server logged one "destination stream closed early" when the case navigated away mid-response, which failed nothing.
- Screenshots of the sidebar with the sort menu open, mocked list, in `.workspaces/0025_sidebar_sort/shots/`: `sidebar-sort-{390,768,1280}-{light,dark}-en.png` under name A to Z, and `sidebar-sort-390-{light,dark}-es.png` under created, newest first, to show the longest Spanish labels fit and the row times switch to creation.

Pending: nothing.
