# Replication: 0009 First run of deploy-dev.yml fails on OIDC and on the promotion pull request

## Preconditions

- `develop` at b95e8eb or later (0007 merged), Actions environments `dev` and `prd` applied.
- Deploy roles `napkin-dev-deploy` and `napkin-prd-deploy` as applied by 0003, trust policy from `infra/stacks/app/github_actions.tf`.

## Steps

1. Push any commit to `develop` (a merge is enough).
2. Open the `deploy-dev.yml` run for that commit in the Actions tab.

## Expected

`deploy`, `e2e-dev` and `promotion-pr` green; the commit live on `napkin.dev.sdfles.com`; a pull request `develop -> main` open or refreshed.

## Observed

- `deploy / deploy` fails at `aws-actions/configure-aws-credentials@v6`: `Could not assume role with OIDC: Not authorized to perform sts:AssumeRoleWithWebIdentity`, 12 retries.
- `e2e-dev` skipped.
- `promotion-pr` fails at `gh pr create`: `GraphQL: GitHub Actions is not permitted to create or approve pull requests (createPullRequest)`.

## Environment

- App version or commit: b95e8eb (merge of PR #8)
- Platform, browser or device: GitHub Actions, ubuntu-latest
- Environment: dev

## Evidence

- https://github.com/sebasfles/my-napkin/actions/runs/35474120357/job/105980282009
- `gh api repos/sebasfles/my-napkin/actions/permissions/workflow` returns `can_approve_pull_request_reviews: false`.
- `reusable-deploy.yml` line 15 sets `environment: ${{ inputs.environment }}`; the trust policy matches `token.actions.githubusercontent.com:sub` against `repo:.../...:ref:refs/heads/{{branch}}` only.

## om-developer confirmation

Confirmed 2026-09-19 on run 35474120357 through `gh run view`: `deploy / deploy` fails at `Run aws-actions/configure-aws-credentials@v6` with every later step skipped, and `promotion-pr` logs `pull request create failed: GraphQL: GitHub Actions is not permitted to create or approve pull requests (createPullRequest)`.
`gh api repos/sebasfles/my-napkin/actions/permissions/workflow` returns `can_approve_pull_request_reviews: false`, and `gh api repos/sebasfles/my-napkin/environments` returns `deployment_branch_policy: null` for both `dev` and `prd`.

## om-reviewer verification
