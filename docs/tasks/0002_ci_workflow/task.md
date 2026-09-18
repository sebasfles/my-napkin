---
id: "0002"
title: ci_workflow
type: feature
branch: feat/0002_ci_workflow
modules: [deploy]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-09-17
updated: 2026-09-17
---

# 0002 CI workflow

## Goal

Every pull request into `develop` or `main` runs the full verification pipeline in GitHub Actions and reports a single required check, so nothing merges without lint, typecheck, unit, e2e and Terraform validation passing, and Sebastian never validates a PR's health by hand.

## Scope

- `.github/workflows/ci.yml` on `pull_request` into `develop` and `main`, runner `ubuntu-latest`, one job named `ci`.
- Steps: `npm ci` in `app/` with Node from `app/.nvmrc`; `npm run lint`; `npm run typecheck`; `npx vitest run`; `npx playwright install --with-deps chromium`; `npx playwright test --workers=1 --grep-invert @aws` against the local dev server; `terraform fmt -check -recursive` in `infra/`; `terraform validate` per root under `infra/environments/*` after `terraform init -backend=false` (skipped while no root exists); `actionlint` on `.github/workflows/`.
- Concurrency group per PR, cancel in progress.
- Playwright browser cache keyed on the Playwright version.
- `.github/dependabot.yml`: weekly updates for `github-actions` at the root and `npm` in `app/`, targeting `develop`.
- `docs/modules/deploy/*` updated by the task for what lands.

## Out of scope

- Deploy workflows, promotion PR, e2e against dev (task deploy_workflows).
- Rulesets naming `ci` as required (Terraform task).
- Deferred: caching `node_modules` beyond the `setup-node` npm cache.

## Acceptance

1. A PR into `develop` shows exactly one check named `ci`.
2. `ci` fails on a lint error, a failing unit test, a failing e2e or unformatted Terraform, proven once each on the task branch and reverted before publish.
3. `ci` passes in under 8 minutes on a cold cache.
4. `actionlint` passes on every workflow file.
5. Dependabot configuration is valid and targets `develop`.
6. The `e2e-worth` check is satisfied by `No e2e: workflow only` in the PR description; `styles` and `i18n` do not apply.

## Approach

- Module and layers touched: `deploy` only (the workflow and dependabot files). If CI needs `retries: 1` in `app/playwright.config.ts`, guarded by `process.env.CI`, that single line is the only touch outside `.github/`.
- Entities, endpoints, tables: none.
- Decisions:
  - One job with sequential steps: chosen over a matrix of jobs because the ruleset requires one check name and the pipeline is short.
  - Pinned major tags (`actions/checkout@v4`, `actions/setup-node@v4` with `node-version-file`, `hashicorp/setup-terraform@v3`): chosen over SHA pins because Dependabot keeps majors current and SHAs add noise for a single-user repo.
  - Dependabot included here: chosen over a separate task because it is one file and `ci` is what validates its PRs.
  - Terraform steps present from day one and skipping on an empty `infra/`: chosen over adding them in the Terraform task so that task inherits a check instead of writing one.

## Database

None.

## Infra

None in AWS. GitHub: none until the ruleset task names `ci` as required.

## Design

None.

## Risks

- Playwright flakiness on the runner; `--workers=1` and `retries: 1` in CI only.
- `terraform validate` on a root that declares providers needs `terraform init -backend=false` to download them; runtime grows with the AWS provider download.

## Depends on

None to start: the workflow is written against 0001's layout. Publishing waits for 0001 to merge, since `ci` needs `app/` on `develop` to go green (see Context & decisions).

## Context & decisions

Consolidated 2026-09-17.

### Decided in consolidation

