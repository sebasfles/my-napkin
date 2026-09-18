---
id: "0001"
title: repo_base
type: feature
branch: feat/0001_repo_base
modules: [app]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-09-17
updated: 2026-09-17
---

# 0001 Repo base

## Goal

The repository becomes a runnable project: a Next.js app under `app/` that opens the Excalidraw editor next to an empty diagram sidebar, in Spanish or English, in light or dark mode, with license, README, tooling and a passing verification pipeline, so every later task starts from a green baseline.

## Scope

- LICENSE (MIT, holder Sebastian Flores), README (what it is, credit to Excalidraw, how to run locally), `.nvmrc` with `24`.
- `app/`: Next.js App Router, TypeScript, npm, `src/` layout as in `docs/modules/app/trd.md`.
- Tailwind + shadcn/ui, theme tokens as CSS variables in `globals.css` (light and dark), `next-themes` with the class strategy, a theme toggle in the sidebar that follows the system by default.
- `next-intl` with `es` and `en`, locale from the browser, `en` as fallback, a locale toggle in the sidebar, messages under `src/messages/`.
- `@excalidraw/excalidraw` rendered on `/` via `next/dynamic` with `ssr: false`, full height next to the sidebar, with `theme` and `langCode` bound to the app theme and locale.
- Sidebar shell with the future diagram list as a static placeholder, no data.
- Tooling: ESLint, Prettier, `npm run lint`, `npm run typecheck`, Vitest, Playwright.
- Unit tests (Vitest): `es.json` and `en.json` have the same key set; locale resolution (`es-AR` to `es`, `fr` to `en`); app theme to Excalidraw theme mapping (`system` resolved, `light`, `dark`).
- E2E tests (Playwright): `/` shows sidebar and canvas; drawing a rectangle leaves it on the canvas; browser in `es` sees Spanish, in `en` English, the toggle switches and persists across reload, and Excalidraw's own UI follows; `colorScheme: dark` applies `.dark` and a dark canvas, the toggle to light persists across reload; at viewports 1280 and 768 the sidebar does not cover the canvas.
- `open-next.config.ts` and a documented `npx open-next build` that succeeds and produces only the server function and assets.

## Out of scope

- Persistence, DynamoDB, S3, presigned URLs (next task, diagram persistence).
- Password, cookie, middleware (task password auth).
- Terraform, workflows (tasks terraform environments, deploy workflows).
- Any UI beyond the layout shell and its two toggles.

## Acceptance

1. `npm ci && npm run dev` in `app/` serves `/` with a working Excalidraw editor filling the viewport minus the sidebar.
2. `npm run lint`, `npm run typecheck`, `npx vitest run`, `npx playwright test --workers=1` all pass on a fresh clone.
3. Every behavior of the shell listed under Scope has its unit or e2e test; coverage is judged per behavior, not as a percentage.
4. `npx open-next build` succeeds and `.open-next/` contains `server-functions/default` and `assets`, no image optimization function, no revalidation queue.
5. README explains the project in one paragraph, credits Excalidraw, and lists the local commands.
6. LICENSE is MIT with Sebastian Flores as holder; the Excalidraw LICENSE notice is preserved through the npm dependency.
7. No word `excalidraw` in package name, folder names or config identifiers; only in the dependency, the imports and the README.
8. The `styles`, `i18n` and `e2e-worth` checks report clean on the PR.

## Approach

- Module and layers touched: `app`, all of it is new; `.nvmrc`, LICENSE and README at the root.
- Entities, endpoints, tables: none.
- Decisions:
  - shadcn/ui on Tailwind with token-only colors: chosen over plain CSS modules because the `styles` check can enforce the palette and dark mode mechanically (see `docs/ARD.md`, 2026-09-17).
  - `next-intl` from the first screen: chosen over Spanish only because retrofitting i18n costs every string (see `docs/ARD.md`, 2026-09-17).
  - Prettier + ESLint flat config: chosen over Biome because the Next.js ESLint plugin is the one that knows App Router rules.
  - OpenNext build verified in this task: chosen over verifying it in the deploy task because SSR and bundling problems are cheaper to find while the app is small.
  - Editor wrapper in `src/components/`, a client component that imports the Excalidraw CSS and holds a fixed-height container.

## Database

None.

## Infra

None. `open-next.config.ts` only, no AWS.

## Design

None.

## Risks

- `@excalidraw/excalidraw` peer dependency and CSS import quirks with the current Next.js major.
- OpenNext version compatibility with the Next.js version chosen.
- Playwright interaction with the canvas (drawing a rectangle) may need keyboard shortcuts plus mouse events; keep the assertion on the scene state Excalidraw exposes, not on pixels.

