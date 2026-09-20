# Deploy

Where Terraform's job ends and the workflows' begins.

## The line

Terraform owns every resource and all of the server function's configuration: its runtime, memory, timeout and environment variables.
It also owns the two GitHub Actions environments, so the four values a deploy needs are written from the resources they name instead of copied by hand.
The workflows own exactly one thing, the function's code, and they change it with `update-function-code`, never with Terraform.

That is why the function resource ignores `filename`, `source_code_hash` and `publish`.
Without it, every code deploy would show as drift on the next `plan`, and the next `apply` would roll the deployed code back to the placeholder.

The workflows never hold an AWS key.
They assume the environment's deploy role over OIDC, and that role can do four things and nothing else: update the function's code, read it, sync the assets bucket, and invalidate the distribution.
Its trust policy is pinned to the Actions environment the deploy job runs in, and that environment admits only its branch of `sebasfles/my-napkin`, so a job on any other branch, or from a fork, cannot assume it.

## What a deploy does

1. Build the app with OpenNext into one server bundle and a tree of static assets.
2. `aws lambda update-function-code` with the bundle, then `aws lambda wait function-updated-v2`.
3. `aws s3 sync` the assets into the assets bucket, twice: `_next/static/*` immutable for a year, then the rest short cached.
4. `aws cloudfront create-invalidation`.

Nothing in that list is Terraform's, and nothing Terraform creates is the workflow's.

The waiter is the `-v2` one on purpose: the plain `function-updated` polls `GetFunctionConfiguration`, which the deploy role does not grant.
The sync never passes `--delete`, for the same reason and one more: the role has no `s3:DeleteObject`, and the previous build's chunks have to outlive a deploy for sessions already open.

## When Terraform has to run again

- A change to the runtime, memory, timeout or an environment variable of the function, including rotating `app_password`, which is also the environment's `APP_PASSWORD` secret.
- A new path served from the assets bucket: the build output carries only `_next/static` and a `BUILD_ID`, and CloudFront answers 403 for a static pattern the bucket does not hold, so a new `public/` file needs its pattern in `static_path_patterns`.
- Any new AWS resource the app starts using.

An apply that replaces the function, the bucket or the distribution rewrites that environment's Actions variables in the same run, because `stacks/app` builds them from those resources.
Nothing is copied from `terraform output` by hand.

That is why `dev` and `prd` configure the `github` provider with the same GitHub App as `core`, and why the App's key is a `github_app_pem` variable of all three roots.

## The 50 MB ceiling

`update-function-code --zip-file` takes at most 50 MB zipped.
The bundle is 4.6 MB today, measured on the 0007 build of `develop`, and the deploy logs its size on every run.
The day it outgrows the cap, the workflow needs an artifacts bucket and `--s3-bucket`, and the role needs to write to it.