- Implemented now against 0001's worktree layout, but the acceptance proofs and the publish wait for 0001 to merge, and the branch is rebased on `origin/develop` then (om-manager). Nothing is tracked under `app/` or `infra/` on `develop`, so `ci` is red on this PR until that happens.
- Every `gh` call on this repo runs with `GH_TOKEN=$(gh auth token -u sebasfles)` in the command's environment (Sebastian). The default account here is `sflores-designli`, which has `push: false` on `sebasfles/my-napkin`. Never run `gh auth switch`: other projects on this machine use the designli account.
- The om-reviewer pushes and opens a draft PR after the first clean round, so acceptance 2 and 3 can be proven on real `pull_request` runs; the description is written and the PR marked ready at publish (om-manager).
- `actionlint` is not installed globally and will not be (om-manager). It arrives as the devDependency `github-actionlint@1.7.12` in `app/package.json` with the script `"lint:workflows": "github-actionlint"`, and that dependency plus that script is the only allowed touch in `app/`.
- The npm package `actionlint@2.0.6` proposed for that role was rejected (om-reviewer): it is a wasm library with no `bin`, last published in 2022, wrapping an old core. `github-actionlint` is MIT, published through npm trusted publishing, and wraps the official 1.7.12 release binary. Verified from `app/`: it walks up to the git root, lints `.github/workflows/`, exits 1 on findings and 0 when clean. It fetches the binary from GitHub Releases on first run into `~/.github-actionlint/bin/{{version}}/`, honours `ACTIONLINT_CACHE_DIR` and `ACTIONLINT_BIN`, and uses `GITHUB_TOKEN` when set, so CI either caches that path or accepts a small download.
- `docs/TRD.md`, Verification targets, deploy row becomes path `app/` with lint `npm run lint:workflows`; the om-developer makes that edit in `document-task`.
- No `Co-Authored-By`, `Claude-Session` or any agent attribution in commits or the PR (Sebastian's standing rule).

### Adjustments

- Scope adjusted: Node comes from the root `.nvmrc` through `node-version-file`, not `app/.nvmrc`, because 0001 puts it at the root.
- Scope adjusted: no `retries: 1` line is added to `app/playwright.config.ts`. 0001 already ships `retries: process.env.CI ? 1 : 0` and `workers: 1`.
- Acceptance 5 adjusted: `.github/dependabot.yml` is only read from the default branch, which is `main`. It is proven here by a schema-valid file setting `target-branch: develop`, and it activates when the promotion PR carries it to `main`.
- Goal unchanged.

### Constraints for the om-developer

- No `paths` or `paths-ignore` on `ci.yml`. The Terraform task makes `ci` a required check, and a workflow that is skipped leaves a required check pending forever.
- `permissions: contents: read` at the workflow level and no secret in `ci.yml`, so fork pull requests keep running on this public repo (`docs/modules/deploy/ard.md`, 2026-09-17).
- The Terraform steps guard on `infra/` being absent, not merely empty: git does not track empty directories.
- `docs/TRD.md`, Verification targets, is the only source of the commands CI runs; e2e keeps `--grep-invert @aws`.
- E2E runs through the config's own `npm run dev` webServer. If the run misses the 8 minute budget or flakes, CI switches to `npm run build` plus `next start` with `BASE_URL`, which `app/playwright.config.ts` already supports and which stays inside `.github/`.
- Base branch is `develop`, not the GitHub default `main`.

### What I check beyond the Pipeline

- Nothing changes outside `.github/`, `app/package.json`, `app/package-lock.json` and the docs the task updates.
- The four red proofs of acceptance 2 are real `ci` runs on the draft PR, audited by run id with the failing step named, and the tree at publish carries none of the breakages.
- Acceptance 1 is read from the PR's check list, not from the workflow file.
- No check in `docs/checks/` has `paths` matching this diff, so review rounds run no background checkers.

### Scope correction, 2026-09-18: `ci` runs no e2e

- Supersedes the addition recorded here on 2026-09-17, which put `APP_PASSWORD` and `SESSION_SECRET` on the Playwright step. That instruction never shipped: the step it attached to is gone.
- Sebastian, through the om-manager: `ci.yml` runs no e2e at all. Specs run only in `e2e-dev.yml`, on pull requests into `main`, against the deployed `napkin.dev.sdfles.com`. `docs/conventions/e2e.md` on `develop` (8241682) is the source, and the branch is rebased on it.
- `ci.yml` therefore holds no secret again, and the original constraint stands unchanged: `permissions: contents: read`, `pull_request` rather than `pull_request_target`, and pull requests from forks of this public repository keep passing.
- The rule that a Playwright trace must never be uploaded as an artifact survives, re-homed (om-reviewer): it belongs to `e2e-dev.yml`, which logs into deployed dev with a real `APP_PASSWORD`, not to `ci.yml`, which now holds nothing to leak.
- Acceptance 2 adjusted (om-reviewer): its "failing e2e" limb has nothing left to prove, so three breakages remain, a lint error, a failing unit test and unformatted Terraform. All three are re-proven against the workflow that ships, because the earlier proofs exercised a file with four more steps in it. The e2e proof already run (run 35308780493) stays in the record as history, not as evidence.
- Acceptance 3 keeps its 8 minute budget, which stops being interesting once Playwright leaves the job. Measured cold on the shipping workflow anyway rather than assumed.
- Accepted consequence, raised by the om-developer and recorded here rather than left to be discovered: `ci` no longer executes `app/src/` at runtime. The gate into `develop` proves the app lints, typechecks and passes its unit tests, and the first thing that proves a page still renders is `e2e-dev.yml` on the promotion pull request into `main`. This widens what can reach `develop` green, and `docs/modules/deploy/trd.md` says so.
- Goal unchanged.
### Reiteration 1, 2026-09-18 (retake 1, PR #2)

Sebastian's retake restates the correction already recorded above and adds the state of the branch itself.
Nothing in it changes Goal, Scope or the decisions taken so far.

- Items 1 and 2 of `retakes.md` (no e2e and no secrets in `ci.yml`; `docs/modules/deploy/trd.md` still claiming Playwright e2e) were already done in the working tree when the sessions closed, but were never committed, so the pushed branch still shows the old state. They land as round 5 rather than as new work.
- Item 3 is the real finding: the pull request head is `aa79ddc`, the deliberate `tmp: invalid terraform` commit from acceptance 2's proof 4b. The proof cycle was interrupted mid-flight by the session closing, so the branch was left on a breakage. It goes away when the clean tip is force-pushed, and the branch must never be published from a `tmp:` commit.
- Item 4, rebase on `origin/develop`, now `2e2be66` with 0005 and 0006 merged.
- The three acceptance 2 proofs are re-run against the shipping workflow after the rebase, as already decided above: a lint error, a failing unit test and unformatted Terraform. The `validate` branch is not re-run, since round 5 does not touch the Terraform step and proof 4b (run 35309306882) already drove every line of it.
- Round 4's entry in `om-developer notes` describes secrets that never shipped. It is reconciled in round 5 rather than left standing, because the notes travel to Sebastian in the pull request.

## om-developer notes

### Round 1

Implemented the whole Scope: `.github/workflows/ci.yml` and `.github/dependabot.yml`, plus the single allowed touch in `app/` (the `github-actionlint@1.7.12` devDependency, the `lint:workflows` script and the resulting `package-lock.json` entries).
Nothing else in `app/` and nothing in `infra/` changed.

Rebased on `origin/develop` after 0001 merged, so the workflow is written against the real tree: Node comes from the root `.nvmrc`, the npm cache is keyed on `app/package-lock.json`, and `app/playwright.config.ts` was not touched because it already sets `retries` and `workers` under `CI`.

What I verified locally, since `ci` itself can only be proven on a pull request:

- `npm run lint:workflows` from `app/` exits 0 on the workflow, and exits 1 with the offending line when I break it (I flipped `runs-on` to an unknown label, saw the `runner-label` finding, and restored the file). A clean exit alone would not have proven the linter reads `.github/workflows/`.
- `.github/dependabot.yml` validates against the SchemaStore `dependabot-2.0` schema with `ajv --spec=draft7`, run from `/tmp` so no dependency entered the repo. This is the evidence acceptance 5 asks for, since GitHub only reads that file from the default branch.

Decisions this round that `Approach` and `Context & decisions` did not already record:

- The Terraform steps are one shell step guarding on `infra/` being absent and looping over `infra/environments/*/`, entered only when the directory holds a `main.tf`. Chosen over `if:` expressions with `hashFiles` because one script covers both guards the task asks for (no directory, and a directory with no root yet) and a glob that matches nothing cannot fail it. `hashicorp/setup-terraform@v3` still runs unconditionally: it costs seconds and keeps the step list stable once `infra/` lands.
- The actionlint binary is downloaded on every run rather than cached, with `GITHUB_TOKEN: ${{ github.token }}` in the step's environment so the GitHub Releases fetch is authenticated and not rate limited by the shared runner IP. `Context & decisions` left this open ("caches that path or accepts a small download"); a 2 MB download beats a cache save and restore in both runtime and workflow size. `github.token` comes from the `github` context, not from `secrets`, and is granted to fork pull requests, so `permissions: contents: read` with no secret still holds.
- Step order follows Scope literally, so the workflow lint runs last. Fail-fast would argue for running it first, but the order is written down and a malformed workflow file fails at GitHub's own parse before any step runs.
- The Playwright browser cache is restored and saved by `actions/cache@v4` keyed on the version resolved from `@playwright/test/package.json`, and `npx playwright install --with-deps chromium` runs unconditionally: on a cache hit it still has to install the OS packages, which the cache cannot carry.

Pending, by design and not by omission:

- Acceptance 1, 2 and 3 are proven on the draft pull request the om-reviewer opens, not here. Acceptance 2 needs four red `ci` runs (lint error, failing unit test, failing e2e, unformatted Terraform) and the tree at publish carries none of them.
- The `docs/TRD.md` deploy row (path `app/`, lint `npm run lint:workflows`) is a `document-task` edit, not a round edit.

Deferred, noted and not done:

- `npm audit` on `app/` reports 11 advisories inherited from 0001, all through `@excalidraw/excalidraw` and its `nanoid`, whose only fix is a downgrade to 0.17.6. Out of scope here and not something `ci` should gate on today.
- Dependabot opens one pull request per outdated dependency. If the weekly noise becomes real, `groups` on the npm ecosystem is the answer; not configured now because there is no evidence yet of how much it opens.
- Caching `node_modules` beyond the `setup-node` npm cache stays deferred, as Out of scope says.

### Round 2

Applied the single finding: `timeout-minutes: 20` on the `ci` job, next to `runs-on`.
No other change.

I agree with the reasoning and would not have caught it from the workflow alone: `npm ci`, `playwright install` and the actionlint release download have no timeout of their own, and the Playwright `webServer` timeout bounds only the dev server's start, so a stalled step would hold a required check pending on GitHub's 6 hour default and block the merge with no signal.
20 minutes is about twice the acceptance 3 budget, so a cold-cache run never trips it.

### Documentation

Files updated: `docs/modules/deploy/{README.md,prd.md,trd.md,ard.md}`, the `Debt index` of `docs/ARD.md`, and the deploy row of `docs/TRD.md`.
`docs/modules/deploy/{database.md,flows.md}` unchanged: this task owns no table and added no flow that deserves a diagram, since `ci` is a linear list of steps.

`docs/TRD.md` is normally the om-manager's file and `document-task` says so, but `Context & decisions` assigns the Verification targets deploy row to me for this pass.
I changed only that row, to path `app/` and lint `npm run lint:workflows`.

`docs/modules/app/*` is untouched even though the diff edits `app/package.json` and `app/package-lock.json`.
The two lines are the deploy target's linter, not application code or tooling, and they are documented where they belong, under deploy's Testing and its ARD entry, with a `Borrows` line in deploy's README so the reader of `app/package.json` finds the owner.

Three ARD entries in `docs/modules/deploy/ard.md`, one per decision the plan did not record: the linter as an npm devDependency downloaded per run, the self-guarding Terraform steps, and the 20 minute job timeout.
The four decisions already in `Approach` (one job, pinned major tags, Dependabot here, Terraform steps from day one) are not duplicated.

One piece of debt found during this pass and not created by carelessness: `github-actionlint` depends on `adm-zip@0.5.18`, which carries GHSA-xcpc-8h2w-3j85 (high) and GHSA-vwc7-r8mq-g2x9 (moderate).
Both are fixed in `adm-zip@0.6.1`, `npm audit` reports `fixAvailable: false` because the linter's own range excludes 0.6, and both need a crafted archive to trigger.
The only archive it opens is the actionlint release it fetched itself over HTTPS from the official repository, and it never ships in the Lambda, so I documented it as accepted debt with a row in the `Debt index` rather than force an `overrides` entry that `Context & decisions` does not allow me to add to `app/package.json`.
The existing `app` row about 9 advisories under the editor package is still exact: the audit total of 11 is those 9 plus these 2.
Flagged to the om-reviewer, whose call it is whether to spend a round on an override before publish.

Corrected while in the files, not appended: deploy's `prd.md` and `trd.md` said `ci.yml` validated only `infra/environments/prd`, and `prd.md` referred to a `deploy.yml` that the layout renamed to `deploy-dev.yml` and `deploy-prd.yml`.
Both files also still opened with "Planned; no code exists yet", which stopped being true with this task.

### Round 3

Applied the single finding: `actions/checkout@v7`, `actions/setup-node@v7`, `actions/cache@v6`, `hashicorp/setup-terraform@v4`.
No other change to the workflow.

I confirmed the finding before bumping rather than taking the versions on trust, because a wrong major here breaks the merge gate for every later task:

- Current majors from each action's own tags: checkout v7 (release v7.0.1), setup-node v7 (v7.0.0), cache v6 (v6.1.0), setup-terraform v4 (v4.0.1). The plan's v4 and v3 are three, three, two and one majors behind.
- Every input I pass still exists at the new tag, read from `action.yml` at that ref: `node-version-file`, `cache` and `cache-dependency-path` in setup-node, `path` and `key` in cache, `terraform_wrapper` in setup-terraform. Checkout takes none.
- All four declare `using: node24`, which is what removes the deprecation annotation the om-reviewer saw on the baseline run.

This deviates from `Approach`, which names v4 and v3 literally, so it is a recorded decision rather than a silent fix.
The plan's own reason for pinning majors is that Dependabot keeps them current, and shipping the permanent merge gate three majors behind on a deprecated runtime contradicts that reason.
It becomes an ARD entry, because the next reader of the workflow needs to know the pin is a floating major by intent and not an oversight.

Documentation of the versions: `docs/modules/deploy/*` names no action tag and should not, since the workflow file is the source of that fact and a copy in prose goes stale at the first Dependabot bump.
What the docs record instead is the pinning policy, in the new ARD entry.

### Documentation, second pass

One ARD entry added in `docs/modules/deploy/ard.md` for the action pinning policy, since round 3 deviated from the tags `Approach` names.
No other doc changed: `docs/modules/deploy/*` deliberately names no action tag, so the bump left nothing stale to correct.
No new debt and no `Debt index` change.

### Documentation, third pass

Rewrote the `adm-zip` debt paragraph on the om-reviewer's finding, and narrowed `Revisit when` to Windows or a widened range.
I read the installed package before signing the stronger claim: both `adm-zip` calls live in `extractZip`, which `download` reaches only in the `else` of `ext === "tar.gz"`, and `platform.js` sets `ext` to `zip` only for `win32`.
So the dependency is installed and never invoked on Linux or WSL, which closes the debt instead of leaving it for Sebastian to re-litigate.
`overrides` rejected on the record: it would risk the merge gate on an untested transitive bump to fix a path we never enter.
The `Debt index` row in `docs/ARD.md` stays terse, as the om-reviewer asked.

### Round 4

Superseded before it shipped, so there is nothing here to describe.
It put `APP_PASSWORD` and `SESSION_SECRET` on the `End-to-end tests` step of `ci.yml`; round 5 deleted that step, and with it the `env:` block, the ARD entry, the debt row and the doc changes this round had made.
See `Scope correction, 2026-09-18` in `Context & decisions`.

### Round 5

`ci` runs no e2e.
Deleted `Resolve Playwright version`, `Cache Playwright browsers`, `Install Playwright browsers` and `End-to-end tests` from `ci.yml`, which removed round 4's `env:` block with the step it was attached to.
Everything else is untouched: the 20 minute timeout, the current action majors, the npm cache, the Terraform step, `Lint workflows`, dependabot.
`app/playwright.config.ts` not touched, and `github-actionlint` stays in `app/package.json`.

Docs, reconciled rather than reverted:

- `docs/modules/deploy/trd.md`: the fork promise, `no secret` and `pull_request` over `pull_request_target` restored; the three-store secret list collapsed back to the single `dev` environment `APP_PASSWORD` for `e2e-dev.yml`; `ci` described as lint, typecheck, unit, Terraform and workflow checks, with e2e pointed at `e2e-dev.yml` and `docs/conventions/e2e.md` for the policy instead of restating it.
- The coverage consequence stated plainly there, because it is the part of this correction that is easiest to miss: nothing in `ci` executes `app/src/` at runtime, so the gate into `develop` proves the app lints, typechecks and passes its unit tests and no more, and a change that compiles and breaks the editor reaches `develop` green. The promotion pull request into `main` is where a broken page is caught.
- The no-artifact-upload rule re-homed to `e2e-dev.yml`'s description in `trd.md`, since that workflow logs into deployed dev with a real `APP_PASSWORD` and `ci.yml` now holds nothing to leak.
- `docs/modules/deploy/prd.md`: fork rule removed, and the flow step corrected to say `ci` runs no e2e and where the browser tests actually run.
- `docs/modules/deploy/ard.md`: round 4's entry removed, since it recorded a decision that never shipped, and its `Debt index` row removed from `docs/ARD.md`.
- Round 4's block in these notes cut to a line saying it was superseded, rather than left standing with a correction appended under it.

Two things I corrected that were not on the list, both made false by this round:

- The pinning ARD entry claimed `actions/cache@v6` ships. The cache step is gone with Playwright, so `actions/cache` is no longer used at all and the entry now names only the three actions that remain. The decision itself is unchanged; only the enumeration was wrong.
- The same entry said "the four red proofs". Acceptance 2 lost its e2e limb, so it says "the red proofs".

On the verification command: `docs/TRD.md` on `develop` dropped `--grep-invert @aws` from the app row, and no spec carries an `@aws` tag today, so the change alters nothing about which specs run.
Nobody should read it as a change in coverage: the 9 specs that ran before are the 9 that run now.
