---
updated: 2026-10-14
source: 0028_account_migration
---

# infra: product

All three roots are applied in account `372303522225`; `dev` answers on `dev.napkin.fless.dev` and `prd` on `napkin.fless.dev`.

## Purpose

Gives Sebastian a single environment he can create, inspect and tear down with Terraform commands, so the AWS resources my-napkin needs (storage, database, compute, CDN, domain) exist without being clicked together by hand, and so the GitHub Actions workflow can deploy code without ever holding AWS access keys.

## User flows

### First-time setup

1. Sebastian creates the Terraform state bucket by hand, once, before the first `init`.
2. Sebastian copies `.env.example` to `.env` and `terraform.tfvars.example` to `terraform.tfvars`, then fills in `github_app_pem`, `app_password` and `session_secret`.
3. Sebastian runs `terraform init` and `terraform apply` from his own machine.
4. Terraform creates the buckets, the table, the Lambda (against a placeholder bootstrap zip), CloudFront, the ACM certificate, the `napkin` Route53 records, the GitHub OIDC deploy role, and the GitHub Actions environment that names all of them for the deploy workflow and admits only that environment's branch.

Errors and empty states: a failed `apply` leaves prior resources untouched; Terraform reports which resource failed and Sebastian re-runs after fixing it.

### Changing configuration

1. Sebastian edits a literal in `locals.tf` or a variable.
2. Sebastian runs `terraform plan` then `terraform apply` from his own machine.
3. The change is live; no code deploy is needed unless application code also changed.

## Rules

- `terraform apply` is always run by Sebastian from his machine, never from GitHub Actions.
- The `napkin.fless.dev` Route53 zone is read, never imported or owned; Terraform only creates the alias and validation records inside it.
- `terraform.tfvars` holds only `github_app_pem`, `app_password` and `session_secret`; everything else is a literal in `locals.tf`.
- The target fixed cost is $0/month besides the Route53 zone, which comes with the account, as does its monthly budget.

## Out of scope

- An image optimization Lambda, a revalidation queue, an ISR cache: the app does not use them.
- A third environment: only `dev` and `prd` exist.
- Deploying application code: that is `deploy`'s job.

## Open questions

None.
