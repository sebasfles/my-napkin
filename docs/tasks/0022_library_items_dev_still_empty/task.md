---
id: "0022"
title: library_items_dev_still_empty
type: bug
crew: pair
clearance: full
branch: bugfix/0022_library_items_dev_still_empty
modules: [app, infra]
repos: ["."]
phases: 0
depends_on: []
ticket: https://github.com/sebasfles/my-napkin/actions/runs/38497207353
created: 2026-10-13
updated: 2026-10-13
---

# 0022 Library items still empty on deployed dev after 0020

## Goal

On deployed dev, a linked library's items show in the editor panel and an imported library file opens as a canvas with its frames.
0020 (PR #34, merged 2026-10-14) gated the saver so it cannot overwrite a scene still loading, and expected the 4 library specs to go green on the merge's `e2e-dev`.
Run 38497207353 on that merge fails the same specs with the same symptom (expected 2 items, received 0), so either the gate does not close the window on dev or the cause was never the saver.

## Scope

- Reproduce against deployed dev as a user does, with `--trace on`, before touching code. This is the step 0020 never ran.
- Read the S3 noncurrent versions of the objects run 38497207353 wrote (`libraries/{id}/items.json`, `scene.json`) and settle one question with bytes: are they still clobbered by an empty scene (then #34's gate is insufficient) or intact (then the read path on dev is the defect)?
- Fix at the root, locally verifiable where possible, and proven by `e2e-dev` on `develop` after the merge.
- The 4 specs of 0020 go green: `library-import.spec.ts:30`, `library-insert.spec.ts:29` and `:73`, `library-panel.spec.ts:27`.
- Sweep of the rows this run and 0020's runs left in the dev table, through the UI delete path.

## Out of scope

- `library-panel.spec.ts:93`: task 0021.
- `deploy-dev` firing on docs-only commits: draft `deploy_dev_skips_docs`.
- Reverting #34: its gate protects drawn diagrams from a real loss and stays regardless.

## Acceptance

1. Replication fails against dev before the fix, with a trace kept in the workspace, and the cause is named with evidence (object versions or logs), not by argument.
2. `e2e-dev` on the merge commit: the 4 specs green.
3. Local suite green (lint, typecheck, unit, e2e per `docs/TRD.md`).
4. If infra changed, `terraform plan` in dev shows only that change and Sebastian applied it before the merge.

## Approach

- Module `app`: the `editor.tsx` gate from #34, `library-cache.ts`, `library-io.ts`, `s3.ts`, the library API routes. `infra` only if the evidence points there.
- Order: reproduce on dev, read the bucket versions of this run, then decide between "saver still writes empty" and "panel reads 0 from a correct file". Each hypothesis from 0020's `Context & decisions` is kept or dropped with evidence.
- Decisions:
  - No spec that stubs the network: chosen over a Playwright reproduction of a slow load because e2e stays real (`docs/TRD.md`). Whatever rule is extracted gets unit tests.
  - The om-developer runs Playwright against dev with `APP_PASSWORD` and reads S3 versions and CloudWatch with `AWS_PROFILE=personal`, read-only: chosen over forensics on the ticket's run alone because that is how 0020 shipped without proof.

## Database

None new; the `diagrams` table and the scenes bucket through the existing repositories.

## Infra

None expected. Read-only AWS for diagnosis only; no agent mutates AWS.

## Design

None.

## Replication

See `replication.md`.

## Risks

- The two `deploy-dev` failures from docs-only commits and the 12 leftover rows noted in PR #34 pollute the table; counts in the suite are relative so they should not matter, but the sweep is in scope.
- 0021 shares the dev table and the one Playwright slot: runs against dev are serialised through the om-manager.

## Depends on

None (0020 is merged).

## Context & decisions

Consolidated 2026-10-13 with the om-manager and Sebastian.

### Settled in consolidation, by bytes (om-reviewer, read-only)

- Scope bullet 2 is answered: on run 38497207353, libraries `5173dbfe`, `b6d44f15` and `ed67f514` each go 40, then 2.2K/2.7K from the import, then 128/112 one to two seconds later, the 128 being the package's default empty scene (`viewBackgroundColor`, `gridSize: 20`, `zoom: 1`, scroll 0), the same signature as 0020.
  So #34's gate does not close the window, the writer is still the editor's saver through `writeLibrary`, and "the panel reads 0 from a correct file" is dropped. The om-developer records the versions in `replication.md` and starts from "which path still reaches the saver".
- First step regardless: prove the dev bundle at `7a717e3` carries `canSaveCanvas`, so "the fix was never deployed" is dead by evidence.
- prd has no visible loss: one large-to-128 overwrite in 30 days of retained scene versions (`scenes/cb7b82b9`, 162 bytes, 2026-09-21). No action.

### Leads to keep or drop with evidence (om-reviewer, not facts)

- All four specs reach the library canvas as a fresh `Editor` mount, since `EditorSurface` renders none at `/`.
- The package hands out `excalidrawAPI` in its constructor and ends its async `initializeScene` (from `componentDidMount`) with `syncActionResult(restore(null))`, which is that same empty scene; a swap that lands before it, with `painted === shown` already true, would be wiped under a subscribed saver.
- The gate does not depend on `api` identity, so a new instance with `painted === shown` keeps the saver attached.
- If either holds, 0020's premise is inverted: the window opens when the scene arrives before the editor finishes initialising, which fits Actions next to us-east-1 and not a developer machine.
- A guard inside the saver alone is not a fix: the editor would still show an empty canvas and the first stroke would save it. The editor must hold the scene it was handed.

### Proof (Sebastian)

- A red, then green, under an uncommitted probe that hits the same writer under Actions-like timing is a review gate before the PR: red on `develop`, green on the fix. Allowed probes: a local production build on :3000, CDP throttling of the package chunk, or an `addInitScript` hook observing order against dev. Nothing of the probe is committed; "no spec stubs the network" governs committed specs.
- The same probe shows a drawn diagram reopened as the first canvas of a cold session survives. The fix stays at the root; Scope does not widen.
- A green local suite does not clear Acceptance 2: 0021 saw `library-panel.spec.ts:27` pass locally against dev while red in `e2e-dev` (om-manager).
- Acceptance 2 and 4 are post-merge, as in 0020. A red `e2e-dev` on the merge reiterates this task; there is no 0023 (om-manager).

### Replication corrections (om-reviewer)

- Step 1: the four specs import `shapes.excalidrawlib` from the Libraries section while at `/` and are navigated into the new library's canvas; none adds items from a diagram.
- Observed: `library-import.spec.ts:30` fails at line 39 (`empty-library-canvas` shown) while line 34 (the row's `data-items` is 2) passes; "Expected 2, Received 0" holds for the other three.

### Constraints

- Unit suite stays pure and in Node (`docs/modules/app/trd.md`, Testing); a missing `items.json` reads as no items and the role has no `s3:ListBucket` (`docs/modules/app/ard.md`, 2026-09-20).
- Every Playwright run against dev takes the e2e token from the om-manager first and is serialised with 0021. The sweep goes through the UI delete path, suite-generated names only. No agent mutates AWS.
- In review: a regression that cannot fail on `develop` is a finding, and every 0020 hypothesis is kept or dropped in writing.

clearance: full (Playwright against dev with `APP_PASSWORD` and the om-manager's token; read-only `aws` with `AWS_PROFILE=personal` on the dev and prd buckets and dev CloudWatch).

## om-developer notes