## Depends on

None.

## Context & decisions

Consolidated 2026-09-17.

### Decided in consolidation

- Next 16.3.5, React 19, Node 24, OpenNext `@opennextjs/aws` 4.1.5, whose peer range is `>=15.5.24 <16 || >=16.3.3` (Sebastian). `@excalidraw/excalidraw` 0.18.1 accepts React 19.
- Excalidraw keeps its default runtime asset CDN in this task; the follow-up lives in `docs/tasks/_drafts/self_hosted_editor_assets.md`, so no Scope change and no ARD debt entry (Sebastian).
- Sidebar carries the app name, the translated empty-state line and the two toggles, with no create button until persistence gives it behavior (Sebastian).
- Theme tokens live in `app/src/app/globals.css`; `docs/conventions/styles.md` and `docs/checks/styles.md` were corrected to that path on `develop` (73c5f69), so acceptance 8 is reachable (om-manager).
- `next-intl` without i18n routing: no `[locale]` segment, `getRequestConfig` resolves the locale from the `NEXT_LOCALE` cookie and then `Accept-Language`, with `en` as fallback (om-reviewer). This keeps `/` and `/login` as `docs/modules/app/trd.md` has them and leaves `src/middleware.ts` free for the password auth task.
- Locale resolution is a pure function in `src/i18n/`, so the `es-AR` to `es` and `fr` to `en` cases are unit tests with no request (om-reviewer).
- Theme persists through `next-themes` in localStorage with `suppressHydrationWarning` on `<html>`; the locale persists in the cookie. Each library keeps its documented mechanism (om-reviewer).
- Tests: unit at `app/tests/unit/*.test.ts`, e2e at `app/tests/e2e/{flow}.spec.ts`, Vitest excluding `tests/e2e`, Playwright `webServer` running `npm run dev` unless `BASE_URL` is set (om-reviewer).
- The rectangle e2e asserts Excalidraw's own visible UI, undo becoming enabled and the shape properties island appearing, not pixels and not a test-only `window` handle (om-reviewer). This reconciles the task's Risks note with `docs/conventions/e2e.md`, which wants user-visible assertions. If neither signal proves workable, the handle goes in the editor wrapper and is documented.
- Every command runs under Node 24 (24.21.0 via nvm) so `verify.log` matches `.nvmrc`; the default shell node is 22.15.1 (om-reviewer).
- `verify.log` stays out of git: the root `.gitignore` keeps its `*.log` line untouched and I audit the log from the workspace on disk, because a verification artifact is not repo content and would add noise to every later PR diff (om-reviewer, on the om-developer's question before round 1).
- No `Co-Authored-By`, `Claude-Session` or any agent attribution in commits or the PR (Sebastian's standing rule).

### Adjustments

- Acceptance 4 adjusted (om-reviewer): if OpenNext 4 emits an artifact beyond `server-functions/default` and `assets` that its configuration cannot disable, the om-developer reports it and the deviation is recorded in the PR's Decisions instead of failing the round. Goal unchanged.
- Phases kept at 0: the baseline has to go green as one pipeline, and splitting it would leave a phase that cannot satisfy acceptance 2.
- No `.env.local` and no `.env.example` in this task: acceptance 1 must hold with no env file, since nothing reads AWS yet.

### Constraints for the om-developer

- `docs/modules/app/trd.md`, structure table, followed literally; `src/middleware.ts` is not created here.
- `docs/modules/app/ard.md`, 2026-09-17: the editor loads through `next/dynamic` with `ssr: false`.
- `docs/checks/styles.md` and `docs/checks/i18n.md`: the Excalidraw render passes `theme` and `langCode` derived from the app theme and locale; colors come only from tokens.
- `docs/TRD.md`, Verification targets, is the only source of the commands; e2e runs `--grep-invert @aws`.
- Base branch is `develop`, not the GitHub default `main`.

### What I check beyond the Pipeline

- Nothing changes outside `app/`, `.nvmrc`, `LICENSE`, `README.md` and the docs the task updates.
- The word `excalidraw` appears only in the dependency, the imports and the README (acceptance 7).
- The `.open-next/` tree read from disk, not from the build log (acceptance 4).
- Each Scope behavior mapped to a named test (acceptance 3), and tests that cannot fail: a rectangle spec that still passes on an untouched canvas is a finding.

## om-developer notes

### Round 1

Scaffolded the whole baseline: root `LICENSE`, `README.md`, `.nvmrc`, and `app/` with Next 16.3.5, React 19.2.8, Tailwind 4, shadcn/ui, `next-intl`, `next-themes`, `@excalidraw/excalidraw` 0.18.1, Vitest, Playwright and OpenNext 4.1.5.
Everything ran under Node 24.21.0.

What I did beyond the plain scaffold, and why:

- `src/lib/` holds the pure helpers the structure table does not name: `theme.ts` (`resolveTheme`), `editor.ts` (`editorLangCode`), `use-hydrated.ts` and the shadcn `utils.ts`.
  The module `trd.md` table lists no `src/lib/`, but `docs/TRD.md` does, and shadcn's CLI writes `utils.ts` there by convention.
- The editor needs `langCode` `es-ES`, not `es`: the package ships no bare `es` locale, so a naive passthrough would silently fall back to English.
  `editorLangCode` maps it, and its unit test reads the locale files the package actually ships rather than asserting the literal I wrote.
- The mount gate uses `useSyncExternalStore` (`use-hydrated.ts`), not `useState` plus `useEffect`.
  The React lint rule `react-hooks/set-state-in-effect` rejects the classic `mounted` pattern, and disabling the rule for a baseline would be the wrong precedent.
- `next.config.ts` sets `agentRules: false`: Next 16 otherwise generates its own `AGENTS.md` and `CLAUDE.md` inside `app/` on every dev run, which collides with the repo's own `AGENTS.md`.
- `next.config.ts` sets `devIndicators: false`: the dev overlay renders bottom-left, exactly over the sidebar's two toggles, and intercepted their clicks in Playwright.
  It is a development-only affordance and the toggles belong at the foot of the sidebar.
- Playwright's `baseURL` is `http://localhost:3000`, not `127.0.0.1`.
  Next 16 blocks cross-origin dev resources, and over `127.0.0.1` the page never hydrated at all.
- `shadcn` and `tw-animate-css` sit in `devDependencies`, not `dependencies` where the CLI put them: both are only resolved by `globals.css` at build time, and `dependencies` should describe what ships.
- `app/.gitignore` ignores `*.tsbuildinfo` and `next-env.d.ts`, following the Next template. I confirmed `npm run typecheck` passes on a tree without `next-env.d.ts`, so acceptance 2 holds on a fresh clone.
- The e2e specs locate the editor through the library's own `.excalidraw` container class and its `data-testid`s (`button-undo`, `toolbar-rectangle`). Selecting a shape is done with the `r` keyboard shortcut after clicking the canvas, because the tool's radio input is overlaid by its icon and cannot be clicked directly.

Reported deviation, acceptance 4:

- `npx open-next build` succeeds and `.open-next/` does contain `server-functions/default` and `assets`, both verified from disk.
  It also emits `image-optimization-function` (21M), `revalidation-function` and `warmer-function`.
  OpenNext 4.1.5 cannot be configured to drop them: `dist/build.js` calls `createRevalidationBundle`, `createImageOptimizationBundle` and `createWarmerBundle` unconditionally, and `OpenNextConfig` exposes no flag for any of them.
  `dangerous.disableIncrementalCache` and `disableTagCache` are set and do reach `open-next.output.json`, so no revalidation queue is used at runtime; the bundle is emitted but dead.
  This is the case the Adjustment in `Context & decisions` anticipated, so I report it instead of failing the round: the deploy task uploads only `server-functions/default` and `assets`.

Debt I am creating, for the ARD when documenting:

- npm 11.19 gates install scripts, so `package.json` carries an `allowScripts` block for `esbuild`, `@swc/core`, `unrs-resolver` and `@parcel/watcher`.
  The keys are version-pinned, so bumping any of those dependencies silently re-blocks its install script and can leave a package without its native binary.
- `npm audit` reports 9 advisories (7 moderate, 2 high), every one of them transitive under `@excalidraw/excalidraw` through `@excalidraw/mermaid-to-excalidraw`: `lodash-es`, `nanoid`, `chevrotain` and `langium`.
  0.18.1 is the latest published editor, so nothing in this repo can resolve them; `npm audit fix --force` would only downgrade the editor.
  They are reachable through the editor's own mermaid import, which this app adds nothing to.

Pending and deferred:

- Deferred, not in Scope: self-hosting the editor's runtime assets (the draft at `docs/tasks/_drafts/self_hosted_editor_assets.md`); the CDN default stays.
- Noted, no action: the editor overwrites `<html lang>` with its own `langCode`, so the document ends up `es-ES` rather than `es`.
  It is still correct Spanish, so the locale specs assert visible text as `docs/conventions/e2e.md` wants, not the attribute.
- Not created, as instructed: `src/middleware.ts`, and no `.env.local` or `.env.example`.
