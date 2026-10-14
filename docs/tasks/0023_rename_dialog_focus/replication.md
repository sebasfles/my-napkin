# Replication: 0023 rename_dialog_focus

## Preconditions

- Logged in, at least one diagram in the list.

## Steps

1. Open the app and the Diagrams section of the sidebar.
2. Open a diagram's row menu and click Rename.
3. Without clicking anywhere, type a new name and press Enter.
4. Repeat from a folder's row menu and from a library's row menu in the Libraries section.

## Expected

The dialog opens with the input focused and the current name selected; typing replaces it and Enter renames the row.

## Observed

The dialog opens but the input is not focused; typing goes nowhere until the user clicks into the field.
Where the focus lands (nothing, the menu trigger, the canvas) is unknown and must be recorded here before the fix.

## Environment

- App version or commit: develop at the start of the task
- Platform, browser or device: desktop, to confirm whether it happens in every browser
- Environment: local and dev

## Evidence

- Reported by Sebastian on 2026-10-14; none recorded yet.

## om-developer confirmation

- Date: 2026-10-14.
- Commit: `e0833a2` (develop at the start of the task), locally with `npm run dev` against dev's table, Chromium through Playwright.
- Result: reproduced, on a diagram row with its canvas open and on a folder row at `/` with no canvas alike, so the editor is not involved.
- Where the focus lands: neither on the trigger nor in the editor.
  A focus trace after clicking Rename read, for the diagram row with the canvas open:

  ```
  130ms focusin  menu-rename
  499ms focusin  name-input                 (autoFocus)
  753ms focusout name-input -> dropdown-menu-content
  775ms focusout dropdown-menu-content -> null
  779ms menu content removed
  active: body
  ```

  The folder row at `/` traced the same, input to menu content to body within 220 ms, and so did the second open of each.
- Cause: the row menu is still mounted through its exit animation when the dialog's overlay appears under the pointer, so the pointer leaves the Rename item and Radix's menu runs `onItemLeave`, which focuses the menu content (`@radix-ui/react-menu` 2.1.24).
  The dialog's focus trap would pull focus back to the last element it saw focused, but the input took focus through `autoFocus` while React committed, before the trap's `focusin` listener existed, so the trap has nothing to return to and focus falls to `body` when the menu content unmounts.
  The lead in `Context & decisions` (the menu returning focus to its trigger) does not happen: the input's focus counts as an interaction outside the non-modal menu, which then skips its trigger.
- The new case in `item-menu.spec.ts` fails on this commit for all three kinds at its focus assertion (`the first rename opened without focus in its input`, received `inactive`); the diagram run was confirmed on a second, warmed-up run after the first spent its budget on the dev server's cold compile.

## om-reviewer verification
