---
id: "0020"
title: library_items_dev
type: bug
branch: bugfix/0020_library_items_dev
modules: [app, infra]
repos: ["."]
phases: 0
depends_on: []
ticket: https://github.com/sebasfles/my-napkin/actions/runs/35630985274/job/106437288399
created: 2026-09-21
updated: 2026-09-21
---

# 0020 Library items never show up on deployed dev

## Goal

On dev, a library's items load in the editor panel and an imported library file opens as a canvas with its frames, as they do locally.
`e2e-dev` on `develop` at `b2f2331` (2026-09-21) fails 4 library specs: the panel shows 0 items for a linked library with 2, and an imported library canvas stays empty.
Creating and linking libraries works, so this is the items path (`libraries/{id}/items.json` and the imported scene), not the library row.

## Scope

- Reproduce on deployed dev as a user does (link a library with items to a diagram, open the panel; import a library file) with a Playwright trace against `BASE_URL=https://napkin.dev.sdfles.com`, and find where the items path breaks on AWS but not locally: IAM (0018's grant applied or not, `s3:ListBucket` missing so a 403 replaces a 404), bucket versioning, the presigned read, or the Lambda's write of `items.json`.
- Fix at the root; if the fix is infra, it lands here with Sebastian applying dev from the branch before the merge so `e2e-dev` proves it.
- The 4 specs go green in `e2e-dev`: `library-import.spec.ts:30`, `library-insert.spec.ts:29` and `:73`, `library-panel.spec.ts:27`.
- Dev's shared table is swept of the rows those failed runs left.

## Out of scope

- `library-panel.spec.ts:93`, whose failure is the row menu moving under an autosave: task 0021.
- Any change to the libraries UI.

## Acceptance

1. Replication steps fail on dev before the fix and pass after it.
2. `e2e-dev` green on the merge commit, all 5 library specs included once 0021 lands or the flaky one is excluded from this count.
3. Local suite green.
4. If infra changed, `terraform plan` in dev shows only that change and Sebastian applied it before the merge.

## Approach

- Module `app` primary (`s3.ts`, `library-io.ts`, `library-cache.ts`, the library API routes), `infra` if the cause is IAM or the bucket.
- The om-developer reproduces first against deployed dev, then verifies locally and on dev after Sebastian applies if needed.
- CloudWatch logs of the dev Lambda are the fastest evidence; Sebastian pastes them if agents cannot read them.

## Database

None new; the `diagrams` table and scenes bucket through the existing repositories.

## Infra

Possibly the Lambda role (`s3:ListBucket`, or 0018 not yet applied); applied by hand by Sebastian.

## Design

None.

## Replication

See `replication.md`.

## Risks

- The cause may be that 0018 was never applied on dev; then the fix is one `terraform apply` and this task only proves it and adds the missing guard.
- The e2e runs leave rows in the shared dev table when they fail mid-cleanup.

## Depends on

None.

## Context & decisions

Consolidated 2026-09-21 with the om-manager and Sebastian.

### Where the cause is, and where it is not

- Sebastian confirms 0018's `libraries/` grant is applied on dev and prd, so a missing prefix grant is not the cause.
  The code agrees on its own: `app/src/app/api/diagrams/route.ts:39` writes `libraries/{id}/scene.json` with the Lambda's own role on every create, and creating a library works on dev.
- `library-import.spec.ts:42` passed on run 35630985274. It imports, exports through a presigned GET of `items.json` and parses those bytes, then re-imports. So the write of `items.json`, the counts PATCH and the presigned read all work on dev.
- Every failing spec reads, on the editor page, what an import wrote, through the `importLibrary` helper. Every `newLibrary` spec passes, and `library-drop.spec.ts`, the other import door, passes.
- `app/src/lib/library-cache.ts` returns `[]` with no request and no error when `itemCount` is 0 or absent, while a failed fetch renders the panel's own `failed` state. A section with 0 items is therefore about the count the panel's object carries, not about S3.
- Decision (om-reviewer): start from that split. `s3:ListBucket`, versioning, the presigned read and the Lambda write stay as fallbacks, and each is ruled out with evidence, never by argument.

### Constraints the fix respects

- The role has no `s3:ListBucket` (`infra/stacks/app/compute.tf`), so a missing key answers 403 and not 404, while `docs/modules/app/ard.md` (2026-09-20, the items file) requires a missing `items.json` to read as no items. Nothing in the fix may rely on a 404 there.
- A new bucket prefix goes in the single declared list and nowhere else (`docs/modules/infra/ard.md`, 2026-09-21).
- Scenes never pass through the Lambda (`docs/TRD.md#Conventions`), so items may not be moved onto an API route.
- Infra verification is `terraform fmt -check -recursive` once from `infra/` and `terraform validate` in each of the three roots, after `terraform init -backend=false` (`docs/TRD.md#Verification targets`).
- `.env` and `*.tfvars` are Sebastian's; agents read only the `.example` twins (`AGENTS.md`).

### Adjustments

- Acceptance 2 counts this task's 4 specs (om-manager). `library-panel.spec.ts:93` stays 0021's, whichever task is ready first merges first, and `develop` may carry that one red spec briefly.
- Acceptance 2 and 4 are post-merge for an app-code fix (om-reviewer, pending Sebastian at publish time). `deploy-dev.yml` fires only on a push to `develop` and the dev Actions environment admits that one branch (`docs/modules/infra/ard.md`, 2026-09-19), so no branch of this task can reach dev. The PR carries a red reproduction against dev and a green local suite, and `e2e-dev` on the `develop` run proves the fix.
- Read-only `aws` calls for diagnosis are with Sebastian. Until he answers, the om-developer works from the browser and the trace, and never mutates anything in AWS.

### Replication corrections

- `app/playwright.config.ts` keeps `trace: "on-first-retry"` with `retries: 0` outside CI, so a run against dev needs `--trace on` to produce the trace `Scope` asks for.
- A `BASE_URL` run still needs `APP_PASSWORD`. Ask the om-manager for it before every run against dev, the reproduction included; that token is the one suite slot on this machine, and 0021 shares the dev table.
- Step 1 holds only if the library is opened after its items are added, since `items.json` appears on the first save and not on the create (`docs/modules/app/ard.md`, 2026-09-20).

### Beyond the Pipeline, in review-task

- The reproduction ran against deployed dev, with its trace, before any fix.
- Every candidate the fix did not take is ruled out by evidence carried in the round.
- No AWS mutation by an agent, and the sweep announced to the om-manager, restricted to suite-generated names, with no 0021 run in flight.

## om-developer notes
