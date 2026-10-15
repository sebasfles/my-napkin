---
updated: 2026-10-14
source: 0029_old_account_teardown
---

# deploy: flows

## Promotion

Runs on every merge into `develop`.

A `decide` job first marks the push docs-only when every changed path is a Markdown file or sits under a `docs/` directory at any depth and the previous commit's `deploy-dev` run succeeded; then `deploy` and `e2e-dev` are skipped and `promotion-pr` still runs.
Otherwise the three jobs of `deploy-dev.yml` run in order on the same commit, and `ci.yml` runs on that same push.
Both checks land on the commit `develop` points at, which is the promotion pull request's head, which is what the `main` ruleset reads.

```mermaid
sequenceDiagram
  participant S as Sebastian
  participant GH as GitHub Actions
  participant DEV as dev.napkin.fless.dev
  participant PR as PR develop -> main

  S->>GH: merge PR into develop
  GH->>GH: ci.yml on the push
  GH->>DEV: deploy-dev / deploy (dev)
  GH->>DEV: deploy-dev / e2e-dev, full suite, logged in
  GH->>PR: deploy-dev / promotion-pr, gh pr create if none open
  GH-->>PR: ci and e2e-dev green or red on its head
  S->>PR: merge commit
  PR->>GH: deploy-prd.yml
```

## Deploy pipeline

`reusable-deploy.yml`, called with `dev` on push to `develop` and with `prd` on push to `main`.

```mermaid
sequenceDiagram
  participant S as Sebastian
  participant GH as GitHub Actions
  participant AWS as AWS STS (OIDC)
  participant L as Lambda
  participant A as S3 assets bucket
  participant CF as CloudFront

  S->>GH: push to develop or main
  GH->>GH: checkout, setup-node 24, npm ci in app/
  GH->>GH: npx open-next build
  GH->>AWS: configure-aws-credentials (role-to-assume over OIDC)
  AWS-->>GH: temporary credentials
  GH->>L: zip server-functions/default, update-function-code, wait
  GH->>A: s3 sync .open-next/assets (immutable cache for /_next/static/*)
  GH->>CF: create-invalidation
  CF-->>S: change live at the environment's hostname
```
