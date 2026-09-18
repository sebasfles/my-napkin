# Deploy

Where Terraform's job ends and the workflows' begins.

## The line

Terraform owns every resource and all of the server function's configuration: its runtime, memory, timeout and environment variables.
The workflows own exactly one thing, the function's code, and they change it with `update-function-code`, never with Terraform.

That is why the function resource ignores `filename`, `source_code_hash` and `publish`.
Without it, every code deploy would show as drift on the next `plan`, and the next `apply` would roll the deployed code back to the placeholder.

The workflows never hold an AWS key.
They assume the environment's deploy role over OIDC, and that role can do four things and nothing else: update the function's code, read it, sync the assets bucket, and invalidate the distribution.
Its trust policy is pinned to one branch of `sebasfles/my-napkin`, so a fork cannot assume it.

## What a deploy does

1. Build the app with OpenNext into one server bundle and a tree of static assets.
2. `aws lambda update-function-code` with the bundle.
3. `aws s3 sync` the assets into the assets bucket.
4. `aws cloudfront create-invalidation`.

Nothing in that list is Terraform's, and nothing Terraform creates is the workflow's.

## When Terraform has to run again

- A change to the runtime, memory, timeout or an environment variable of the function, including rotating `app_password`.
- A new path served from the assets bucket: the build output only carries `_next/static`, and CloudFront answers 403 for a static pattern the bucket does not hold, so a new `public/` file needs its pattern in `static_path_patterns`.
- Any new AWS resource the app starts using.

After an apply that replaces the function, the bucket or the distribution, the Actions variables of that environment are copied again from `terraform output`.

## The 50 MB ceiling

`update-function-code --zip-file` takes at most 50 MB zipped.
The day the bundle outgrows it, the workflow needs an artifacts bucket and `--s3-bucket`, and the role needs to write to it.
