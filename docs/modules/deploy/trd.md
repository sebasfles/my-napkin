---
updated: 2026-09-17
source: setup
---

# deploy: technical

Planned layout, no code exists yet.

## Structure

| Path | What |
|---|---|
| `.github/workflows/ci.yml` | Planned. Pull requests into `develop` and `main`. |
| `.github/workflows/deploy-dev.yml` | Planned. Push to `develop`: deploy dev, then open or reuse the promotion PR. |
| `.github/workflows/e2e-dev.yml` | Planned. Pull requests into `main` from this repository: Playwright against dev. |
| `.github/workflows/deploy-prd.yml` | Planned. Push to `main`: deploy prd. |
| `.github/workflows/reusable-deploy.yml` | Planned. The deploy steps, called by both deploy workflows with the environment name. |

## Jobs owned

`ci.yml` (pull_request): `npm ci` in `app/`, lint, typecheck, unit tests, Playwright e2e without the `@aws` tag, `terraform fmt -check -recursive` and `terraform validate` per root with no backend, `actionlint`.
Required check on both rulesets.

`reusable-deploy.yml` (workflow_call, input `environment`, runner `ubuntu-latest`): checkout, `setup-node` 24, `npm ci` in `app/`, `npx open-next build` (`@opennextjs/aws`), `aws-actions/configure-aws-credentials` with the environment's `role-to-assume` over OIDC, zip `.open-next/server-functions/default` and `aws lambda update-function-code`, `aws s3 sync .open-next/assets` to the assets bucket (`/_next/static/*` with `cache-control: public,max-age=31536000,immutable`, the rest short cache), `aws cloudfront create-invalidation`.
Estimated 3 to 5 minutes.

`deploy-dev.yml` (push to `develop`): calls `reusable-deploy.yml` with `dev`, then `gh pr list`/`gh pr create` for `develop -> main` if none is open, as in `local-auctions-backend/.github/workflows/reusable-create-pr.yml`.

`e2e-dev.yml` (pull_request into `main`, only when the head repository is `sebasfles/my-napkin`): `npx playwright install --with-deps chromium`, `npx playwright test --workers=1` with `BASE_URL=https://napkin.dev.sdfles.com` and `APP_PASSWORD` from the `dev` environment secret.
Required check on the `main` ruleset.

`deploy-prd.yml` (push to `main`): calls `reusable-deploy.yml` with `prd`.

## Depends on

- `app`: builds `app/` with `open-next` and deploys its output.
- `infra`: reads, per environment, the Lambda function name, assets bucket, distribution id and deploy role ARN from Terraform outputs.
- AWS OIDC provider and the two deploy IAM roles, created by `infra`.
- The branch rulesets, created by `infra`, which name `ci` and `e2e-dev` as required checks.

## Depended on by

- None.

## Configuration

Two GitHub Actions environments, `dev` and `prd`, each with these variables (not secrets), set by hand once after that environment's first `terraform apply`:

- `AWS_ROLE_ARN`: deploy role to assume over OIDC.
- `LAMBDA_FUNCTION_NAME`: server function updated by `update-function-code`.
- `ASSETS_BUCKET`: S3 bucket synced with `.open-next/assets`.
- `CLOUDFRONT_DISTRIBUTION_ID`: distribution invalidated after each deploy.

One secret, in the `dev` environment: `APP_PASSWORD`, used by `e2e-dev.yml` to log in. Fork pull requests never receive it.

## Testing

- `actionlint` on the workflow files.
- `ci.yml` itself is the test path for `app` and `infra`; `deploy` has no unit tests of its own.
