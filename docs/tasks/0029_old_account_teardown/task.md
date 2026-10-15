---
id: "0029"
title: old_account_teardown
type: chore
crew: devops
clearance: full
branch: chore/0029_old_account_teardown
modules: [infra]
repos: ["."]
phases: 0
depends_on: ["0028"]
ticket:
created: 2026-10-14
updated: 2026-10-14
---

# 0029 Remove everything of my-napkin from the management account

## Goal

Nothing of my-napkin remains in the management account `975050033628`: no Lambda, CloudFront distribution, certificate, bucket, table, role, OIDC provider, `napkin.*` record in `sdfles.com` or state bucket, so the project lives only in its own account and the old site stops serving.

## Scope

- First, in the OLD state (`napkin-terraform-state-975050033628`, roots `core`, `dev`, `prd`, profile `personal`): `terraform state rm` of every GitHub resource, since 0028 imported them into the new state and a destroy here would delete the live environments and rulesets: `github_workflow_repository_permissions`, the two `github_repository_ruleset`, the two `github_repository_environment` with their deployment policy, the eight `github_actions_environment_variable`, the two `github_actions_environment_secret`.
  After the `rm`, `terraform state list` in each old root shows no `github_` address.
- Then a final check that nothing wrote to the old tables and scenes buckets after 0028's copy: item and object counts equal to the ones recorded in PR #42 (dev 44 items and 45 objects, prd 30 items and 19 objects).
- Then check whether the old `core` OIDC provider (`token.actions.githubusercontent.com`) is referenced by any IAM role in the account other than napkin's two deploy roles.
  If it is, `terraform state rm` it so it survives and write a note for foundation; if not, it is destroyed with the rest.
- Then `terraform destroy` of `prd`, `dev`, `core`, in that order, with `terraform plan -destroy` read before each; the old Terraform code is the code at the merge base of PR #42 (`a153682^`), checked out in a scratch folder outside the worktree because the current tree already points at the new account.
- Then the old state bucket deleted by hand: every object version and delete marker removed, then the bucket.
- Then the repo: the decommission note in `infra/docs/setup.md` removed, and the last mentions of profile `personal`, `napkin.sdfles.com`, `napkin.dev.sdfles.com` and `975050033628` gone, except in `docs/tasks/`.
  `docs/modules/infra/ard.md` gets one entry saying the project left the management account and how.

## Out of scope

- A redirect from `napkin.sdfles.com`: the hostname stops resolving.
- Anything else in the management account (other projects, the `sdfles.com` zone itself, IAM users, SES): foundation's business.
- Any change to the new account or to `app/`.

## Acceptance

1. `terraform state list` in the three old roots shows no `github_` address before the first destroy, and the GitHub environments, variables, secrets, rulesets and workflow permissions are unchanged afterwards (`gh api` listing before and after match).
2. The final counts match PR #42's; the comparison is in the PR.
3. `terraform destroy` of `prd`, `dev` and `core` completes; `aws` listings with profile `personal` in `us-east-1` show no `napkin-*` Lambda, distribution, bucket, table or role, no `napkin.*` record in `sdfles.com`, and no OIDC provider unless it was kept for another project, in which case the note says so.
4. The bucket `napkin-terraform-state-975050033628` no longer exists.
5. `https://napkin.sdfles.com` no longer serves the app; `https://napkin.fless.dev` and `https://dev.napkin.fless.dev` still do.
6. `grep` finds no `personal`, `sdfles.com` or `975050033628` in the repo outside `docs/tasks/` and `.claude/agent-memory/`; `terraform fmt -check`, `terraform validate` in the three roots and lint:workflows green.

## Approach

- Module touched: `infra` (docs and the setup note); the destroy itself runs against the old code in a scratch checkout, nothing of it is committed.
- Decisions:
  - No redirect: a personal, single-user site whose owner already uses the new hostname; a redirect would keep infrastructure in an account meant to be empty.
  - No grace period: the data was copied, compared and the freeze held; nothing has been written to the old account since.
  - Old code from the merge base of #42 rather than the current tree: the current roots point at the new account and backend; destroying must use the configuration that created the old resources.
  - Shared OIDC provider check before destroy: "one per account" means another project still in the management account may trust it.

## Database

Old `napkin-dev-diagrams` and `napkin-prd-diagrams` destroyed after the final count check; the new ones untouched.

## Infra

