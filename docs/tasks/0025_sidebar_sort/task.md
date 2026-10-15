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
