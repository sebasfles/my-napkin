---
id: "0014"
title: sidebar_shortcut_title
type: feature
branch: feat/0014_sidebar_shortcut_title
modules: [app]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-09-20
updated: 2026-09-20
---

# 0014 Alt+B toggles the sidebar and the app is called My Napkin

## Goal

Sebastian collapses and expands the sidebar from the keyboard while drawing, and the app calls itself "My Napkin" in the browser tab and wherever the product name shows, instead of the repository name.

## Scope

- Alt+B toggles the sidebar between expanded and rail, same state and persistence as the rail control, handled through the same Alt chord path `tab-bar.tsx` and `lib/tabs.ts` use, so it works with focus in the canvas and Excalidraw never sees it; the rail control's tooltip shows the shortcut.
- Product name: `metadata.title`, `sidebar.title` and `login.title` in `messages/{en,es}.json` become "My Napkin"; the browser tab reads "{diagram} · My Napkin" with a diagram open and "My Napkin" otherwise; the manifest name and short name follow.
- Unit test for the chord; the tabs or rail e2e spec covers the toggle; the metadata spec asserts the new title.
- Docs: `docs/modules/app/prd.md` names the shortcut next to the rail and the product name.

## Out of scope

- Any other shortcut; renaming the repository, domain or AWS resources.

## Acceptance

1. Alt+B collapses and expands the sidebar with focus in the canvas and in the sidebar; a reload keeps the last state.
2. Browser tab, login and sidebar say "My Napkin" in both locales; the manifest too.
3. Suite green; screenshots (light and dark) of the tab title and the rail tooltip in the PR description as workspace paths.

## Approach

- Module `app` only: `lib/tabs.ts` chord table (or its sibling for the sidebar), `tab-bar.tsx` or the workspace provider where the listener lives, `sidebar.tsx` tooltip, the three message files' keys, `manifest.ts`.
- Alt+B is free in Chrome; Firefox on Windows and Linux opens its Bookmarks menu on Alt+B unless the page prevents the default on keydown, which the existing chord handler already does for Alt+W; the om-developer confirms the handler prevents default before the browser sees it.

## Database

None.

## Infra

None.

## Design

None.

## Risks

- Rebase against 0012 phase 1b, which touches `sidebar.tsx`; small.

## Depends on

None.

## Context & decisions

Consolidated 2026-09-20 with Sebastian through the om-manager.

### Decisions

- The chord table moves to a pure `src/lib/shortcuts.ts`, and the single capture-phase listener moves out of `tab-bar.tsx` into a `<Shortcuts />` client component mounted in the `(editor)` layout beside `<PageTitle />` (Sebastian).
  One listener and one table keep `docs/modules/app/trd.md#Keyboard` true when 0012 claims keys of its own, and the tab bar stops owning global chords while it can still render `null`.
  The `tabShortcut` unit tests move with the table and the tab commands keep their shape.
- `manifest.name` is "My Napkin" and `short_name` is "Napkin", because short_name is the launcher label (om-reviewer).
- The chord shows in the collapse and rail tooltips only, through a new `sidebar.shortcut` key holding "Alt+B" in both catalogs, while the `aria-label` keeps the plain action (om-reviewer).
  A bare "Alt+B" in JSX would trip `docs/checks/i18n.md`, and leaving the labels alone keeps the existing copy and the specs that read it.
- The toggle goes through a new `toggleCollapsed` in `src/lib/use-sidebar-collapsed.ts` that reads the cookie at call time (om-reviewer).
  The listener then needs no server-rendered value and does not re-register on every toggle.
- The e2e case lands in `tests/e2e/sidebar-collapse.spec.ts` beside "collapses from the keyboard": canvas focused, sidebar focused, then a reload (om-reviewer).

### Adjustments

- Scope, added (Sebastian): `README.md` is rewritten as the product's front page, with "My Napkin" as the name, two or three sentences on what it is, the stack, how to run it locally, the environments and the Excalidraw credit.
  No image is committed, and the repository, the domain, the AWS names and `app/package.json` are untouched.
  `AGENTS.md` reserves the word `excalidraw` for that credit and the npm dependency, so the credit section stays.
  The file is corrected and cut rather than grown, since it already carries every section the rewrite needs.
  Its "Running it locally" omits that `app/.env.local` is required; the rewrite names it and points at `app/.env.example`, never at the real file.
- Scope, added (Sebastian): `docs/PRD.md` line 10 names the product "My Napkin".
- Scope, adjusted (Sebastian): the docs bullet also covers `docs/modules/app/trd.md#Keyboard`, which describes the listener that moves.
- Acceptance 3, reworded (Sebastian): a browser tab cannot be screenshotted, since Playwright captures the page and never the browser chrome.
  It now reads: suite green; `tests/e2e/metadata.spec.ts` asserts the new title with `toHaveTitle`; screenshots in light and dark of the sidebar header, the login screen and the rail tooltip, as workspace paths in the PR description.

