---
updated: 2026-09-17
source: setup
---

# Architecture and Debt Record

Global decisions, as a dated log, and the index of debt across modules.
Module-level decisions live in `modules/{{module}}/ard.md`.

## Decisions

## 2026-09-17: Embed the Excalidraw npm package in a Next.js app instead of forking excalidraw.com

- Decision: the app depends on `@excalidraw/excalidraw` and owns only the shell around it (list, persistence, auth).
- Alternatives rejected: forking the excalidraw repo and hosting it; self-hosting the excalidraw.com Docker image.
- Reason: the package is the same editor; upgrading is bumping a version; the MIT license only requires keeping the LICENSE.
- Debt created: none.
- Revisit when: a feature needs to change the editor itself rather than what surrounds it.
- Source: setup

## 2026-09-17: Serverless hosting on Lambda + S3 + CloudFront through OpenNext

- Decision: the Next.js build is adapted by OpenNext into one server Lambda plus static assets on S3, fronted by CloudFront on the user's domain.
- Alternatives rejected: Fargate + ALB (about $37 per month for the load balancer alone); Vercel (would leave AWS).
- Reason: $0 fixed cost inside the free tier for one user; every piece is pay per request.
- Debt created: cold starts of 1 to 2 seconds after inactivity, accepted.
- Revisit when: cold starts become annoying enough to pay for provisioned concurrency, or Excalidraw stops fitting in a Lambda bundle.
- Source: setup

## 2026-09-17: Diagram index in DynamoDB, scene bodies in S3, uploaded with presigned URLs

- Decision: DynamoDB holds `id`, `name`, timestamps; S3 holds the full scene JSON at `scenes/{id}.json`; the browser reads and writes scenes directly against S3 with presigned URLs and the Lambda only signs and updates the index.
- Alternatives rejected: RDS (24/7 instance for one table); SQLite (ephemeral disk on Lambda); DynamoDB alone (400 KB item limit, and images travel base64 inside the scene); uploading through the API (6 MB Lambda request limit).
- Reason: scenes with pasted images exceed both limits routinely; the split keeps every request small and every store free tier.
- Debt created: the browser needs the bucket's CORS to match the app domain, a second place where the domain is configured.
- Revisit when: a second user or shared links appear; the index would then need a partition per user.
- Source: setup

## 2026-09-17: Single password with a signed cookie instead of Cognito

- Decision: one `APP_PASSWORD` compared in a route handler, an httpOnly HMAC-signed cookie valid 30 days, and a middleware inside the server Lambda that rejects everything except the login routes.
- Alternatives rejected: Cognito (needs an ALB or the Hosted UI integration); basic auth at CloudFront (a CloudFront Function per request, and no logout).
- Reason: one user does not justify an identity provider; the cookie costs nothing and lives entirely in the app.
- Debt created: rotating the password is a Terraform apply, not a UI action.
- Revisit when: a second user is needed.
- Source: setup

## 2026-09-17: Terraform for infrastructure, GitHub Actions with OIDC for code, applied and deployed separately

- Decision: Terraform creates every resource and is applied by hand from Sebastian's machine with the `personal` profile; the deploy workflow assumes an IAM role by OIDC on pushes to `main` and only updates the Lambda code, syncs assets and invalidates CloudFront. State lives in an S3 bucket created by hand, never in the repo.
- Alternatives rejected: applying Terraform from Actions (the state carries the Lambda environment, including the password, in plain text); long-lived access keys as repository secrets; CDK or Serverless Framework.
- Reason: the repo is public; nothing that can leak may be committed or granted to a workflow, and the trust policy limits the role to `main` of this repo so forks cannot assume it.
- Debt created: after the first apply, four Actions variables (role ARN, function name, assets bucket, distribution id) are copied by hand from Terraform outputs.
- Revisit when: the GitHub provider is worth adding to Terraform just to push those four variables.
- Source: setup

## Debt index

Open debt only: an entry with `Resolved by` leaves the table.
Rebuilt by `write-ard` on every run, kept current by `document-task` on every task.

| Module | Date | Debt | Revisit when |
|---|---|---|---|
| general | 2026-09-17 | Bucket CORS duplicates the app domain | A second user or shared links appear |
| general | 2026-09-17 | Password rotation is a Terraform apply | A second user is needed |
| general | 2026-09-17 | Four Actions variables set by hand after the first apply | GitHub provider added to Terraform |
| app | 2026-09-17 | No per-user accounts, no password rotation or recovery flow | A second user is needed |
| infra | 2026-09-17 | Cold start of 1 to 2 seconds after inactivity | Latency no longer fits a single user |
| infra | 2026-09-17 | State bucket created by hand before the first init | Never, standard pattern |
| infra | 2026-09-17 | First apply runs a placeholder zip until the first deploy | Never, standard pattern |
| deploy | 2026-09-17 | Actions variables updated by hand if Terraform recreates a resource | Terraform writes them into Actions |
