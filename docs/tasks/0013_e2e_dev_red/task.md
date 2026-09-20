---
id: "0013"
title: e2e_dev_red
type: bug
branch: bugfix/0013_e2e_dev_red
modules: [infra, app]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-09-20
updated: 2026-09-20
---

# 0013 e2e-dev is red on develop: public files never reach the CDN and the draw helper fails on deployed dev

## Goal

`e2e-dev` is green again on every push to `develop`.
Runs 35519420749 (2cfe563) and 35526315218 (f6e6c84) failed 10 of 64 specs for two independent causes, both introduced by 0011 phase 4, and the promotion pull request is blocked on them.

## Scope

- Cause 1, `public/` files missing on dev and prd. CloudFront serves only `/_next/static/*` from the assets bucket (`infra/stacks/app/variables.tf`, `static_path_patterns`, whose description still says the app has no `public/`); every other path goes to the Lambda, which does not serve `public/`. Phase 4 added `public/icon-192.png`, `icon-512.png` and the metadata routes (favicon, icon, apple icon, manifest). `metadata.spec.ts` fails and the browser tab shows no icon on dev and prd.
  Fix: `static_path_patterns` covers exactly the public paths the build emits into `.open-next/assets` (the om-developer lists them; expected `/icon-*.png`, `/favicon.ico`, `/icon.svg`, `/apple-icon.png`, `/manifest.webmanifest` or their actual names), description corrected, applied by hand in dev and prd. If a metadata route is served by the Lambda rather than emitted as a file, it stays on the Lambda and the task says which.
- Cause 2, `drawRectangle` in `app/tests/e2e/helpers.ts` fails on deployed dev only: after clicking the canvas and pressing `r`, `toolbar-rectangle` never becomes checked; 8 specs go through that helper and each failed twice (one retry). Green locally against the same table. Suspects: the click lands before the editor is interactive on the Lambda-served page, or focus stays outside the canvas after phase 4's editor-surface change. The om-developer reproduces with `BASE_URL=https://napkin.dev.sdfles.com` before touching anything and fixes the root cause in the helper or the editor, whichever is at fault; no sleep or arbitrary wait.
- Docs: `docs/modules/infra/trd.md` states which paths the CDN serves from the bucket and why; `docs/modules/deploy/` if the deploy sync needs a word.

## Out of scope

- The 1 flaky spec of the run unless it is one of the 8; if it is a third cause, it is reported, not fixed here.
- Any change to what `public/` contains.

## Acceptance

1. The `deploy-dev.yml` run of this task's merge into `develop` ends with `e2e-dev` green, 64 of 64, no retries on the 8 draw specs.
2. `https://napkin.dev.sdfles.com/icon-192.png` answers 200 from the assets bucket (CloudFront hit on the S3 behavior); the browser tab shows the icon on dev.
3. `terraform plan` in dev and prd shows only the CloudFront behavior change; both applied by hand before the PR is published, prd included so `main` does not inherit the bug.
4. Replication steps pass; `actionlint` and the full local suite stay green.

## Approach

- Modules: `infra` (primary for cause 1: `stacks/app`, the two environment roots), `app` (cause 2: `tests/e2e/helpers.ts` or `src/components/editor-surface.tsx`).
- Plans shown to the om-reviewer before any apply; applies by hand from Sebastian's machine as in `docs/ARD.md`, asked through the om-reviewer.
- Acceptance 1 is proven on the merge, not in the PR; the PR proves it locally with `BASE_URL` against dev after the apply, and the Risk assessment says so.

## Database

None.

## Infra

CloudFront ordered cache behaviors for the public paths, dev and prd. Nothing else.

## Design

None.

## Risks

- The public path list drifts the next time `public/` or the metadata routes change; the docs must say where it lives, and a pattern like `/*.png` is preferable to a file list if the CDN allows it safely.
- Cause 2 may be timing on a cold Lambda; the fix must be an observable condition (editor ready), never a delay.

## Depends on

None. 0012 (consolidating) touches `app` but not the helper nor `infra`.

## Context & decisions

Consolidated 2026-09-20 with the om-manager and Sebastian.

### Decisions

- Cause 1 is fixed by a path prefix, not a file list (Sebastian): the two PWA icons move to `app/public/static/`, `manifest.ts` points at `/static/icon-192.png` and `/static/icon-512.png`, CloudFront gets one `/static/*` behavior, and `app/src/lib/gate.ts` gains `/static/` in `publicPrefixes`.
  Reason: a future `public/` file then needs no Terraform apply at all, which is the drift risk `Risks` names.
