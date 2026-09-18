---
updated: 2026-09-18
source: 0002_ci_workflow
---

# deploy: technical

`ci.yml` and `dependabot.yml` exist; the rest of the layout is planned.

## Structure

| Path | What |
|---|---|
| `.github/workflows/ci.yml` | Pull requests into `develop` and `main`. One job, `ci`. |
| `.github/dependabot.yml` | Weekly `github-actions` and `npm` updates, opened against `develop`. |
| `.github/workflows/deploy-dev.yml` | Planned. Push to `develop`: deploy dev, then open or reuse the promotion PR. |
| `.github/workflows/e2e-dev.yml` | Planned. Pull requests into `main` from this repository: Playwright against dev. |
| `.github/workflows/deploy-prd.yml` | Planned. Push to `main`: deploy prd. |
| `.github/workflows/reusable-deploy.yml` | Planned. The deploy steps, called by both deploy workflows with the environment name. |

## Jobs owned

`ci.yml` (pull_request into `develop` and `main`, runner `ubuntu-latest`, `timeout-minutes: 20`): `npm ci` in `app/`, then lint, typecheck and unit tests for `app`, the Terraform checks, and the workflow linter, in one job so the rulesets have a single check name to require.
Node comes from the root `.nvmrc` and the npm cache is keyed on `app/package-lock.json`.
The Terraform steps skip while `infra/` is absent and validate every directory under `infra/environments/` that holds a `main.tf`, so the Terraform task inherits a working check instead of writing one.
`permissions: contents: read`, no secret, and `pull_request` rather than `pull_request_target`, so pull requests from forks of this public repo still run.
Concurrency is one group per pull request with `cancel-in-progress`, so a push supersedes the run in flight.
Required check on both rulesets.

`ci` does not run e2e.
Specs run in `e2e-dev.yml`, on pull requests into `main`, against deployed dev; see `docs/conventions/e2e.md` for the policy.
The consequence is the shape of the gate: nothing in `ci` executes `app/src/` at runtime, so it proves the app lints, typechecks and passes its unit tests, and no more.
A change that compiles and breaks the editor reaches `develop` green, and the promotion pull request into `main` is where a broken page is caught.

`reusable-deploy.yml` (workflow_call, input `environment`, runner `ubuntu-latest`): checkout, `setup-node` 24, `npm ci` in `app/`, `npx open-next build` (`@opennextjs/aws`), `aws-actions/configure-aws-credentials` with the environment's `role-to-assume` over OIDC, zip `.open-next/server-functions/default` and `aws lambda update-function-code`, `aws s3 sync .open-next/assets` to the assets bucket (`/_next/static/*` with `cache-control: public,max-age=31536000,immutable`, the rest short cache), `aws cloudfront create-invalidation`.
Estimated 3 to 5 minutes.

`deploy-dev.yml` (push to `develop`): calls `reusable-deploy.yml` with `dev`, then `gh pr list`/`gh pr create` for `develop -> main` if none is open, as in `local-auctions-backend/.github/workflows/reusable-create-pr.yml`.

`e2e-dev.yml` (pull_request into `main`, only when the head repository is `sebasfles/my-napkin`): `npx playwright install --with-deps chromium`, `npx playwright test --workers=1` with `BASE_URL=https://napkin.dev.sdfles.com` and `APP_PASSWORD` from the `dev` environment secret.
Required check on the `main` ruleset.
This workflow never uploads `playwright-report/` or a Playwright trace as an artifact: GitHub masks secrets in log output but not inside a trace, where the password typed into the login form is captured as an input value, and the repository is public.

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

`ci.yml` reads none of them: it needs no variable and no secret, which is what keeps it running on fork pull requests.

## Testing

- The workflow files are linted by `npm run lint:workflows` from `app/`, which runs the official `actionlint` binary through the `github-actionlint` devDependency.
  The linter walks up to the git root and lints `.github/workflows/`, so it is invoked with no arguments and from anywhere in the repo.
  It lives in `app/package.json` because npm is the only package manager here and `actionlint` is a Go binary with no npm-native equivalent; see [ard.md](ard.md).
- `ci.yml` itself is the test path for `app` and `infra`; `deploy` has no unit tests of its own.
- A change to `ci.yml` is only proven by a real `pull_request` run, so its own pull request is its test.
