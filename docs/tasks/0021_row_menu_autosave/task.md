---
id: "0021"
title: row_menu_autosave
type: bug
branch: bugfix/0021_row_menu_autosave
modules: [app]
repos: ["."]
phases: 0
depends_on: []
ticket: https://github.com/sebasfles/my-napkin/actions/runs/35630985274/job/106437288399
created: 2026-09-21
updated: 2026-09-21
---

# 0021 An open row menu jumps or closes when an autosave lands

## Goal

A row menu the user opened in the sidebar stays put and open until he acts on it or dismisses it, even if an autosave lands meanwhile.
Today the Diagrams list sorts by `updatedAt` desc (`app/src/lib/tree.ts`), so a save re-sorts the list under the open menu and the menu moves or closes.
The suite hits it in shared cleanup: `library-panel.spec.ts:93` failed in `afterEach` on dev (2026-09-21) and locally in 0017.

## Scope

- Reproduce E2E: draw, open a row menu within the saver's debounce, watch the menu when the save lands.
- Fix at the root in the app: the list order does not change while a row menu is open (freeze the order while a menu is open, or apply re-sorts only when nothing is open), so the user's target does not move.
- The e2e cleanup helper no longer needs a wait for "no save in flight"; if 0017 added one, it stays as a belt but the spec passes without it.
- Playwright: one case that opens a row menu, lands a save, and asserts the menu is still open on the same row.

## Out of scope

- A user-chosen sort order (draft `sidebar_sort`).
- Any change to the saver's debounce.

## Acceptance

1. Replication steps fail before the fix and pass after it.
2. `library-panel.spec.ts:93` and the new case pass three runs in a row locally.
3. Suite green.

## Approach

- Module `app`: `tree.ts` or the sidebar list component and the row menu state; `tests/e2e/helpers.ts`.

## Database

None.

## Infra

None.

## Design

None.

## Replication

See `replication.md`.

## Risks

- Freezing the order while a menu is open must not hide a diagram created or deleted meanwhile; re-sort on menu close.

## Depends on

None.

## Context & decisions

Consolidated 2026-09-21 by the om-reviewer with the om-manager and Sebastian.

Two findings from the ticket's own run reframe the task, both om-reviewer.
The belt the Scope assumes is missing is already in the tree: `savesSettled` (`app/tests/e2e/helpers.ts:608`) landed in 0017's commit `77258cd`, and the ticket's run is on `b2f2331`, the merge of that same PR, so the failure happened with the belt in place.
The menu closes, it does not only jump: the run logs two `element is not stable` retries, then `element was detached from the DOM, retrying`, then nothing until the 30 s budget ends, and `menu-delete` never resolves again.
Since `<li key={diagram.id}>` keys are stable, a re-sort moves DOM nodes without unmounting the menu, so the detach needs its own explanation.
The reproduction establishes why the content detaches before any fix is written and records it under `om-developer confirmation`.
If the close survives a frozen order it is still in scope: the Goal is that the menu stays put and open.

Decided, om-reviewer: the freeze covers the order, never the set, so a diagram created, deleted, renamed, moved or pinned while a menu is open stays visible.
Decided, om-reviewer: the rule is pure and lives in `app/src/lib/tree.ts` with unit tests, and React state holds only which menu is open.
`docs/modules/app/trd.md` calls `tree.ts` the pure tree and `tests/unit/` pure logic only, so the rule is unit testable and the e2e proves the flow rather than the sort.
Decided, om-reviewer: the freeze spans menu open to menu close and not the dialogs, which are modal, centred and not anchored to a row.
Decided, om-reviewer: pinned, folders and libraries need nothing, since `pinnedAt` and `byNameAsc` do not move on a save and only `childrenOf`'s `byUpdatedAtDesc` does (`app/src/lib/tree.ts:24`).
Decided, Sebastian: a second named e2e exception, delaying and never faking the browser's own scene PUT or PATCH through `page.route` and `route.continue()`, so the new case lands its save while the menu is demonstrably open instead of racing the 1500 ms debounce.
`document-task` writes that exception into `docs/conventions/e2e.md`, which `docs/checks/e2e-worth.md` reads as its reference.
Decided, Sebastian: the list does not reorder while a row menu is open and re-sorts when it closes.
That is a transient deviation from `docs/modules/app/prd.md:39` ("most recently edited first"), so `document-task` adds the sentence to `prd.md` and an entry to `docs/modules/app/ard.md`.

Adjustment to Acceptance 2, decided by Sebastian, because three local runs cannot separate a fix from luck when the bug already survived the belt and failed on deployed dev.
It becomes: the new case fails on `b2f2331` and passes on the fix; one full local suite green; and one local run of the new case and of `library-panel.spec.ts` with `savesSettled` removed, reported in the PR, before it goes back in.

Constraints the om-developer respects.
Row menus stay non-modal (`docs/modules/app/ard.md`, 2026-09-20, "the item menu is not modal"), since a modal menu that opens a dialog leaves the app unclickable.
`updatedAt` moves only when the scene was uploaded (`docs/modules/app/ard.md`, 2026-09-20), so a rename or a pin must still reorder nothing.
One suite at a time on this machine, decided by the om-manager: ask `om-my-napkin-manager` for the e2e token before every Playwright run, the reproduction included, and wait for it; nothing is pre-granted and 0020 shares the machine and the dev table.
Port 3000 is load bearing, not a default (`docs/modules/app/trd.md`, Testing): a busy port means waiting, not moving.
Strings through next-intl in `es` and `en`, colours from theme tokens (`docs/checks/i18n.md`, `docs/checks/styles.md`).

Correction to `replication.md`, om-reviewer: B has to be a row sitting above A before the save.
A jumping to the top moves only the rows between the top and A's old slot, so with B below A the steps pass on a healthy app and a broken one alike.
The Observed line is sharpened the same way: the menu closes.

In `review-task`, beyond the Pipeline, I check that the new case cannot pass unless the save lands during the open menu, that the freeze is released on every close path (select, Escape, outside click), and that no row menu became modal.

## om-developer notes
