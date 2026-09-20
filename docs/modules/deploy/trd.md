---
updated: 2026-09-19
source: 0009_deploy_dev_first_run
---

# deploy: technical

Every workflow of the layout exists.

## Structure

| Path | What |
|---|---|
| `.github/workflows/ci.yml` | Pull requests into `develop` and `main`, and pushes to `develop`. One job, `ci`. |
| `.github/dependabot.yml` | Weekly `github-actions` and `npm` updates, opened against `develop`. |
| `.github/workflows/deploy-dev.yml` | Push to `develop`: three jobs, `deploy`, `e2e-dev`, `promotion-pr`. |
| `.github/workflows/deploy-prd.yml` | Push to `main`: one job, `deploy`. |
| `.github/workflows/reusable-deploy.yml` | The deploy steps, called by both deploy workflows with the environment name. |

## Jobs owned

`ci.yml` (pull_request into `develop` and `main`, push to `develop`, runner `ubuntu-latest`, `timeout-minutes: 20`): `npm ci` in `app/`, then lint, typecheck and unit tests for `app`, the Terraform checks, and the workflow linter, in one job so the rulesets have a single check name to require.
It runs on pushes to `develop` as well as on pull requests because the promotion pull request is opened with `GITHUB_TOKEN`, which fires no `pull_request` event: without the push trigger the `ci` check the `main` ruleset requires would never land on that pull request's head commit.
Node comes from the root `.nvmrc` and the npm cache is keyed on `app/package-lock.json`.
The Terraform steps skip while `infra/` is absent and validate every directory under `infra/environments/` that holds any `.tf` file, which is what makes `core` a checked root even though its resources live in `oidc.tf`, `github.tf` and `budget.tf` rather than a `main.tf`.
`permissions: contents: read`, no secret, and `pull_request` rather than `pull_request_target`, so pull requests from forks of this public repo still run.
Concurrency is one group per pull request, and one group per commit on a push, with `cancel-in-progress`: a new commit supersedes the run in flight on its own pull request, and no push run ever cancels another commit's, since any commit on `develop` can become the promotion pull request's head.
Required check on both rulesets.

`ci` does not run e2e.
Specs run in the `e2e-dev` job of `deploy-dev.yml`, after every push to `develop`, against deployed dev; see `docs/conventions/e2e.md` for the policy.
The consequence is the shape of the gate: nothing in `ci` executes `app/src/` at runtime, so it proves the app lints, typechecks and passes its unit tests, and no more.
A change that compiles and breaks the editor reaches `develop` green, and `e2e-dev` against deployed dev is where a broken page is caught, before the promotion pull request can be merged.

`reusable-deploy.yml` (workflow_call, input `environment`, runner `ubuntu-latest`): checkout, `setup-node` 24, `npm ci` in `app/`, `npx open-next build` (`@opennextjs/aws`), `aws-actions/configure-aws-credentials` with the environment's `role-to-assume` over OIDC, zip `.open-next/server-functions/default` and `aws lambda update-function-code`, `aws lambda wait function-updated-v2`, `aws s3 sync .open-next/assets` to the assets bucket, `aws cloudfront create-invalidation`.
Estimated 3 to 5 minutes.
Its job carries `environment: ${{ inputs.environment }}`, which is what makes `vars.*` and the environment's secret resolve, and `id-token: write`, granted by the calling job.
That `environment:` is also what the deploy role trusts: a job that names an environment gets `repo:sebasfles/my-napkin:environment:{env}` as its OIDC subject, not the branch, and each role's trust policy matches exactly that, so a job without the environment gets no credentials.
The branch restriction lives on the environment itself: its deployment branch policy admits only `develop` for `dev` and `main` for `prd`, so a job on any other branch, or from a fork, fails before it starts and never holds a token the role would accept.
Four details of it are load bearing:

- The zip is built from inside `.open-next/server-functions/default`, so `index.mjs` sits at the zip root. A nested folder breaks the handler.
- The waiter is `function-updated-v2`, not `function-updated`. The plain waiter polls `GetFunctionConfiguration`, which the deploy role does not grant, so it would fail with AccessDenied instead of waiting.
- The assets sync is two passes: `_next/static/*` first with `public,max-age=31536000,immutable`, then everything except it with a short cache. `sync` skips what it has already uploaded, so a single pass would leave the wrong `cache-control` on one of the two sets.
- The sync never passes `--delete`. The role has no `s3:DeleteObject`, and the chunks of the previous build have to outlive a deploy for sessions already open.

