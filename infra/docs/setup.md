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

`core` manages the rulesets as a GitHub App, because a personal access token would be a long-lived credential in a public repository's toolchain.

1. Create a private GitHub App owned by `sebasfles`, no webhook.
2. Repository permissions: Administration read and write, Metadata read.
3. Install it on `sebasfles/my-napkin` only.
4. Generate a private key and keep the `.pem`.

The app id and the installation id are literals in `environments/core/locals.tf`.
The key goes into `environments/core/terraform.tfvars` as `github_app_pem`, with the newlines written as `\n`.

## 3. Apply, in order

`core` first: both deploy roles read the OIDC provider it creates.

```bash
cd environments/core
cp .env.example .env && source .env
cp terraform.tfvars.example terraform.tfvars   # github_app_pem, budget_notification_email
terraform init && terraform apply
```

Then `dev`, then `prd`, each the same way with its own `terraform.tfvars` (`app_password`, `session_secret`).

The first apply of an environment takes several minutes: ACM waits on DNS validation, and CloudFront on its own deployment.
It creates the server function against a placeholder that answers `503 not deployed` until the first workflow run replaces the code.

`app_password` of `dev` has to match the `APP_PASSWORD` secret of the repository's `dev` Actions environment, which is what the end-to-end suite logs in with.

## 4. What to copy into Actions, once

Each environment's outputs feed the Actions environment of the same name (`dev`, `prd`), as variables, not secrets.

| Output | Actions variable |
|---|---|
| `deploy_role_arn` | `AWS_ROLE_ARN` |
| `lambda_function_name` | `LAMBDA_FUNCTION_NAME` |
| `assets_bucket` | `ASSETS_BUCKET` |
| `cloudfront_distribution_id` | `CLOUDFRONT_DISTRIBUTION_ID` |

```bash
terraform output
```

Set them again if Terraform ever replaces one of those resources.

## 5. Local development

`dev`'s table and bucket are what `npm run dev` runs against.

```bash
cd environments/dev && terraform output diagrams_table scenes_bucket
```

Those two values, plus `APP_PASSWORD`, `SESSION_SECRET` and `AWS_PROFILE=personal`, are the app's `.env.local`.
