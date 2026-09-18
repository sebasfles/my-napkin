---
updated: 2026-09-17
source: setup
---

# deploy: architecture decisions and debt

## 2026-09-17: authenticate to AWS with OIDC, not stored access keys

- Decision: `deploy.yml` assumes an IAM role through GitHub's OIDC provider via `role-to-assume`; no AWS access keys are stored as secrets.
- Alternatives rejected: long-lived AWS access keys stored as repository secrets.
- Reason: no static credential to leak from a public repo; the role's trust policy is scoped to `repo:sebasfles/my-napkin:ref:refs/heads/main`, so a fork cannot assume it and gets no OIDC token.
- Debt created: none.
- Revisit when: never, unless GitHub OIDC itself is deprecated.
- Source: setup

## 2026-09-17: repo is public

- Decision: `sebasfles/my-napkin` is a public GitHub repository.
- Alternatives rejected: private repo.
- Reason: public repos get unlimited GitHub Actions minutes, and fixed monthly cost is the stated priority ($0/month target).
- Debt created: none, offset by the OIDC trust policy scoping deploy access to pushes on `main` of the origin repo only.
- Revisit when: the project needs to keep source or history private.
- Source: setup

## 2026-09-17: deploy from GitHub Actions, apply Terraform by hand

- Decision: `deploy.yml` deploys code on every push to `main`; `terraform apply` is run manually by Sebastian, never from a workflow.
- Alternatives rejected: running `terraform apply` from CI/CD alongside or instead of the code deploy.
- Reason: single environment (`prd`); keeps infrastructure changes deliberate and separate from code deploys.
- Debt created: none.
- Revisit when: a second environment is added and infra changes need review before apply.
- Source: setup

## 2026-09-17: update Lambda code directly, not through Terraform

- Decision: `deploy.yml` zips the OpenNext server output and calls `aws lambda update-function-code` directly, instead of driving the code update through a Terraform resource.
- Alternatives rejected: making the Lambda's code a Terraform-managed attribute, deployed via `terraform apply`.
- Reason: Terraform owns configuration, the workflow owns code; the Lambda resource sets `ignore_changes` on its code fields (filename, source_code_hash) so an `apply` never rolls back the deployed code, and a code deploy never needs a Terraform change.
- Debt created: none.
- Revisit when: never expected under the single-Lambda design.
- Source: setup

## 2026-09-17: pass resource identifiers as Actions variables, not secrets

- Decision: the deploy role ARN, Lambda function name, assets bucket name and CloudFront distribution id are GitHub Actions variables, set by hand once from Terraform outputs after the first `apply`.
- Alternatives rejected: storing them as GitHub Actions secrets; hardcoding them in the workflow.
- Reason: none of these values are secret; Terraform is the source of truth for them and the workflow only reads them.
- Debt created: the values are set by hand once and must be updated by hand if Terraform ever recreates one of these resources with a new identifier.
- Revisit when: Terraform starts writing these outputs into the Actions environment automatically, as `auvral-infra` does.
- Source: setup
