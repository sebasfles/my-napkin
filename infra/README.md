# infra

Terraform for everything my-napkin runs on: the project's own AWS account (`372303522225`), one region (`us-east-1`), two environments, and the rulesets of the GitHub repository.

It never deploys application code.
Terraform owns configuration, including the Actions variables and secret each deploy reads; the workflows own code.

## Structure

```
environments/
  core/  Account-wide and repository-wide: the GitHub OIDC provider, the
         rulesets of develop and main, the Actions workflow permissions
  dev/   dev.napkin.fless.dev, deployed from develop
  prd/   napkin.fless.dev, deployed from main
scripts/
  copy-data.sh  Copies and compares a table and a scenes bucket across accounts
stacks/
  app/   One environment's AWS side and its GitHub Actions environment,
         wired from the leaf modules
modules/
  aws/     s3, dynamodb_table, lambda_function, cloudfront, acm
  github/  branch_ruleset, actions_environment
```

All three roots talk to GitHub as the same GitHub App, so each carries a `github_app_pem` in its `terraform.tfvars`.

`dev` and `prd` differ only in `locals.tf`.
Anything that is the same in both lives in `stacks/app`.

## Quick start

```bash
cd environments/dev
cp .env.example .env && source .env
cp terraform.tfvars.example terraform.tfvars   # fill in the values
terraform init
terraform plan
```

Apply order on a fresh account is `core`, then `dev`, then `prd`: both environments read the OIDC provider `core` creates.
Every provider and backend carries `allowed_account_ids`, so a shell on any other profile fails before it plans.

## Docs

- [setup.md](docs/setup.md): what exists before the first `init`, and what to do after the first `apply`.
- [deploy.md](docs/deploy.md): where Terraform's job ends and the workflows' begins.
