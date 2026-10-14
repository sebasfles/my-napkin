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


### After delegation

clearance: full, limited to what the task names: AWS dev through the `personal` profile (the `napkin-dev-diagrams` table and the dev scenes bucket, which every Playwright run reads and writes) and `napkin.dev.sdfles.com` for a `BASE_URL` run. No Terraform apply, nothing in prd.

Adjustment to Acceptance 3, Sebastian through the om-manager: it read "Suite green", which 0021 cannot deliver while specs it does not own are red.
It becomes `library-panel.spec.ts:93` and the new case green, and no spec that passed before the change failing after it; whole-suite green stays in 0020.

Operational, om-manager: one suite at a time on this machine, e2e token granted per run and not per task, every run requested through the om-reviewer and waited for, the reproduction included.

The footprint in `napkin-dev-diagrams` is recorded at https://github.com/sebasfles/my-napkin/pull/34#issuecomment-5768613016, reading 3, which `om-developer confirmation` cites.
Cite reading 3 alone: that comment's intro and reading 2 carry counts its own table contradicts.

The reproduction is four cases rather than one, and the reason is a finding.
`library-browser.spec.ts:49`, `item-menu.spec.ts` "a locked diagram asks to be unlocked before it can be deleted" and `editor-switch.spec.ts:434` all carry `:93`'s signature, and the first is a name-sorted list of one row with no autosave anywhere in the spec, so the cause named in Goal cannot be the cause there.
Standing instruction: if a row menu detaches with no re-sort available to blame, no fix is written and it comes back as a redirect rather than a wider patch.

### Relaunch, 2026-10-13

A relaunch: the previous om-reviewer and om-developer are both gone and nothing had been committed or pushed.
Their four instrumented reproduction cases were inherited from the worktree rather than rewritten.
The branch is rebased onto `origin/develop` at `7a717e3`, which carries 0020.

0020's fix `52270d3` changed when the saver arms (`app/src/components/editor.tsx`, `app/src/lib/editor.ts`), so every timing conclusion the previous session reached against `4b7a50b` was re-tested rather than carried over.
The premise was verified on the new base instead of assumed: `deploy-dev` run `38497207353` on `7a717e3` still fails `library-panel.spec.ts:93` in `afterEach` on the `menu-delete` path.
The Acceptance 3 pre-existing list is 0020's four (`library-import:30`, `library-insert:29`, `library-insert:73`, `library-panel:27`), still red after 0020 merged and now owned by task 0022; they are not to be touched or chased.

The reproduction ran on `7a717e3` and established the cause by experiment, with a control.
Clicking a row-menu trigger while the editor's own context menu is open is the pointerdown that closes that context menu, whose close callback calls `focusContainer()` (`@excalidraw/excalidraw` 0.18.1, `dist/dev/index.js:30020`).
Focus leaves our non-modal row menu, `dismissableLayer.focusOutside` fires with target `excalidraw`, and the menu is dismissed; `Presence` and its `duration-100` exit are only how it leaves, which is what the logs' "not stable", then "not visible", then "detached" had been showing all along.
The control, the same case with Escape pressed on the context menu first, produces no `focusOutside` and the click lands.
So the close, which is what breaks the suite, is not the re-sort named in Goal, and freezing the order fixes none of it.
The jump is real and separate: the open menu moves one row, y 172 to y 222, while staying open on the same trigger. Cosmetic.
The first figure recorded here was y 168.6, taken while the menu was still playing its own open animation; the cases now measure after `getAnimations()` settles, and the earlier number was an artefact of the test rather than of the product.
`library-browser:49` is still unexplained; its case could not meet a precondition of one library row against a shared table holding three, and has been amended to assert only its own row. Only its red will be conclusive.

### Re-scope, approved by Sebastian 2026-10-13

Goal unchanged: "stays put and open" was always two requirements and the run separated them.
What was wrong is the diagnosis under Goal, which named the `updatedAt` sort, and the Approach built on it.

The primary fix is the close: the row menu refuses `onFocusOutside` when focus lands inside the editor container, and only then.
A blanket refusal is not acceptable, because a genuine click away must still dismiss the menu.
The order freeze stays in scope as the second, smaller half, for the jump case 1 measured.
`replication.md` gains the close's precondition, a shape right-clicked so the editor's context menu is open before the row menu is opened; its current steps reproduce the jump alone and would pass on an app still broken in the way that matters.
The `library-browser:49` case asserts only its own row, since the shared table holds other libraries.