- Destroyed in `975050033628`: two Lambdas, two distributions, two certificates, four buckets, two tables, two deploy roles, Route53 records, the OIDC provider unless shared, the state bucket.
- Profile `personal` is used one last time, with `AWS_PROFILE=personal` in the scratch roots' `.env`; the tfvars for the old roots are the ones already in the root checkout, copied into the scratch folder with `cp`, never read.

## Design

None.

## Risks

- A destroy run without the `state rm` deletes the live GitHub environments: Acceptance 1 exists for that; the plan must show zero `github_` resources to destroy.
- The OIDC provider may be shared; destroying it breaks another project's deploy.
- Emptying a versioned bucket needs every version deleted; a plain `rb` fails.

## Depends on

0028 (merged).

## Context & decisions

- Survey (read only, `personal`, 2026-10-14): 2 Lambdas, 2 log groups, 2 distributions, 2 certificates, 5 buckets (state included), 2 tables, 4 roles (`napkin-{dev,prd}-{deploy,server}`), 6 records in `sdfles.com` (A, AAAA and validation CNAME per hostname), budget `napkin-core-monthly`, the OIDC provider.
- prd protection (om-manager, on om-devops's recommendation): the old `prd/locals.tf` has `deletion_protection = true` and `force_destroy = false`, so a destroy would stop on the table and the non-empty buckets.
  In the scratch prd root both are flipped, then one `terraform apply` whose read plan shows exactly 3 in-place updates (table deletion protection, `force_destroy` on both buckets) and nothing else, then `plan -destroy`, then destroy.
  Scope adjusted: this apply is added before prd's destroy.
- Scratch config (om-devops, accepted): the old code comes from `git archive a153682^ infra`, outside the worktree; after the `state rm`, the GitHub provider, `github.tf` and the `actions_environment` module calls are stripped from it, so no plan there can create or overwrite a live GitHub resource.
  tfvars are `cp`'d from the root checkout, never read; core's still carries `budget_notification_email`.
- OIDC provider (om-devops survey, om-manager): shared; 5 `clara-prd-*` roles of another repository trust it.
  It is `terraform state rm`'d from core and kept, then its 4 napkin tags (`Project`, `Environment`, `ManagedBy`, `Name`) are removed with `aws iam untag-open-id-connect-provider`.
  The note for foundation (it adopts the provider, untagged) goes in `om-devops notes` and the PR's Decisions; the om-manager relays it to om-foundation-manager.
- Budgets (om-manager): `napkin-core-monthly` is core's and goes with its destroy, the only resource left in core's state after the `rm`; `napkin-monthly` (filtered on 372303522225) is foundation's, stays, and is not counted by Acceptance 3.
- Acceptance 6 (om-manager, same reading as 0028): `personal` means the AWS profile only; the prose ("a personal, single-user", "personal access token", the meta description in `app/src/messages`) stays and `app/` is untouched.
- Acceptance 1 evidence (om-devops): `gh api` as `sebasfles` before the `rm` and after the last destroy, over workflow permissions, rulesets, both environments with their branch policies, variables (names and values) and secrets (names and `updated_at`); the two listings diffed in the PR.
- Acceptance 2 (om-devops): items by `scan --select COUNT`, objects as current versions (`list-objects-v2`), as 0028 counted them.
- Acceptance 3 listing also covers log groups, OACs and certificates.
- Docs (om-devops, in `document-task`): `infra/docs/setup.md` section 6 removed; `docs/ARD.md` 2026-10-14 entry and its debt row resolved; `docs/modules/infra/ard.md` 2026-10-14 entry resolved plus one new entry; `docs/modules/infra/trd.md` setup row trimmed.
- Constraints: `docs/modules/infra/ard.md` (state never committed, zone read never owned), `docs/TRD.md` (Terraform owns configuration, serial verification), `AGENTS.md` (no tfvars or `.env` read, public repo, base `develop`).
- Order: GitHub listing, `state rm` in core, dev, prd, `state list` shows no `github_`, final counts, OIDC `rm` and untag, prd (flip apply, destroy), dev, core, state bucket emptied of every version and delete marker then deleted, listings, hostnames, docs.
- clearance: full; account 975050033628 with `personal` (state rm, the prd flip apply, destroy of the three old roots, untagging the OIDC provider, deleting the old state bucket), 372303522225 with `fless-napkin` read only, GitHub `sebasfles/my-napkin` read only through `gh` as `sebasfles`.

## om-devops notes
