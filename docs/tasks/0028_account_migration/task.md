---
id: "0028"
title: account_migration
type: chore
crew: devops
clearance: full
branch: chore/0028_account_migration
modules: [infra, deploy, app]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-10-14
updated: 2026-10-14
---

# 0028 Move my-napkin to its own AWS account and to napkin.fless.dev

## Goal

my-napkin runs entirely in its own AWS account `372303522225` (profile `fless-napkin`, SSO session `fless`), served at `napkin.fless.dev`, with infrastructure, CI/CD, scene objects and table items moved there, so the project leaves the management account.
The old site at `napkin.sdfles.com` keeps working, frozen with today's code, and nothing in the old account is touched; redirect and decommission are a second task.

## Scope

- Infrastructure from scratch in the new account: the state bucket `napkin-terraform-state-372303522225` created by hand as `infra/docs/setup.md` describes, providers on profile `fless-napkin` with `allowed_account_ids = ["372303522225"]`, the zone `napkin.fless.dev` read as data, hostnames `napkin.fless.dev` (prd) and `dev.napkin.fless.dev` (dev), then `terraform apply` of `core`, `dev` and `prd` in that order.
  No state is moved and no resource is imported across accounts.
- The GitHub OIDC provider, the deploy roles and everything that used to come from another account or project is a resource of this stack.
- The GitHub resources already exist and belong to the old state; they are adopted with `terraform import` into the new state in this apply and left pointing at the new account: `github_workflow_repository_permissions`, the two `github_repository_ruleset`, the two `github_repository_environment` with their deployment policy, the eight `github_actions_environment_variable` and the two `github_actions_environment_secret`.
  The decommission task must `terraform state rm` every one of them from the old state before any destroy; this is written in `infra/docs/setup.md` and in the Out of scope below.
- `infra/environments/core/budget.tf` is removed: foundation's `project-account` module already owns the account's monthly budget.
- Data is copied, not reloaded, for both environments: the `napkin-{env}` tables by scan and batch write, the scenes buckets object by object through this machine (no server-side copy exists across accounts without a bucket policy), keeping `ContentType`, `Cache-Control` and user metadata.
  The assets buckets are not copied: the deploy workflow rebuilds them.
  An idempotent script under `infra/scripts/` does the copy and the comparison, reading with profile `personal` and writing with `fless-napkin`; item counts and a per-item comparison (keys, sizes, ETags or content hash, attribute equality) are recorded in the PR before `PR ready`.
- Data freeze from the first apply to the merge of the promotion PR: nothing writes to the old account in that window.
- Code and docs: `BASE_URL` in `.github/workflows/deploy-dev.yml`, the origin in `app/tests/unit/signed-fetch.test.ts`, `app/.env.example`, the three infra `.env.example`, `AGENTS.md`, `README.md`, `docs/TRD.md`, `docs/ARD.md`, `docs/modules/{infra,deploy,app}/*`, `docs/conventions/e2e.md`, `infra/docs/*`, `infra/README.md`, `app/src/messages/{es,en}.json`.
  Every reference to other projects or to the management account goes away ("as in X", "copied from Y", `auvral`, `diy-infra`, `local-auctions-infra`); the historical ARD entries are rewritten to stand alone.
- Workspace files: the om-devops copies `infra/environments/{core,dev,prd}/terraform.tfvars` from the root checkout into the worktree with `cp`, never reading them, and writes a fresh `.env` per root with `AWS_PROFILE=fless-napkin`.
  `core`'s tfvars still carries `budget_notification_email`; the variable goes with `budget.tf`, so Terraform warns and ignores it.
  After the apply the om-devops writes the root checkout's `app/.env.local` anew with the same table and bucket names and `AWS_PROFILE=fless-napkin`.

## Out of scope

- Redirecting `napkin.sdfles.com` to `napkin.fless.dev`, destroying the old stacks and deleting the old state bucket: the decommission task, which first runs `terraform state rm` on the GitHub resources in the old state.
- Any change to what the application does.

## Acceptance

1. `terraform apply` of `core`, `dev` and `prd` is clean in `372303522225` with state in `napkin-terraform-state-372303522225`; `terraform plan` is empty afterwards in all three roots.
2. The GitHub environments, variables, secrets, rulesets and workflow permissions are in the new state and point at the new account's role, Lambda, bucket and distribution; the old roots are never planned or applied.
3. Merging the PR deploys dev at `https://dev.napkin.fless.dev`, `e2e-dev` passes against it, and merging the promotion PR serves prd at `https://napkin.fless.dev` with Sebastian's diagrams and libraries.
4. Item and object counts and the per-item comparison match for both tables and both scenes buckets; the numbers are in the PR.
5. `https://napkin.sdfles.com` still serves the old deployment.
6. `grep` finds no `sdfles.com`, `975050033628`, `personal`, `auvral`, `diy` or `local-auctions` in the repo outside the decommission note.
7. `terraform fmt -check`, `terraform validate` in the three roots, `npm run lint:workflows`, lint, typecheck and unit green.

## Approach

- Modules touched: `infra` (primary), `deploy`, `app` (test origin, `.env.example`, messages).
- Decisions:
  - Fresh stack in the new account over moving state: chosen because resources cannot cross accounts and a clean apply is the proof the Terraform stands alone.
  - Import of every GitHub resource over recreating them: GitHub is one; a create would conflict with what exists, and a destroy in the old state would delete the live environments.
  - Hostnames `napkin.fless.dev` and `dev.napkin.fless.dev`: the new zone is the project's, so prd sits at its apex and dev under it; `stacks/app` derives the hostname from a `hostname` variable rather than `napkin.{base_domain}`.
  - Core budget removed: the account budget is foundation's; two budgets would alert twice.
  - Copy through the machine with two profiles: chosen over a cross-account bucket policy because the old account is not to be touched.

