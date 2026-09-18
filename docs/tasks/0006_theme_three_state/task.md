---
id: "0006"
title: theme_three_state
type: feature
branch: feat/0006_theme_three_state
modules: [app]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-09-18
updated: 2026-09-18
---

# 0006 Theme three state

## Goal

The theme control offers system, light and dark, so the interface keeps following the OS until Sebastian explicitly picks a mode, and he can return to following it. Today's two-state toggle stops following the system after the first click until storage is cleared (flagged in PR #1).

## Scope

- Replace the two-state toggle in the sidebar with a three-state control (system, light, dark), translated, token-only styling.
- `system` is the default and resolves to the OS scheme through `next-themes`; the choice persists across reloads.
- Excalidraw follows the resolved theme in the three cases.
- Unit test for the resolution of `system`; e2e: OS dark with `system` selected shows dark, pick light shows light after reload, back to `system` follows the OS again.
- `docs/modules/app/*` updated.

## Out of scope

- Any other sidebar change; 0004 and 0005 touch the sidebar too, the second to land rebases.
- Per-diagram theme.

## Acceptance

1. The control shows the three options and `system` is selected on a fresh browser.
2. With `system`, switching the OS scheme (emulated) switches the app and the canvas.
3. Picking light or dark persists across reload; picking `system` again follows the OS.
4. Excalidraw's canvas matches the resolved theme in all three cases.
5. Every behavior above has its test; `styles`, `i18n`, `e2e-worth` checks clean.

## Approach

- The om-reviewer decides the control's shape (segmented control, dropdown or cycling button) and every implementation detail; Sebastian delegated all decisions of this task to the om-reviewer on 2026-09-18 and only wants to see the result on the PR.
- `next-themes` already supports `system`; the work is the control and the tests.

## Database

None.

## Infra

None.

## Design

None.

## Risks

- Sidebar conflicts with 0004 and 0005; rebase.
- E2E of the OS scheme uses Playwright's `colorScheme` emulation, which is the only way to flip it.

## Depends on

None.

## Context & decisions

Sebastian delegated every decision of this task to the om-reviewer on 2026-09-18, so everything below is decided by me unless another owner is named.

- Shape: a segmented control of three always-visible icon options (monitor, sun, moon), single-select, in the sidebar footer where the toggle is today.
  Reason: the Goal's complaint is that the state was invisible and unreturnable, and a segmented control shows the three options and which one is active with nothing to open.
  Rejected: a cycling button (hides the state, and cycling three is worse than two) and a dropdown (the state is only readable once opened).
- Built on `ToggleGroup` with `type="single"`, added with `npx shadcn@latest add toggle-group` and kept exactly as generated, per `docs/modules/app/ard.md` (shadcn on the radix base, radix-nova preset).
  `radix-ui@1.6.7` is already a dependency and its single-select group renders `role="radiogroup"`, `role="radio"` and `aria-checked` with roving focus, so keyboard and screen reader behavior come for free.
  If the CLI cannot emit a radix-nova `toggle-group`, hand-write `app/src/components/ui/toggle-group.tsx` on `radix-ui`'s `ToggleGroup` with token-only classes and record the deviation in `docs/modules/app/ard.md`.
- Naming: `theme-toggle.tsx` becomes `theme-control.tsx` exporting `ThemeControl`; the `themeToggle.*` keys are replaced by `themeControl.{label,system,light,dark}` in both `es.json` and `en.json`, and the old keys are deleted, not left behind.
- Selection source: the selected option is the raw `theme` (`system`, `light` or `dark`); the Excalidraw prop stays `resolveTheme(theme, systemTheme)`, so the canvas follows the resolved value in the three cases.
- Hydration: keep the `useHydrated()` gate of `docs/modules/app/ard.md`, and before hydration render the group with no option selected, neither `system` nor `light`.
  Reason: `next-themes` cannot know the stored choice during SSR, and showing a selection that may be wrong for one frame is worse than showing none; `disableTransitionOnChange` is already set.
- `app/src/lib/theme.ts` gains a pure `themeChoice(theme: string | undefined)` returning one of the three options, with `undefined` and any unknown value normalizing to `system`, and `resolveTheme` routes its input through it.
  Reason: today a stale `localStorage` value resolves to light and stops following the OS, which is the same class of bug the task fixes; one normalizer keeps the control and the canvas from ever disagreeing.
  This helper is the unit test that Scope asks for: extend `app/tests/unit/theme.test.ts`, do not add a second theme test file.
- E2E: rewrite `app/tests/e2e/theme.spec.ts` as one spec that flips the emulated OS scheme live with `page.emulateMedia({ colorScheme })` on the same page while `system` is selected, asserting `html` gains and loses `dark` and `.excalidraw` gains and loses `theme--dark` each time.
  Then pick light, reload and assert it held, then pick `system` again and flip the scheme once more.
  Reason: Acceptance 2 says switching the OS scheme, not starting in one, and a spec that only sets `colorScheme` at launch cannot fail for the bug this task fixes.
  The spec is not tagged `@aws`, creates no diagram and needs no cleanup.
- Selectors: locate the group by `data-testid`, the options by `getByRole("radio", { name })` and the selection with `toBeChecked()`.
  Reason: `docs/conventions/e2e.md` forbids test-only handles for what the user reads, and `data-state` is Radix internals.
- Documentation, in `document-task`: `docs/modules/app/trd.md` Testing still says e2e runs in `ci.yml` with `--grep-invert @aws`, which `docs/conventions/e2e.md` contradicts since 8241682.
  Correct that line to match the convention (e2e runs on the promotion PR against deployed dev, and locally against `npm run dev` with `.env.local`), correcting and cutting rather than appending.
  `app/package.json`'s `test:e2e` script and the workflows are out of scope and stay as they are.
- Verification: `verify-task` runs the `app` row of `docs/TRD.md` literally from `app/`, e2e with no `BASE_URL` so Playwright starts `npm run dev` against the `.env.local` Sebastian places in this worktree; `infra` and `deploy` are not touched, so their targets are not run.
- Sidebar: 0004 and 0005 touch `app/src/components/sidebar.tsx` too and the second to land rebases on `origin/develop`.
  The controls stay in the bottom-left corner: `docs/modules/app/ard.md` ties `devIndicators: { position: "bottom-right" }` to them being there.
- Commits and PR carry no `Co-Authored-By`, no `Claude-Session` and no agent attribution at all (Sebastian); Sebastian merges with merge commits only.
- Beyond the Pipeline I will check that picking an option persists the choice so Acceptance 3 holds without clearing storage, that the pre-hydration frame selects nothing, and that the e2e can actually fail if the control stops following the OS.

## om-developer notes
