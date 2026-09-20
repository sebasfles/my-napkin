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

## om-developer notes
