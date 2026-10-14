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

## om-reviewer verification
