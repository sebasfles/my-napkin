---
id: "0023"
title: rename_dialog_focus
type: bug
crew: pair
clearance: repo
branch: bugfix/0023_rename_dialog_focus
modules: [app]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-10-14
updated: 2026-10-14
---

# 0023 The rename dialog opens with its input focused

## Goal

When the user opens Rename from a row menu, the name input already has the focus and its text selected, so he types the new name at once instead of clicking into the field first.

## Scope

- The name dialog (rename of a diagram, a folder and a library, and the create dialogs that share it) receives focus on open: the input is the active element and its current value is selected.
- Find the real cause: the input already declares `autoFocus`, so something takes the focus back after the dialog opens (the non-modal row menu returning focus to its trigger on close, or the editor reclaiming focus as in 0021).
  Fix the cause, not a deferred `focus()`.
- One e2e case in the item-menu spec: open Rename, type without clicking, Enter, the row shows the new name.

## Out of scope

- Any other dialog's focus (move, info, delete) unless it shares the same cause and the same fix.

## Acceptance

1. Open Rename from any row menu (diagram, folder, library): the input is focused with its text selected, on the first open and on every later one.
2. Typing and pressing Enter renames without a click into the field.
3. The item-menu spec covers it; suite green.

## Approach

- Module and layers touched: `app`, components only (`item-dialogs.tsx`, `item-row.tsx`, the row menu).
- Entities, endpoints, tables: none.
- Decisions:
  - Select the whole current name on open: chosen over a cursor at the end because the usual rename replaces the name entirely.
  - The menu stays non-modal (ARD 0011); the fix must not reintroduce modal behaviour.

## Database

None.

## Infra

None.

## Design

None.

## Replication

See `replication.md`.

## Risks

- The cause may sit in the menu's non-modal mode or in the editor's focus recovery; both have history in the ARD and must be read before changing anything.
- Where the focus lands today is not known; the replication must record it first.

## Depends on

None.

## Context & decisions

Consolidated 2026-10-14 by om-0023-reviewer with the om-manager.

Decisions:

- E2E coverage (Sebastian): one case in `item-menu.spec.ts`, run for diagram, folder and library rows; it is Scope's one case and covers Acceptance 1's three kinds.
  Each run opens Rename from the row menu, waits until the menu content is gone, asserts the input is focused with `selectionStart === 0` and `selectionEnd === value.length`, types with the keyboard without clicking, presses Enter and asserts the row shows the new name.
  The existing helpers (`renameThrough`, `newFolderNamed`) keep `fill`; the case does not reuse them.
- The case must be able to fail (om-reviewer, accepted): the suspected steal lands after the menu's close animation plus a timer, so asserting as soon as the dialog is visible could pass on `develop`.
  The om-developer runs the case on `develop` before the fix, sees it red, and records the failure and where focus landed in `replication.md#om-developer confirmation`.
- Move, Info and Delete (om-reviewer, accepted): if the fix sits in `RowMenu` it covers them too, which Out of scope allows as the same cause and the same fix; no per-dialog code and no extra cases for them.
- Replication (om-reviewer, accepted): locally only, `npm run dev` against dev's table, Chromium, once with a canvas open and once on `/` with none, since the editor is one suspect.
  The deployed dev site is not used (same `develop` commit, its password is outside `clearance: repo`); no other browsers.

Lead to verify, not to assume: Radix's non-modal `DropdownMenuContent` returns focus to its trigger on close (FocusScope unmount, after `setTimeout(0)`), and the dialog's trap cannot pull it back because `autoFocus` focused the input before the trap's `focusin` listener existed, so `lastFocusedElementRef` stays null (`@radix-ui/react-focus-scope` 1.1.2).
The fix goes at whichever cause the replication proves; a deferred or timed `focus()` is rejected.

Constraints:

- The row menu stays `modal={false}` (`docs/modules/app/ard.md`, 2026-09-20 "the item menu is not modal"); the dialogs stay mounted with `open` driven by state.
- The editor-focus refusal in `RowMenu.onFocusOutside` stays as is (`ard.md`, 2026-10-13 "a row menu ignores focus landing in the editor").
- The new-folder dialog shares `NameDialog`: its input must still be focused on open (empty value, nothing to select).
- Files under `src/components/ui/` are shadcn generated: customise at the call site, not there.
- No code comments unless essential; the cause, if it is a decision, goes to `ard.md` through `document-task`.

Review focus beyond the Pipeline: the case is red on `develop` as recorded, the selection is the whole name on every open (first and later), and focus after the dialog closes is no worse than on `develop`.

clearance: repo

## om-developer notes