- A `.png` wildcard is rejected (om-reviewer): `app/src/app/icon.png`, `icon.svg`, `apple-icon.png` and `favicon.ico` are Next metadata routes served by the Lambda and already answer 200 on dev, and `infra/modules/aws/cloudfront/variables.tf` says a pattern the bucket does not hold answers 403 through the OAC instead of falling through, so a wildcard would break the app's own icons.
- The pattern stays the default of `infra/stacks/app/variables.tf`, not a per-environment local, because nothing here differs between environments and `docs/modules/infra/trd.md` requires `dev/main.tf` and `prd/main.tf` to stay identical (om-reviewer).
- Applies: the om-developer puts both plans in its round, the om-reviewer signals the om-manager, Sebastian applies dev and prd by hand before the PR is published, as `docs/ARD.md` requires.
  Applying prd before the promotion is safe, since nothing on prd requests `/static/*` until phase 4 reaches `main`.

### Adjustments

- `Out of scope` drops "any change to what `public/` contains", which the first decision requires.
- Acceptance 2 becomes `https://napkin.dev.sdfles.com/static/icon-192.png` answering 200 from the assets bucket, proven on the merge run.
  Reason: the new keys reach the bucket only on the next dev deploy, which is the merge; between the apply and the merge `/static/*` answers 403 on dev, requested by nothing.
- Acceptance 4 gains: an app-side fix for cause 2 is proven against a local production build (`npm run build && npm start`) plus the written diagnosis, since dev runs only what `develop` has merged.
  Acceptance 1 stays the real proof of both causes.
- Acceptance 1 becomes 64 of 64 with no flaky and no retries if the pasted-image flake shares cause 2's diagnosis, in which case the readiness condition covers `pasteImage` and `expectSomethingOnTheCanvas` too.
  A separate cause is reported, not fixed.

### Constraints

- `infra/docs/deploy.md:33` states the CDN rule 0011 phase 4 broke and joins `docs/modules/infra/trd.md` as a doc to correct, not to append to.
- The sync never passes `--delete` (`infra/docs/deploy.md`), so the old `icon-*.png` keys stay in both buckets; no behavior routes them and the Lambda answers 404.
- `/static/` in `publicPrefixes` makes everything under `public/static/` readable with no session, which the CDN behavior does anyway; nothing private may live there and the docs must say so.
- No sleep and no arbitrary wait in the cause 2 fix (`Scope`).
  The stale editor taking no pointer events is deliberate (`docs/modules/app/ard.md`, 2026-09-20, the open scene above the route segment) and must not be undone to make a spec pass.
- Lead for cause 2, not a diagnosis: all 9 failing calls click the canvas as the first click after a modal dialog closes, and `helpers.ts:200 renameThrough` never waits for the dialog to be hidden.
  The om-developer reproduces against deployed dev before touching anything, as `Scope` says.

### Checked in review beyond the Pipeline

- The `terraform plan` of both roots shows only the CloudFront behavior.
- The gate change carries a unit test, and `metadata.spec.ts` passes against a local production build rather than following a redirect to `/login`.

### Adjustment, 2026-09-20, after the cause 2 diagnosis

- Cause 2's mechanism is confirmed and is in the helpers, not the app: Excalidraw binds its keydown to `.excalidraw-container` because `handleKeyboardGlobally` defaults to false, so `r` is downstream of the click that focuses it; `NameDialog` is a modal Radix dialog, so the body takes no pointer events while it closes; `renameThrough` never waited for it to be hidden.
  Verified independently by the om-reviewer in `node_modules/@excalidraw/excalidraw`, `item-dialogs.tsx:54` and `sidebar.tsx:291`.
  The stale editor of `editor.tsx` is not implicated and stays untouched.
- The window is a finite race, not a fixed ordering: the pasted-image spec failed at `save-reload.spec.ts:40` with 0 red pixels and passed on its retry (run 35526315218).
  The fix must therefore gate on actionability, never on a duration.
- Scope addition (om-reviewer): `newDiagram` tracks the row it creates only after the rename resolves, so a failure in between leaks a row `removeItemsCreatedHere` can never delete.
  14 stray rows were found in the dev table, 11 of them default named, evidence from om-0012-reviewer.
  It is the same lost input path this task is fixing and this task already owns `helpers.ts`, so it is fixed here rather than left to a later branch.
  The module-level maps keep their shape, since 0012 rebases onto this file.

## om-developer notes

### Round 1

Two commits, cause 1 then cause 2, verified once at the tip, which is what the pull request ships.

Cause 1, done as `Context & decisions` sets it out: the two PWA icons moved to `app/public/static/`, `manifest.ts` repointed, `/static/` added to `publicPrefixes`, and `/static/*` added to the default of `static_path_patterns` with its description corrected.

