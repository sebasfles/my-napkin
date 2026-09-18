---
updated: 2026-09-17
source: setup
---

# infra: product

Greenfield: this describes the planned behavior, nothing here is built yet.

## Purpose

Gives Sebastian a single environment he can create, inspect and tear down with Terraform commands, so the AWS resources my-napkin needs (storage, database, compute, CDN, domain) exist without being clicked together by hand, and so the GitHub Actions workflow can deploy code without ever holding AWS access keys.

## User flows

### First-time setup

1. Sebastian creates the Terraform state bucket by hand, once, before the first `init`.
2. Sebastian copies `.env.example` to `.env` and `terraform.tfvars.example` to `terraform.tfvars`, then fills in `app_password` and `session_secret`.
3. Sebastian runs `terraform init` and `terraform apply` from his own machine.
4. Terraform creates the buckets, the table, the Lambda (against a placeholder bootstrap zip), CloudFront, the ACM certificate, the `napkin` Route53 records and the GitHub OIDC deploy role.

Errors and empty states: a failed `apply` leaves prior resources untouched; Terraform reports which resource failed and Sebastian re-runs after fixing it.

### Changing configuration

1. Sebastian edits a literal in `locals.tf` or a variable.
2. Sebastian runs `terraform plan` then `terraform apply` from his own machine.
3. The change is live; no code deploy is needed unless application code also changed.

## Rules

- `terraform apply` is always run by Sebastian from his machine, never from GitHub Actions.
- The `sdfles.com` Route53 zone is read, never imported or owned; Terraform only creates the `napkin` records inside it.
- `terraform.tfvars` holds only `app_password` and `session_secret`; everything else is a literal in `locals.tf`.
- The target fixed cost is $0/month; the Route53 zone itself is already paid for and out of scope.

## Out of scope

- An image optimization Lambda, a revalidation queue, an ISR cache: the app does not use them.
- A third environment: only `dev` and `prd` exist.
- Deploying application code: that is `deploy`'s job.

## Open questions

None.
