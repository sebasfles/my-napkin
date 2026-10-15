---
id: "0026"
title: deploy_dev_skips_docs
type: chore
crew: pair
clearance: repo
branch: chore/0026_deploy_dev_skips_docs
modules: [deploy]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-10-14
updated: 2026-10-14
---

# 0026 A docs-only push to develop neither deploys dev nor runs the suite

## Goal

A push to `develop` that changes only documentation does not redeploy dev and does not run the Playwright suite against it, so the `docs(tasks): ... planned` commits stop spending fifteen minutes of CI and stop colliding with local suites on the shared dev table, while the promotion PR stays mergeable and still proves the code on its head.

## Scope

- `deploy-dev.yml`: a first job decides whether the push is docs-only (every changed path under `docs/**` or a root `*.md`) by diffing `github.event.before` to `github.sha`; `deploy` and `e2e-dev` run only when it is not, `promotion-pr` always runs.
- `e2e-dev` stays the job id the `main` ruleset requires; when it is skipped by its `if`, GitHub counts the skipped check as satisfied, which is what keeps a docs-only head mergeable. A workflow skipped by `paths-ignore` would leave the check pending forever, so that form is not used.
- The skip is refused when the last completed `deploy-dev` run on `develop` did not succeed, so a docs-only commit never turns a red head green.
- `ci.yml` is unchanged: it is the required check of every pull request and costs a minute and a half.
- `docs/modules/deploy/trd.md` says what is skipped and why.

## Out of scope

- Skipping `ci` on docs-only pull requests.
- Any change to the rulesets in `infra/` or to `deploy-prd.yml`.

## Acceptance

1. A push to `develop` touching only `docs/**` runs `deploy-dev` with `deploy` and `e2e-dev` skipped and `promotion-pr` run; the promotion PR shows `e2e-dev` as skipped and is not blocked by it.
2. A push touching anything else runs all three jobs as today.
3. A docs-only push after a failed `deploy-dev` run runs all three jobs.
4. `npm run lint:workflows` green; the reviewer verifies the `if` conditions and the diff command by reading; the first real docs-only push after merge is the live proof and is recorded in the PR.

## Approach

- Module and layers touched: `deploy`, `.github/workflows/deploy-dev.yml`, `docs/modules/deploy/trd.md`.
- Decisions:
  - Job-level `if` over workflow-level `paths-ignore`: a skipped job satisfies a required check, a skipped workflow leaves it pending and blocks the promotion PR.
  - Diff against `github.event.before`: chosen over diffing against `main` because the second would never skip while code waits for promotion.
  - Guard on the previous run's conclusion through `gh run list` with `GITHUB_TOKEN`: chosen over trusting the head because a docs commit on top of a red one must not hide the red.
  - Forced pushes and the first push (`before` all zeros) count as not docs-only.

## Database

None.

## Infra

None. The rulesets keep requiring `ci` and `e2e-dev`.

## Design

None.

## Risks

- The behaviour of a skipped required check is GitHub's, not ours; the live proof after merge is the acceptance.
- `github.event.before` may be unavailable to `git diff` on a shallow checkout; `fetch-depth` must cover it.

## Depends on

None.

## Context & decisions

Consolidated 2026-10-14 by the om-reviewer with the om-manager on Sebastian's behalf.

- Scope adjustment (Sebastian, through the om-manager): `e2e-dev` is skipped only by its own `if` on the docs-only output, never by a failed or skipped need.
  It runs under `!cancelled()` and the docs-only output not being `'true'`, and its first step fails unless `needs.deploy.result == 'success'`.
  `deploy` runs under `!cancelled() && needs.{{decision}}.outputs.docs_only != 'true'`, so a failed decision job fails closed and everything runs.
  Why: a skipped check satisfies the `main` ruleset whatever the cause; run 35474120357 (b95e8eb) shows `deploy` failed and `e2e-dev` reported `skipped`, so a failed deploy already left the promotion PR mergeable on `ci` alone. This closes that existing hole too.
- Scope adjustment (Sebastian): the guard reads the `deploy-dev` run whose head is `github.event.before`, not "the last completed run", and skips only if it concluded `success`.
  A missing, cancelled, in-progress or red run means not docs-only.
  Why: "last completed" ordered by completion time misses a pending code run dropped by the concurrency group; keying on `before` states the invariant "only diff against a proven commit".
- Acceptance 4 adjustment (Sebastian): the om-manager records the live proof on the merged PR at the first docs-only push after merge (run link, the three job conclusions, the promotion PR's merge state). The PR description says it is pending and what to look for.
- om-reviewer decisions, accepted by the om-manager:
  - The diff is a tree diff `before` to `github.sha` with `--no-renames`, so a file moved out of `app/` into `docs/` lists its source and is not docs-only.
  - Any fetch, git or API error in the decision job means not docs-only; forced pushes and an all-zeros `before` too.
  - The decision job gets `actions: read` (workflow default is `contents: read` only) and needs no environment.
  - An empty diff counts as docs-only, since the guard still requires the `before` run to be green.
- Constraints:
  - `e2e-dev` keeps that exact job id and its `environment: dev`; `promotion-pr` keeps `if: ${{ !cancelled() }}` and runs on every push (`docs/modules/deploy/trd.md`, `ard.md` 2026-09-19 entries).
  - Workflow-level concurrency stays as is; no `paths-ignore` or `paths` on any trigger (`docs/modules/deploy/prd.md#Rules`).
  - `ci.yml`, `deploy-prd.yml`, `reusable-deploy.yml` and `infra/` are untouched.
  - document-task corrects, not appends: the "every push to develop" lines in `docs/conventions/e2e.md`, `docs/TRD.md#Conventions`, `docs/modules/deploy/prd.md`, `trd.md`, `flows.md`, and one new `ard.md` entry for the job-level `if`, the guard and the fail-closed shape.
- Review beyond the Pipeline: I read every `if` against five cases (code push, docs-only after green, docs-only after red, decision job failed, deploy failed) and check each leaves `e2e-dev` red, green or skipped as intended.
- clearance: repo

## om-developer notes

### Round 1

- Added the `decide` job to `deploy-dev.yml` (`contents: read`, `actions: read`, checkout `fetch-depth: 0`); its output `docs_only` is `true` only when `before` is a real ancestor of `github.sha`, the `--no-renames` tree diff lists only `docs/**` or root `*.md`, and the latest `deploy-dev` run on `develop` for `before` concluded `success`.
- Any other outcome, including git or `gh` errors, writes `docs_only=false`; a failed `decide` leaves the output empty, which is also not `'true'`.
- `deploy` and `e2e-dev` run under `!cancelled() && needs.decide.outputs.docs_only != 'true'`; `e2e-dev` first step fails unless `needs.deploy.result == 'success'`; `promotion-pr` also needs `decide`.
- Verified: `npm run lint:workflows` green. The five cases were read against the `if` conditions, not run live; the live proof is the first docs-only push after merge.
- Pending: none. Deferred: none.
- Decisions beyond the plan: the diff checks `before` as a hex string and an ancestor of `github.sha`, so forced pushes are not docs-only; the guard takes the most recent run of `before` (`--limit 1`, newest first).
- Module docs, conventions and ARD entry are left to document-task.
