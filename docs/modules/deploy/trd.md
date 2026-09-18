---
updated: 2026-09-17
source: setup
---

# deploy: technical

Planned layout, no code exists yet.

## Structure

| Path | What |
|---|---|
| `.github/workflows/ci.yml` | Planned. Runs on pull requests. |
| `.github/workflows/deploy.yml` | Planned. Runs on push to `main`. |

## Jobs owned

`ci.yml` (pull_request): `npm ci` in `app/`, lint, typecheck, unit tests, Playwright e2e, `terraform fmt -check` and `terraform validate` in `infra/environments/prd` with no backend.

`deploy.yml` (push to `main`, runner `ubuntu-latest`): checkout, `setup-node` 22, `npm ci` in `app/`, `npx open-next build` (`@opennextjs/aws`), `aws-actions/configure-aws-credentials` with `role-to-assume` over OIDC, zip `.open-next/server-functions/default` and `aws lambda update-function-code`, `aws s3 sync .open-next/assets` to the assets bucket (`/_next/static/*` with `cache-control: public,max-age=31536000,immutable`, the rest short cache), `aws cloudfront create-invalidation`.
Estimated 3 to 5 minutes.

## Depends on

- `app`: builds `app/` with `open-next` and deploys its output.
- `infra`: reads the Lambda function name, assets bucket, distribution id and deploy role ARN from Terraform outputs.
- AWS OIDC provider and deploy IAM role, created by `infra`.

## Depended on by

- None.

## Configuration

GitHub Actions variables (not secrets), set by hand once after the first `terraform apply`:

- `AWS_ROLE_ARN`: deploy role to assume over OIDC.
- `LAMBDA_FUNCTION_NAME`: server function updated by `update-function-code`.
- `ASSETS_BUCKET`: S3 bucket synced with `.open-next/assets`.
- `CLOUDFRONT_DISTRIBUTION_ID`: distribution invalidated after each deploy.

## Testing

- `actionlint` on the workflow files.
- `ci.yml` itself is the test path for `app` and `infra`; `deploy` has no unit tests of its own.
