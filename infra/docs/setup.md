# Setup

What has to exist before the first `terraform init`, and what to do after the first `apply`.
Everything here is run by Sebastian from his machine with the `personal` AWS profile.

## 1. The state bucket, by hand

Terraform cannot create the bucket that holds its own state, so it is created once, outside Terraform.

```bash
export AWS_PROFILE=personal
B=napkin-terraform-state-975050033628

aws s3api create-bucket --bucket $B --region us-east-1
aws s3api put-bucket-versioning --bucket $B --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket $B \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'
aws s3api put-public-access-block --bucket $B \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

The name carries the account id because the plain one is already taken in another account.
Versioning is what makes a corrupted state recoverable, and it carries no lifecycle rule that expires noncurrent versions: if a `terraform.tfvars` is ever lost, an old state version is the only remaining copy of that secret.
The state holds the server function's environment, password included, in plain text, so it never leaves this bucket.

This bucket stays outside Terraform forever.
Terraform cannot hold the state of the bucket its own state lives in.

## 2. The GitHub App

All three roots talk to GitHub as the same GitHub App, because a personal access token would be a long-lived credential in a public repository's toolchain.
`core` manages the rulesets with it; `dev` and `prd` manage their Actions environment with it.

1. Create a private GitHub App owned by `sebasfles`, no webhook.
2. Repository permissions: Administration read and write (the rulesets, the Actions workflow permissions, the environments and their branch policies), Environments read and write, Secrets read and write (`APP_PASSWORD`), Variables read and write (the four deploy variables), Metadata read.
   This is the set the `dev` and `prd` applies of 0007 ran with; Administration and Metadata alone are enough for `core`'s rulesets but not for an Actions environment.
3. Install it on `sebasfles/my-napkin` only.
4. Generate a private key and keep the `.pem`.

The app id and the installation id are literals in the `locals.tf` of each root.
The key goes into every root's `terraform.tfvars` as `github_app_pem`, with the newlines written as `\n`.
Rotating it means editing three files; that is recorded as debt in `docs/modules/infra/ard.md`.

## 3. Apply, in order

`core` first: both deploy roles read the OIDC provider it creates.

```bash
cd environments/core
cp .env.example .env && source .env
cp terraform.tfvars.example terraform.tfvars   # github_app_pem, budget_notification_email
terraform init && terraform apply
```

Then `dev`, then `prd`, each the same way with its own `terraform.tfvars` (`github_app_pem`, `app_password`, `session_secret`).

The first apply of an environment takes several minutes: ACM waits on DNS validation, and CloudFront on its own deployment.
It creates the server function against a placeholder that answers `503 not deployed` until the first workflow run replaces the code.

## 4. What the apply writes into Actions

Nothing is copied by hand.
Applying `dev` or `prd` creates the Actions environment of the same name and fills it from that environment's own resources:

| Resource | Actions variable |
|---|---|
| `deploy_role_arn` | `AWS_ROLE_ARN` |
| `lambda_function_name` | `LAMBDA_FUNCTION_NAME` |
| `assets_bucket` | `ASSETS_BUCKET` |
| `cloudfront_distribution_id` | `CLOUDFRONT_DISTRIBUTION_ID` |

It also writes `app_password` as the environment's `APP_PASSWORD` secret, which is what the end-to-end suite logs in with on `dev`.
The environment admits jobs from its branch only, `develop` for `dev` and `main` for `prd`; that policy, and not the deploy role's trust policy, is what pins a deploy to its branch, because a job inside an environment presents the environment as its OIDC subject.
Each of the five lands with the id `my-napkin:{env}:{NAME}`.
The same `terraform.tfvars` therefore drives the login form, the server function's environment and the suite's password at once, and they cannot drift apart.
`prd` gets that secret too, for symmetry; nothing reads it, because no suite ever runs against prd.

An apply that replaces the function, the bucket or the distribution rewrites the matching variable in the same run.

## 5. Local development

`dev`'s table and bucket are what `npm run dev` runs against.

```bash
cd environments/dev && terraform output diagrams_table scenes_bucket
```

Those two values, plus `APP_PASSWORD`, `SESSION_SECRET` and `AWS_PROFILE=personal`, are the app's `.env.local`.