- `app/scripts/icons.mjs` moved with the files. It rasterises both PNGs and still wrote them to `public/icon-*.png`, so the next run of the generator would have recreated the bug in silence. This is beyond the decision's file list and is the one place the plan could have been followed exactly and still left the bug live.
- The pattern list is `["/_next/static/*", "/static/*"]` and nothing else, because `npx open-next build` emits exactly `BUILD_ID`, `favicon.ico`, `static/icon-192.png`, `static/icon-512.png` and `_next/static/*`. The list was built from the build output rather than from the repository, since only the first is what the bucket receives.
- `favicon.ico` is emitted as a bucket key and is also a Lambda route answering 200 today. It stays on the Lambda and gets no pattern: a pattern would move a working route onto a behavior for no gain, and every pattern is a hand apply in two environments forever.
- The `gate.ts` change is load bearing rather than bookkeeping, which is not obvious. On the deployed app the CDN behavior intercepts `/static/*` before the proxy sees it, so the gate matters for the local server and for any path that reaches the Lambda. It is also what makes `metadata.spec.ts` a real local proof: without it the icon requests would redirect to `/login` and the spec would follow the redirect to a 200 that means nothing. Pre-apply, dev answers 307 to `/login?next=%2Fstatic%2Ficon-192.png` for that path, not 404.
- `/static/` in `publicPrefixes` is readable with no session by construction, so nothing private may live under `app/public/static/`. Stated in `docs/modules/infra/trd.md` and in the `app/public/static/` row of `docs/modules/app/trd.md`.

Cause 2 is a defect in the e2e helpers, not in the application. The editor change of 0011 phase 4 is not implicated and the deliberate stale-editor `pointer-events-none` of `editor.tsx` is untouched.

- Mechanism, in `replication.md` in full: the editor binds `onKeyDown` to its own container div and binds nothing to the document, so a key press only reaches it when focus is already inside that container, and the canvas click is what puts it there. `NameDialog` is a modal Radix dialog, so while it closes the body takes no pointer events. `renameThrough` did not wait for it to be hidden, so the following blind coordinate click hit nothing, focus never moved, and the key press was delivered to a listener that does not exist.
- `drawRectangle` no longer presses a key at all. It selects the tool with a click on the tool's label, which is gated by Playwright's actionability and so cannot land while the closing dialog holds the body, and keeps `toBeChecked` as the proof. The tool's radio input carries `position: absolute; opacity: 0; pointer-events: none` in the editor's stylesheet and can never be clicked directly; the `<label class="ToolIcon">` around it is what a user clicks. Clicking the toolbar is the editor's own intended path, which is why it calls `focusContainer()` when the active element is a tool icon.
- `pasteImage` keeps the gated canvas click plus an assertion that focus reached `.excalidraw-container`, because there is no toolbar control for paste and that path genuinely depends on focus. The assertion is true rather than assumed: the old blind click plus key press worked on fast machines, which is only possible if a canvas click moves focus into the container.
- The canvas locator is `canvas.excalidraw__canvas.interactive` instead of `canvas.last()`. With a blind coordinate click DOM order did not matter; with a hit test it decides whether the click can land at all, and `last()` was never a statement about which canvas receives events. `redPixelsOnCanvas` still reads `canvas.excalidraw__canvas:not(.interactive)`, which is correct, since it reads rendered pixels rather than sending events.
- `renameThrough` awaits `name-dialog` hidden, which closes the window at its source for every caller rather than for the one helper that noticed.

Row leak, taken into this task by the om-reviewer. `adoptActiveDiagram` now tracks the row under its default name before renaming and retracks it after, through the existing `retrack`, so a failure during the rename no longer leaves a row that cleanup can never delete. It covers `newDiagram` and the two direct callers in `empty-state.spec.ts` with no signature change and no change to the module-level maps, so 0012 rebases onto the same shape. It matches the evidence: 11 of the 14 strays found in the dev table were default named, meaning the rename never completed.

Decision, a known residual rather than a gap: the window between the `diagram-new` click and the row becoming active stays uncovered, because the name is not readable until then. Closing it needs a diff of the name set before and after, which is more code and is wrong exactly when it matters, since it assumes nothing else writes to that table while three workspaces share it today.

Pending, not deferred: Sebastian applies dev and prd by hand before the pull request is published, and Acceptance 1 and 2 are proven on the merge run, not here.

Deferred, noticed and deliberately not done:

- `newFolderNamed` tracks its folder only after the create round trip, the same leak shape as the one fixed above. It is a smaller window, the folder carries its final name from the start, and none of the strays found were folders.
- `src/lib/api.ts:130` raises a pre-existing `@next/next/no-location-assign-relative-destination` lint warning. Untouched by this task and not in a file it had to open.
- Three workspaces share port 3000 and one 7.6 GiB machine, and `playwright.config.ts` sets `reuseExistingServer: false`, so a second suite fails outright and a third crashes browser pages. It is why one verification block in this task's `verify.log` is a `fail` recording browser crashes rather than assertion failures. It needs owning above this task; it is not a code change here.
