---
phase: 1
branch: feat/0011_workspace_redesign-phase-1
updated: 2026-09-19
---

# Phase 1: foundation

## Scope

- Geist Sans and Geist Mono through `next/font`, applied to every text outside the canvas.
- Tokens in `globals.css` reworked: spacing, radii, surfaces, borders, focus rings, motion; light and dark.
- Every existing surface reworked to them: login, sidebar, diagram rows, save indicator, confirmation dialog, empty and error states, theme and locale controls, logout.
- Three-dot menu on every diagram row with Rename (dialog), Lock / Unlock, Delete (confirmation naming the diagram; a locked diagram asks to unlock first), Info (dialog).
- Metadata: `lockedAt`, `elementCount`, `sceneBytes` stored on the item; the browser sends the last two on every save; Info shows name, created, last edited, locked since, element count, scene size.
- Lock: locked diagram opens in view mode (laser, pan, zoom allowed), saver not mounted, lock glyph on the row.
- shadcn components added through its CLI: dropdown-menu, dialog, tooltip.
- Unit tests for the new pure logic; Playwright spec for the item menu (rename, lock, delete, info).

## Acceptance

1. Task acceptance 1, 2 and 8 (minus Pin and Move), and 9 for this phase's flows.
2. Existing flows (login, create, open, rename in place if kept, delete, save) still pass the full local suite.
3. PR description carries screenshots, light and dark, of login, sidebar, menu and each dialog.

## om-developer notes

### Round 1

Built: the typeface and the token rework, every existing surface reworked to them, the three-dot item menu with Rename, Lock, Info and Delete, the metadata fields, and lock as view mode.
Rename in place is gone, as `Context & decisions` asks.

Decisions the plan did not already record:

- The typeface is the `geist` npm package, which is `next/font/local` over woff2 files it ships, so the build reaches no font host.
  `--font-geist-sans` and `--font-geist-mono` are bound to Tailwind's `--font-sans` and `--font-mono` in `@theme inline`, and the class goes on `html`.
  Nothing scopes the app font out of the canvas because nothing has to: `.excalidraw` sets `font-family: var(--ui-font)` on itself, so the editor's chrome keeps Assistant and the app font never reaches inside.
  `tests/e2e/typeface.spec.ts` asserts both directions rather than trusting that reading.
- `PATCH /api/diagrams/[id]` now takes `name`, `locked` (a boolean) and the pair `elementCount` plus `sceneBytes`, parsed by `src/lib/diagram-changes.ts`, a pure function with its own unit tests.
  The two counters are accepted only together, since half a measurement would store a lie.
  A body that changes nothing answers 400 instead of writing: every caller has something to change, and the old empty `{}` touch no longer exists.
  `diagramRepository.touch` became `update(id, changes)`, and only the scene pair moves `updatedAt`, which is what makes a rename or a lock not count as an edit.
- The provider merges per concern instead of replacing the item: a rename writes `name`, a lock writes `lockedAt`, a save writes `updatedAt` and the two counters.
  A lock and a save in flight at the same time touch disjoint attributes in DynamoDB, so the stored item is right in either order; merging per concern makes the client's cached copy converge the same way, which replacing the whole item did not.
- The editor waits for the diagram's record before it mounts anything, and reloads the scene when the lock state changes.
  Waiting is not a nicety: mounting the canvas before the lock state is known would mount the saver for a locked diagram, and a single report from the editor would then put a scene that must never be written.
  This serializes the first scene request behind the list request, which the list request was already racing anyway.
- View mode and the saver's presence follow the live lock state, not the reloaded scene, so clicking Lock stops the saver in the same commit instead of one round trip later.
- The saver lives in `SceneSaving`, a child that renders nothing and hands the saver to the canvas through a ref.
  Unmounting it is what flushes and stops it, so Lock keeps the last edit by construction rather than by an extra call, and a locked diagram has no saver in the tree at all.
- `sceneStats` measures the serialized scene with `TextEncoder`, so the size is bytes and not characters, and it travels in the PATCH that already followed the upload.
- Tokens: radius 0.5rem, warm paper in light, ink in dark, an ink blue primary, and motion through Tailwind's `--default-transition-duration` and `--default-transition-timing-function` so every `transition-*` utility shares one curve.
  The chart tokens were retuned to the same family even though nothing renders a chart yet, so no surface keeps an old value.
- `src/components/ui/dialog.tsx`, `dropdown-menu.tsx` and `tooltip.tsx` are the CLI's output run through Prettier and nothing else, which is the shape the three components already in the tree have.
  `button.tsx` was left as it was when the CLI offered to overwrite it.

Trade-off accepted: locking reloads the scene while the flush from that same lock may still be in flight, so the reloaded baseline can be one edit stale.
The next unlock then saves the canvas's true content once, which costs a write and moves `updatedAt`, and never loses anything.
The alternative was reading the live scene out of a ref during render, which `react-hooks/refs` rejects.

Pending, not done:

- The e2e block of `verify-task` and the phase's screenshots, both of which need `app/.env.local`, which is not in the worktree.
  Lint, typecheck and the 131 unit tests are green; `verify.log` carries the failure and its reason verbatim.

Deferred, out of this phase's scope:

- A `prefers-reduced-motion` rule for the whole document: it would need `!important` to win, which would reach inside the canvas, so it belongs with a deliberate motion pass rather than here.
- `docs/modules/app/prd.md` still describes renaming in place; `document-task` corrects it on the clean signal, as `Context & decisions` sets out.


## Result