## Database

`napkin-dev` and `napkin-prd` are recreated empty in the new account and filled by the copy; same key schema, same items.

## Infra

- New in `372303522225`: state bucket (by hand), OIDC provider, two deploy roles, two Lambdas, two CloudFront distributions, two ACM certificates (DNS validated in `napkin.fless.dev`), four S3 buckets, two tables, Route53 records in the new zone.
- Imported into the new state: the GitHub resources listed in Scope.
- Sebastian runs `aws sso login --sso-session fless` before the apply; the om-devops asks for it through the om-manager if the session is expired.

## Design

None.

## Risks

- ACM validation and CloudFront creation take minutes; the applies are long and must not be interrupted.
- The freeze depends on nobody drawing in the old site between apply and merge.
- Import ids typed wrong show up as a destructive plan: every `plan` is read before its `apply`.
- Until the promotion PR merges, prd still serves from the old account while CI already points at the new one; that window is the freeze.

## Depends on

None. 0025 and 0027 are paused and resume after this merges; their suites then run against the new dev.

## Context & decisions

Consolidated 2026-10-14 by the om-devops with the om-manager.

- Survey (read only, `fless-napkin`): the account holds only the zone `napkin.fless.dev`, delegated and resolving publicly; no OIDC provider, no state bucket.
  GitHub holds exactly the 17 resources Scope lists (rulesets 23691457 and 23691458, branch policies 60453986 and 60454009).
- Acceptance 6, adjusted (om-manager): the grep excludes `docs/tasks/` and `.claude/agent-memory/`, which the om-manager prunes himself.
  `personal` means the AWS profile only (`AWS_PROFILE=personal`, `--profile personal`, "profile `personal`"); the prose "a personal, single-user" and the messages' meta description stay.
  Scope adjusted accordingly: `app/src/messages/{es,en}.json` are not touched.
- Root `app/.env.local` (om-manager): named exception to the main-clone rule for that one file, which the worktree's `app/.env.local` links to.
  After the dev apply, `sed --follow-symlinks -i` on `SCENES_BUCKET` and `AWS_PROFILE` only, never printed; the table name `napkin-dev-diagrams` does not change.
  Nobody runs `npm run dev` or a local e2e until merge, since that would write to the old account.
- Budget (om-manager, from foundation's `project-account/main.tf`): `napkin-monthly` lives in the management account filtered on 372303522225; `core/budget.tf`, its variable and local go.
- Freeze extends to GitHub (om-manager): from the dev apply to this PR's merge only docs-only commits reach `develop`; 0025 and 0027 stay paused.
- Profile (om-manager): never hardcoded; it stays in each root's untracked `.env`, the `.env.example` says `fless-napkin`, and `allowed_account_ids = ["372303522225"]` guards both the aws provider and the S3 backend.
- Tables are `napkin-{env}-diagrams` (Scope says `napkin-{env}`), correction by the om-devops.
- Copy (om-devops): current object versions only, noncurrent ones stay in the old bucket until decommission; the script under `infra/scripts/` takes profiles, buckets and tables as arguments, with no account literal, and is re-run right before `PRs ready`.
- Imports (om-devops): `import` blocks in an untracked file per root, read in the plan next to the creates, removed after the apply.
- Constraints: `docs/modules/infra/ard.md` (zone read never imported, Lambda `ignore_changes`, two CloudFront grants), `docs/TRD.md` (Terraform owns configuration, workflows own code; serial verification).
- Proof before `PRs ready`, since Acceptance 3 is post-merge: both hostnames answer the placeholder 503 over TLS through CloudFront, all three plans empty, the 17 GitHub resources in the new state pointing at the new account, copy counts and comparison in the PR.
- Risk: a new account may get CloudFront "account must be verified"; that is a `blocker`, not a workaround.
- clearance: full; AWS account 372303522225 with `fless-napkin` (create and apply), the old account 975050033628 with `personal` read only (tables and scenes buckets), GitHub `sebasfles/my-napkin` through the Terraform App and `gh` as `sebasfles`, the root `app/.env.local` as above.

## om-devops notes

### Round 1 (2026-10-14)

- Done: backends on `napkin-terraform-state-372303522225`, `allowed_account_ids` on every provider and backend, `stacks/app` takes `hostname`, `core/budget.tf` and its variable gone, `infra/scripts/copy-data.sh`, workflow and test origin on `dev.napkin.fless.dev`, every doc rewritten.
- Applied, all with `fless-napkin` in 372303522225, every plan read first, 0 destroys anywhere:
  - state bucket by hand (`create-bucket`, versioning, AES256, public access block), as `infra/docs/setup.md` section 1.
  - `core`: 3 imported (workflow permissions, rulesets 23691457 and 23691458), 1 added (OIDC provider); plan empty after.
  - `dev`: 7 imported, 30 added, 4 changed (3 variables to the new account, secret value); plan empty after.
  - `prd`: 7 imported, 30 added, 4 changed; plan empty after.
- Copy (`personal` read, `fless-napkin` write): dev 44 items, 45 objects; prd 30 items, 19 objects; compare matched every item and object (attributes, size, ETag, content type, cache control, metadata).
- Proved: both hostnames answer the placeholder 503 over valid TLS; GitHub `dev` and `prd` variables name the new role, Lambda, bucket and distribution; `napkin.sdfles.com` and `napkin.dev.sdfles.com` still 200.
- Root `app/.env.local`: `SCENES_BUCKET` and `AWS_PROFILE` rewritten in place, never printed.
- Decided: the decommission note uses `terraform state rm module.app.module.actions_environment` per environment rather than seven addresses.
- Pending: final copy run before `PRs ready`.
