---
updated: 2026-09-17
source: setup
---

# Technical Requirements Document

Describes the whole application.
Nothing is built yet: this document is the design the code must converge to, and every task updates it as code lands.

## Components

| Component | Kind | Path | Base branch | Stack |
|---|---|---|---|---|
| app | app | `app/` | `main` | Next.js (App Router), TypeScript, @excalidraw/excalidraw, OpenNext |
| infra | app | `infra/` | `main` | Terraform >= 1.10, AWS provider ~> 6 |
| deploy | app | `.github/workflows/` | `main` | GitHub Actions |

### app

- Stack: TypeScript, Node 22, Next.js App Router with route handlers, `@excalidraw/excalidraw` from npm, npm as package manager, built with `@opennextjs/aws`.
- Layout: `src/app/` (pages and `api/` route handlers), `src/middleware.ts` (auth gate), `src/lib/` (dynamo, s3, session), `tests/` (Vitest unit, Playwright e2e).
- Install: `npm ci`
- Workspace files: `.env.local` with `APP_PASSWORD`, `SESSION_SECRET`, `DIAGRAMS_TABLE`, `SCENES_BUCKET`, `AWS_PROFILE=personal`.
- API spec: none; five route handlers documented in `modules/app/trd.md`.
- Data: DynamoDB table for the diagram index, S3 bucket for scene JSON; no ORM, no migrations. Both provisioned by `infra`.
- Delivery: one environment, `prd`, at `napkin.sdfles.com`. Built by OpenNext into one Lambda plus static assets, deployed by `deploy`.

### infra

- Stack: Terraform >= 1.10, `hashicorp/aws ~> 6`, state in S3 bucket `napkin-terraform-state` with `use_lockfile`.
- Layout: `environments/prd/` (the only root), `stacks/app/` (composite), `modules/aws/` (leaf modules), `docs/` (setup and deploy notes).
- Install: `terraform init` in `environments/prd/` after `source .env`.
- Workspace files: `environments/prd/.env` (`AWS_PROFILE=personal`) and `environments/prd/terraform.tfvars` (`app_password`, `session_secret`), both gitignored, both with a committed `.example`.
- API spec: none.
- Data: none of its own.
- Delivery: `terraform apply` run by Sebastian from his machine, never from CI.

### deploy

- Stack: GitHub Actions, `aws-actions/configure-aws-credentials` over OIDC, AWS CLI.
- Layout: `ci.yml` (pull requests), `deploy.yml` (push to `main`).
- Install: none.
- Workspace files: none.
- Delivery: see `modules/deploy/trd.md`.

## Verification targets

`verify-task` reads this table literally.
One row per component.
Commands run one at a time, serial flags included.

| Target | Path | lint | typecheck | unit | e2e |
|---|---|---|---|---|---|
| app | `app/` | `npm run lint` | `npm run typecheck` | `npx vitest run` | `npx playwright test --workers=1` |
| infra | `infra/environments/prd/` | `terraform fmt -check -recursive ../..` | `terraform validate` | n/a | n/a |
| deploy | `.github/workflows/` | `actionlint` | n/a | n/a | n/a |

`terraform validate` needs `terraform init -backend=false` first in a fresh worktree.

## Modules

Modules belong to the application and may span components.

| Module | Purpose | Components | Docs |
|---|---|---|---|
| app | Editor, diagram list, save and load, password auth | app | [README](modules/app/README.md) |
| infra | Every AWS resource the app runs on, and the deploy role | infra | [README](modules/infra/README.md) |
| deploy | Build and ship the app on every push to `main`; CI on PRs | deploy | [README](modules/deploy/README.md) |

## Environments and delivery

- Base branch `main`, trunk only. Every change arrives by pull request.
- One environment, `prd`: AWS account `975050033628`, region `us-east-1`, domain `napkin.sdfles.com` in the existing Route53 zone `sdfles.com`.
- Local development runs the app with `npm run dev` against the real table and bucket, with the `personal` AWS profile.
- Fixed cost target: $0 per month inside the AWS free tier; the hosted zone is already paid.

## Conventions

- Scenes never pass through the Lambda: the browser uploads and downloads them with presigned S3 URLs. Example: `modules/app/flows.md`.
- Terraform owns configuration, the workflow owns code: the Lambda ignores its code fields and the workflow only calls `update-function-code`. Example: `modules/infra/ard.md`.
- Secrets exist in exactly two places: the gitignored `terraform.tfvars` and the Lambda environment. Nothing else holds them, and `.claude/hooks/block-read.js` keeps agents out of the first.
- Resource names use the prefix `napkin-prd-`; buckets append the account id.
- Markdown docs put each sentence on its own line and never use the em dash.
