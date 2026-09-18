# infra

Terraform for everything my-napkin runs on: one AWS account (`975050033628`), one region (`us-east-1`), two environments, and the rulesets of the GitHub repository.

It never deploys application code.
Terraform owns configuration, the workflows own code.

## Structure

```
environments/
  core/  Account-wide and repository-wide: the GitHub OIDC provider, the
         rulesets of develop and main, the monthly budget alert
  dev/   napkin.dev.sdfles.com, deployed from develop
  prd/   napkin.sdfles.com, deployed from main
stacks/
  app/   One environment's AWS side, wired from the leaf modules
modules/
  aws/     s3, dynamodb_table, lambda_function, cloudfront, acm
  github/  branch_ruleset
```

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

## Docs

- [setup.md](docs/setup.md): what exists before the first `init`, and what to do after the first `apply`.
- [deploy.md](docs/deploy.md): where Terraform's job ends and the workflows' begins.