In `review-task`, beyond the Pipeline, I check five things.
That the refusal is scoped to the editor container and nothing wider.
That a test proves a real outside click, an Escape and an item select all still dismiss the menu, because the way this fix fails is by leaving menus stuck open, and no suite failure would reveal it.
That `library-panel.spec.ts:93` is green for the reason intended, not because a timing changed.
That the freeze releases on every close path.
That no row menu became modal, per `docs/modules/app/ard.md` 2026-09-20.
`library-browser:49` stays unexplained until something shows it; only its red is conclusive.


## om-developer notes

### Round 1

Done.

- The close: `RowMenu` refuses `onFocusOutside` only when `isInEditor(event.target)`, which is `closest("[data-editor-region]")`, an attribute on our own editor wrapper in `editor.tsx`. `pointerDownOutside` and Escape are untouched. In the package's dist, canvas pointerdown reaches the document (only the wysiwyg textarea stops it), and Radix reads Escape on the document in the capture phase, so neither depends on focus.
- The jump: `holdOrder(rows, held, items)` in `tree.ts`, pure, with 5 unit tests. `SidebarPanel` holds `{ menu, order }` from a row menu's open to that row's own close.
- e2e in `item-menu.spec.ts`. The proof that menus still close is the three split cases "a row menu opened over the editor's context menu stays open, until Escape | a click on the canvas | an item is chosen". Each asserts that the editor took focus, that the menu is still `data-state="open"`, and then, after the close, that the trigger reads `data-state="closed"` and the menu is gone. The three autosave cases cover the same close paths and assert that the list takes the save's order after each.
- `replication.md` leads with the close's steps.

Evidence, all local against AWS dev.

- Red without the fix (`app/src` at `7a717e3`, tests kept): the 3 autosave cases failed on "the save moved the open row menu". The 3 editor cases each failed on the `data-state="open"` check.
- Green with `savesSettled` removed (Acceptance 2): the 3 autosave cases passed with the menu at x 127, y 172, 192 by 185 before and after the save on every close path. Earlier, in the same configuration, `item-menu`, `library-panel` and `library-browser` passed in full, `:93` and `:49` included.
- Full suite with `savesSettled` restored: 96 of 96, `verify.log`. 0020's four (`library-import:30`, `library-insert:29`, `library-insert:73`, `library-panel:27`) passed locally and are still red in `e2e-dev`; owned by 0022.
- The row "e2e repro link into mv7khc00-5", leaked by the reproduction's case 3 cleanup, was deleted through the app. `repro-0021.spec.ts` is gone.

Decisions not recorded above.

- The editor is recognised by an attribute we own, not by a package class, so no package-name debt is created.
- After a refused focus move, focus stays in the editor, so the open menu needs a pointer to be navigated; arrows go to the editor until then. Accepted: the refusal only happens on a pointer path.
- The panel's state is `{ menu, order }` rather than only which menu is open, because the order to hold cannot be derived once the save has landed.
- A diagram created while a menu is open is appended below the held rows, so the target does not move. The hold lets go when the row that owns the menu is gone, since that menu can then never report its close.
- The hold covers diagram and folder row menus in the panel, pinned ones included. Library rows get the refusal but no hold, since `byNameAsc` and `pinnedAt` do not move on a save.
- `isInEditor` reaches the DOM, so it is outside the Node unit suite, and its correctness rests on the three editor cases.
- Test instruments: a menu's openness is asserted through `data-state`, never visibility, since a dismissed menu stays visible through its 100 ms exit. A menu's box is measured after its open animation. Each close path is its own test, so each can be seen red.

Deferred.

- The comment above `savesSettled` in `app/tests/e2e/helpers.ts` still names the re-sort as how a delete loses its menu, which this task disproved. The file is outside this diff.
- `library-browser:49` stays unexplained, a residual the om-reviewer records.

### Round 2

- Rebased onto `origin/develop` at `4a6502b` (0022's planning commit, docs only); round 1 is now `ccc2d87`.
- The `savesSettled` comment in `app/tests/e2e/helpers.ts` no longer names the re-sort as the cause of the close. It says what the belt does, why it is kept, and that it does nothing in the libraries section; its assertion message no longer claims the list is moving. This closes round 1's deferred item.
- `verify.log` is run at this round's own commit, after the notes, so the commit reported is the commit verified.
