---
updated: 2026-09-17
source: setup
---

# Technical Requirements Document

Describes the whole application.
The app's shell is built; everything else is the design the code must converge to, and every task updates it as code lands.

## Components

| Component | Kind | Path | Base branch | Stack |
|---|---|---|---|---|
| app | app | `app/` | `develop` | Next.js (App Router), TypeScript, Tailwind + shadcn/ui, next-intl, @excalidraw/excalidraw, OpenNext |
| infra | app | `infra/` | `develop` | Terraform >= 1.10, AWS provider ~> 6, GitHub provider ~> 6 |
| deploy | app | `.github/workflows/` | `develop` | GitHub Actions |

### app

- Stack: TypeScript, Node 24, Next.js App Router with route handlers, Tailwind with shadcn/ui components, `next-themes` for dark mode, `next-intl` for `es` and `en`, `@excalidraw/excalidraw` from npm, npm as package manager, built with `@opennextjs/aws`.
- Layout: `src/app/` (pages and `api/` route handlers), `src/proxy.ts` (auth gate), `src/i18n/` (locale resolution and request config), `src/lib/` (theme and editor helpers, session and gate helpers, later dynamo and s3), `src/components/ui/` (shadcn), `src/messages/{es,en}.json`, `tests/` (Vitest unit, Playwright e2e; e2e always run against dev's real table and bucket, locally through `npm run dev` with `.env.local`).
- Install: `npm ci`
- Workspace files: `.env.local` with `APP_PASSWORD`, `SESSION_SECRET`, `DIAGRAMS_TABLE`, `SCENES_BUCKET`, `AWS_PROFILE=personal`.
- API spec: none; seven route handlers documented in `modules/app/trd.md`, the two auth ones built and the five diagram ones planned.
- Data: DynamoDB table for the diagram index, S3 bucket for scene JSON; no ORM, no migrations. Both provisioned by `infra`.
- Delivery: `dev` at `napkin.dev.sdfles.com` from `develop`, `prd` at `napkin.sdfles.com` from `main`. Built by OpenNext into one Lambda plus static assets, deployed by `deploy`.

### infra

- Stack: Terraform >= 1.10, `hashicorp/aws ~> 6`, `integrations/github ~> 6` authenticated as a GitHub App, state in S3 bucket `napkin-terraform-state` with `use_lockfile`, one key per root.
- Layout: `environments/core/` (GitHub OIDC provider, branch rulesets), `environments/dev/` and `environments/prd/` (one AWS environment each, calling `stacks/app`), `modules/aws/` and `modules/github/` (leaf modules), `docs/` (setup and deploy notes).
- Install: `terraform init` in the root's directory after `source .env`.
- Workspace files: per root, `.env` (`AWS_PROFILE=personal`) and `terraform.tfvars` (`app_password` and `session_secret` in dev and prd; `github_app_pem` in core), both gitignored, both with a committed `.example`.
- API spec: none.
- Data: none of its own.
- Delivery: `terraform apply` run by Sebastian from his machine, never from CI.

### deploy

- Stack: GitHub Actions, `aws-actions/configure-aws-credentials` over OIDC, AWS CLI.
- Layout: `ci.yml` (pull requests: lint, typecheck, unit, Terraform, actionlint; no e2e, no secrets), `deploy-dev.yml` (push to `develop`, then opens the promotion PR), `e2e-dev.yml` (PRs into `main`, the only place e2e runs in CI, against the deployed dev), `deploy-prd.yml` (push to `main`).
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
| infra-core | `infra/environments/core/` | `terraform fmt -check -recursive ../..` | `terraform validate` | n/a | n/a |
| infra-dev | `infra/environments/dev/` | n/a | `terraform validate` | n/a | n/a |
| infra-prd | `infra/environments/prd/` | n/a | `terraform validate` | n/a | n/a |
| deploy | `app/` | `npm run lint:workflows` | n/a | n/a | n/a |

`terraform validate` needs `terraform init -backend=false` first, in each of the three roots.
The `fmt` check runs once, from `infra/`, and covers every root and module.

## Modules

Modules belong to the application and may span components.

| Module | Purpose | Components | Docs |
|---|---|---|---|
| app | Editor, diagram list, save and load, password auth | app | [README](modules/app/README.md) |
| infra | Every AWS resource the app runs on, and the deploy role | infra | [README](modules/infra/README.md) |
| deploy | Build and ship the app on every push to `main`; CI on PRs | deploy | [README](modules/deploy/README.md) |

## Environments and delivery

- Base branch `develop`; `main` is production. Every change arrives by pull request into `develop`; merging to `develop` deploys dev and opens the promotion PR `develop -> main`, which runs the full Playwright suite against dev before Sebastian merges it with a merge commit.
- Both branches carry a ruleset: no deletion, no force push, PR required, required checks, zero required approvals, bypass for the repository admin.
- `dev`: `napkin.dev.sdfles.com`, `prd`: `napkin.sdfles.com`; same AWS account `975050033628`, region `us-east-1`, existing Route53 zone `sdfles.com`, `base_domain` per environment and hostname `napkin.{base_domain}`.
- Local development runs the app with `npm run dev` against the real table and bucket, with the `personal` AWS profile.
- Fixed cost target: $0 per month inside the AWS free tier; the hosted zone is already paid.

## Conventions

- Scenes never pass through the Lambda: the browser uploads and downloads them with presigned S3 URLs. Example: `modules/app/flows.md`.
- Terraform owns configuration, the workflow owns code: the Lambda ignores its code fields and the workflow only calls `update-function-code`. Example: `modules/infra/ard.md`.
- Secrets exist in exactly two places: the gitignored `terraform.tfvars` and the Lambda environment. Nothing else holds them, and `.claude/hooks/block-read.js` keeps agents out of the first.
- Resource names use the prefix `napkin-{env}-`; buckets append the account id.
- UI colors come only from the theme tokens (CSS variables of the shadcn theme); no raw colors or Tailwind palette classes, so dark mode is always covered. Enforced by `docs/checks/styles.md`.
- Every user-facing string goes through `next-intl` and exists in `es` and `en`. Enforced by `docs/checks/i18n.md`.
- A PR that changes a user flow adds or updates a Playwright test, or says why not. E2E is always real against dev and runs in CI only on the promotion PR. Enforced by `docs/checks/e2e-worth.md`.
- Markdown docs put each sentence on its own line and never use the em dash.