### Constraints

- `docs/modules/app/trd.md#Keyboard`: the listener sits on `window` in the capture phase, matches on `event.code` and never `event.key`, claims a chord only on an exact match, and only then calls `preventDefault` and `stopPropagation`.
- `docs/checks/i18n.md`: every new string exists in `es` and `en`, and no user-facing literal stays in JSX.
- `docs/modules/app/ard.md`, the 2026-09-20 rail decision: a collapsed sidebar is a rail in its first painted frame, so the cookie stays the source and no effect seeds the state.

### Checked in review beyond the Pipeline

- Alt+B is claimed on an exact match only, so Alt+Shift+B, Ctrl+Alt+B and AltGr+B still reach the editor untouched.
- The rename reached the specs that hardcode the name, including the `appName` constant and the manifest assertion in `tests/e2e/metadata.spec.ts`.
- The e2e proves the toggle with focus in the canvas, not only from a focused button, since that is the whole point of the chord.
- The suite is chromium only (`app/playwright.config.ts:37`), so the Firefox bookmarks-menu case in Approach is judged by reading the handler's `preventDefault`, never by a run.

## om-developer notes

### Round 1

Done:

- `src/lib/shortcuts.ts` is the pure chord table, with `KeyChord`, `TabCommand` and one entry point, `shortcutFor`, returning `{ kind: "tab", command }` or `{ kind: "toggleSidebar" }`.
  `tabs.ts` keeps only the tab state.
- `src/components/shortcuts.tsx` holds the single capture-phase `window` listener and is mounted in `(editor)/layout.tsx` beside `<PageTitle />`.
  `tab-bar.tsx` lost the listener and now only renders the bar, so it can still return `null` without taking the chords with it.
- `toggleCollapsed` in `use-sidebar-collapsed.ts` reads the cookie at call time; `setCollapsed` and it share one `store`, so the listener needs no server value and never re-registers.
- The chord shows as `sidebar.shortcut` ("Alt+B" in both catalogs) in the collapse and rail-expand tooltips, in the muted tone `RailSection` already uses for its hint; the `aria-label`s keep the plain action.
- "My Napkin" in `metadata.title`, `sidebar.title` and `login.title` of both catalogs, `manifest.name`, and `short_name` "Napkin".
- `README.md` rewritten as the product's front page, and `docs/PRD.md` names the product.
- Tests: `tests/unit/shortcuts.test.ts` (the moved `tabShortcut` cases plus Alt+B, and Alt+Shift+B, Ctrl+Alt+B, Cmd+Alt+B, bare B all left to the editor), the Alt+B case in `tests/e2e/sidebar-collapse.spec.ts` (canvas focused, sidebar focused, reload), the renamed `appName` and a `short_name` assertion in `tests/e2e/metadata.spec.ts`, and `page-title.test.ts` renamed with it.

Decisions this round, beyond `Approach` and `Context & decisions`:

- One matcher, `shortcutFor`, instead of keeping `tabShortcut` exported beside it.
  Two exported matchers over the same event is how the table stops being one table, which is the reason the table moved in the first place.
  The tab commands keep their shape, wrapped in the `tab` variant.
- The shortcut shows in the tooltip as a muted second line rather than through a new `Kbd` component.
  `ui/tooltip.tsx` already styles a `data-slot="kbd"` child, but no such component exists in `components/ui/`, and adding one from the shadcn CLI is a wider change than this task asked for.

Pending, for the documentation step:

- `docs/modules/app/prd.md` (the shortcut next to the rail, the product name) and `docs/modules/app/trd.md#Keyboard` (the listener moved out of `tab-bar.tsx`), which `document-task` writes once on the clean signal.
  `README.md` and `docs/PRD.md` landed here instead, since `document-task` is scoped to `docs/modules/` and the `Debt index`, and these two are Scope, not module docs.

Deferred, not touched:

- `tests/e2e/pinning.spec.ts:49` asserts on row 0 of the pinned list, so any pinned diagram another run left in the shared dev table fails it.
  It failed that way in this round's first e2e run and is unrelated to this diff; 0013 owns the e2e-on-dev work, so a fix from here would collide with it.
- Two workspaces cannot run the suite at once: they share the dev table and port 3000.

Pending, e2e:

- Lint, typecheck and unit are green on this commit.
  The full e2e run is owed: the first came back 64 of 65 with the pinned-row collision above, and the re-run was terminated from outside after 8 green specs while three suites shared 7.8 GiB of memory.
  Held for the om-reviewer's `e2e slot free`.