`deploy-dev.yml` (push to `develop`): three jobs in a chain.
`deploy` calls `reusable-deploy.yml` with `dev`.
`e2e-dev` runs `npx playwright install --with-deps chromium` and `npx playwright test --workers=1` with `BASE_URL=https://napkin.dev.sdfles.com` and `APP_PASSWORD` from the `dev` environment secret.
`promotion-pr` opens `develop -> main` with `gh pr create` when no such pull request is open, with a body carrying the compare link and the subjects of the commits not yet in `main`; when one is open it does nothing, because its head is `develop` and it already carries them.
That job needs `fetch-depth: 0` and an explicit fetch of `main` to list those commits, and it is the only one granted `pull-requests: write`.
`GITHUB_TOKEN` can open the pull request only because the repository's Actions workflow permissions allow it, which `infra`'s `core` root sets; the default forbids it.
It runs under `if: ${{ !cancelled() }}`, so the pull request is opened whatever the suite's result and carries the red check rather than hiding the change.

The `e2e-dev` job is the required check of the `main` ruleset, which is why its job id is exactly `e2e-dev`.
It never uploads `playwright-report/` or a Playwright trace as an artifact: GitHub masks secrets in log output but not inside a trace, where the password typed into the login form is captured as an input value, and the repository is public.

`deploy-prd.yml` (push to `main`): calls `reusable-deploy.yml` with `prd`, and nothing else.
No e2e ever runs against prd; the proof for those commits is the `e2e-dev` run they already passed on `develop`.

Both callers declare concurrency at workflow level, one group per environment, with `cancel-in-progress: false`, so two deploys of the same environment never overlap.
GitHub still drops an older pending run when a newer one queues, so the run in flight is the one that is never cancelled, and the newest commit wins.

## Depends on

- `app`: builds `app/` with `open-next` and deploys its output.
- `infra`: reads, per environment, the Lambda function name, assets bucket, distribution id and deploy role ARN from the Actions variables Terraform writes.
- AWS OIDC provider and the two deploy IAM roles, created by `infra`.
- The branch rulesets, created by `infra`, which name `ci` and `e2e-dev` as required checks.
- The two Actions environments, created by `infra`, which hold every value the deploy reads and admit only their branch.
- The repository's Actions workflow permissions, set by `infra`'s `core` root, which let `GITHUB_TOKEN` open the promotion pull request.

## Depended on by

- None.

## Configuration

Two GitHub Actions environments, `dev` and `prd`, created by Terraform in `stacks/app` from the resources of that same environment, each with these variables (not secrets):

- `AWS_ROLE_ARN`: deploy role to assume over OIDC.
- `LAMBDA_FUNCTION_NAME`: server function updated by `update-function-code`.
- `ASSETS_BUCKET`: S3 bucket synced with `.open-next/assets`.
- `CLOUDFRONT_DISTRIBUTION_ID`: distribution invalidated after each deploy.

One secret per environment, `APP_PASSWORD`, from the same Terraform variable the server function is given.
The `e2e-dev` job reads the `dev` one to log in; the `prd` one is written for symmetry and nothing reads it. Fork pull requests never receive either.

Nothing here is copied by hand: `terraform apply` in `dev` or `prd` writes all four variables and the secret, so a resource Terraform recreates updates its own variable on the next apply.
The same apply sets the environment's deployment branch policy, `develop` for `dev` and `main` for `prd`, which is the one place the branch a deploy may run from is written.

`ci.yml` reads none of them: it needs no variable and no secret, which is what keeps it running on fork pull requests.

## Testing

- The workflow files are linted by `npm run lint:workflows` from `app/`, which runs the official `actionlint` binary through the `github-actionlint` devDependency.
  The linter walks up to the git root and lints `.github/workflows/`, so it is invoked with no arguments and from anywhere in the repo.
  It lives in `app/package.json` because npm is the only package manager here and `actionlint` is a Go binary with no npm-native equivalent; see [ard.md](ard.md).
- `ci.yml` itself is the test path for `app` and `infra`; `deploy` has no unit tests of its own.
- A change to `ci.yml` is only proven by a real `pull_request` run, so its own pull request is its test.
