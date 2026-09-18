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
