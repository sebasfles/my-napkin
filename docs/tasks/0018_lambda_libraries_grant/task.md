---
id: "0018"
title: lambda_libraries_grant
type: bug
branch: bugfix/0018_lambda_libraries_grant
modules: [infra]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-09-21
updated: 2026-09-21
---

# 0018 The Lambda has no S3 grant on the libraries prefix

## Goal

Creating, opening, importing and exporting a library works on dev and prd as it does locally.
Libraries (0012) live under `libraries/{id}/` in the scenes bucket, and the Lambda's IAM policy only grants `scenes/*`, so on AWS every library write and every presigned library URL should be refused.
Locally the `personal` profile is an admin, which is why the suite never saw it.

## Scope

- `infra/stacks/app/compute.tf`: the bucket prefixes the app writes (`scenes/`, `libraries/`) become one declared list (a `local` or variable), and the Lambda's S3 object statement derives its resources from it, same actions as today. Adding a prefix is one line in that list.
- Reproduce on deployed dev first, as a user does, and again after Sebastian applies.
- Docs: `docs/modules/infra/trd.md` where the policy is described, and a note in `docs/modules/infra/ard.md` that a new S3 prefix needs its grant.

## Out of scope

- Any change to how libraries are stored or presigned.
- Bucket policies, CloudFront or the OAC (0008).
- The app-side test that keeps `s3.ts` aligned with that list: task 0019, after this one.

## Acceptance

1. Replication steps fail on dev before the fix and pass after Sebastian's `terraform apply` in dev.
2. `terraform fmt -check`, `terraform validate` and `terraform plan` in dev show only the policy statement change: `libraries/*` added, `scenes/*` unchanged.
3. The ARD note is in place.
4. Sebastian applies prd after the promotion PR merges; the task's PR description says so.

## Approach

- Module `infra` only (`stacks/app/compute.tf`); no application code changes.
- Sebastian runs `terraform apply` in `infra/environments/dev` from his machine once the PR is merged, then verifies on dev; agents never apply.

## Database

None.

## Infra

Lambda execution role policy: S3 object resources built from the declared prefix list, which gains `libraries/`. Applied by hand in dev and prd.

## Design

None.

## Replication

See `replication.md`.

## Risks

- The reproduction on dev leaves a half-created library row in the shared dev table if the S3 write fails after the Dynamo write; the developer cleans it.

## Depends on

None.

## Context & decisions

- The reproduction on dev is the suite's, not a hand one: agents never hold the dev password, and `e2e-dev` behaves as a user.
  Runs 35540680158 and 35542288597 of `deploy-dev.yml` (2026-09-20, after 0012 phases 1 and 2) clicked `library-new` and timed out at `waitForURL`; the dev server log shows `AccessDenied` on `s3:PutObject` for `libraries/{id}/scene.json` at the same second as each attempt.
  `aws iam get-role-policy` on `napkin-dev-server` confirms the statement names `scenes/*` alone.
  Every `e2e-dev` since (phase 3, 0016, 0017) was cancelled, so no run has proved libraries on dev yet.
- No half-created rows to clean: `POST /api/diagrams` writes the S3 object before the table row, so each failed create left nothing; a scan of the dev table for `kind = library` returns 0.
- The list is a `local` at the top of `compute.tf`, not in `locals.tf`, so 0019's test reads one file and the list sits next to the statement it feeds.
  The statement keeps its `scenes` sid: it names the bucket, not the prefix.

## om-developer notes

- `terraform fmt -check -recursive`, `terraform validate` in core, dev and prd: clean.
- `terraform plan` in dev and in prd, from the root checkout: `0 to add, 1 to change, 0 to destroy`, the role policy in place, `libraries/*` added and `scenes/*` unchanged.
- After the fix on dev: pending Sebastian's `terraform apply` in `infra/environments/dev`; the proof is the next green `e2e-dev`, whose library specs create, open and delete libraries.
