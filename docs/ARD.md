---
updated: 2026-09-20
source: 0011_workspace_redesign
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

- Decision: Terraform creates every resource and is applied by hand from Sebastian's machine with the `personal` profile; the deploy workflow assumes an IAM role by OIDC on pushes to `develop` and `main` and only updates the Lambda code, syncs assets and invalidates CloudFront. State lives in an S3 bucket created by hand, never in the repo.
- Alternatives rejected: applying Terraform from Actions (the state carries the Lambda environment, including the password, in plain text); long-lived access keys as repository secrets; CDK or Serverless Framework.
- Reason: the repo is public; nothing that can leak may be committed or granted to a workflow, and each deploy role trusts only the Actions environment of its name, which admits only its branch of this repo, so forks cannot assume it.
- Debt created: after the first apply, four Actions variables (role ARN, function name, assets bucket, distribution id) were copied by hand from Terraform outputs.
- Resolved by: 0007_deploy_workflows, which gives `dev` and `prd` the same GitHub App as `core` and writes those four variables, and the `APP_PASSWORD` secret, from the resources they name.
- Revisit when: never. The split between the two tools stands; what changed is that the values now cross it as Terraform's own output instead of by hand.
- Source: setup

## 2026-09-17: Two environments, branch per environment, automatic promotion PR with e2e against dev

- Decision: `develop` deploys `dev` (`napkin.dev.sdfles.com`) and `main` deploys `prd`. Merging to `develop` opens or updates the PR `develop -> main`; that PR runs Playwright against dev and is merged by Sebastian with a merge commit. Both branches carry a ruleset (no deletion, no force push, PR required, required checks, zero approvals, admin bypass) managed by Terraform through a GitHub App.
- Alternatives rejected: trunk only with one environment (a broken change is seen by Sebastian in production); required approvals (one human cannot approve his own PR); rulesets by hand (undeclared, drifts).
- Reason: Sebastian wants to see a change break before it reaches production without validating it himself; the public repo makes Actions minutes free and Playwright runs on `ubuntu-latest`; the second AWS environment stays inside the free tier.
- Debt created: two of everything in AWS and two deploy roles; the dev password lives as a repository secret for the e2e job.
- Revisit when: the free tier is exceeded, or a staging step is needed between dev and prd.
- Source: setup

## 2026-09-17: shadcn/ui on Tailwind with token-only colors, dark mode from day one

- Decision: components come from shadcn/ui; every color is a CSS variable of the theme; light and dark follow the system through `next-themes`; the Excalidraw `theme` prop follows the app.
- Alternatives rejected: plain CSS modules (no shared tokens, dark mode retrofitted later); a full component library (heavier than a sidebar and a canvas need).
- Reason: the palette check can verify token-only styling mechanically, which keeps dark mode correct in every PR.
- Debt created: none.
- Revisit when: a design system with its own tokens replaces the shadcn defaults.
- Source: setup

## 2026-09-17: i18n with next-intl, es and en, from the first screen

- Decision: every user-facing string is a `next-intl` key present in `es` and `en`; the locale follows the browser and can be switched in the sidebar; `en` is the fallback.
- Alternatives rejected: Spanish only (cheap now, a full retrofit later); `react-i18next` (not integrated with the App Router).
- Reason: adding i18n to a small app costs nothing; adding it to a grown one costs every string.
- Debt created: none.
- Revisit when: never expected.
- Source: setup

## Debt index

Open debt only: an entry with `Resolved by` leaves the table.
Rebuilt by `write-ard` on every run, kept current by `document-task` on every task.

| Module | Date | Debt | Revisit when |
|---|---|---|---|
| general | 2026-09-17 | Bucket CORS duplicates the app domain | A second user or shared links appear |
| general | 2026-09-17 | Password rotation is a Terraform apply | A second user is needed |
| app | 2026-09-17 | No per-user accounts, no password rotation or recovery flow | A second user is needed |
| infra | 2026-09-17 | Cold start of 1 to 2 seconds after inactivity | Latency no longer fits a single user |
| infra | 2026-09-17 | State bucket created by hand before the first init | Never, standard pattern |
| infra | 2026-09-17 | First apply runs a placeholder zip until the first deploy | Never, standard pattern |
| app | 2026-09-17 | `allowScripts` is pinned per version, so a bump re-blocks that install script | A dependency bump fails for a missing binary |
| app | 2026-09-17 | 9 transitive npm advisories under the editor package, unresolvable here | The editor bumps its mermaid chain |
| app | 2026-09-17 | `components.json` pins the shadcn preset, so a component added with different CLI flags will not match the tree | A component is added with different CLI flags |
| general | 2026-09-17 | Two of everything in AWS, dev password as a repository secret | Free tier exceeded or staging needed |
| deploy | 2026-09-17 | `adm-zip` advisories under the workflow linter, no fix in its range | `github-actionlint` widens its `adm-zip` range |
| app | 2026-09-18 | The expired-cookie path is proved by unit tests only, since a spec against a deployed environment cannot forge one | The e2e run against dev needs to mint a cookie |
| app | 2026-09-18 | The theme control's selected colour is set at the call site, not in the generated variant | A second `ToggleGroup` is added |
| infra | 2026-09-18 | The bundle ships inline with `update-function-code --zip-file`, which AWS caps at 50 MB zipped | The OpenNext bundle approaches 50 MB |
| app | 2026-09-18 | A PUT already on the wire when a delete lands can orphan a scene object | Orphans show up, or a lifecycle rule is wanted |
| app | 2026-09-18 | The first paint of the diagram list waits for a round trip | The skeleton lasts long enough to be worth server rendering |
| app | 2026-09-18 | A stored scene keeps the shape it was written in, normalized only on read | An editor upgrade needs saved scenes migrated |
| app | 2026-09-18 | `sceneVersion` copies four lines the editor package owns | The package exports it from a server safe module |
| app | 2026-09-19 | A third-party webhook cannot POST through the OAC-protected Function URL, since only this app's own browser code can compute the payload hash | A third party needs to POST to the app (webhooks) |
| infra | 2026-09-19 | Rotating the GitHub App key edits the `terraform.tfvars` of three roots | A secret manager holds the key for every root |
| deploy | 2026-09-19 | `e2e-dev` runs on every push to `develop`, so a flaky spec blocks promotion | The suite is long or flaky enough to be worth gating differently |
| app | 2026-09-19 | The twin assertion at `diagram-list.spec.ts:97` keeps the 15s default, so a change in run order moves the flake rather than removing it | The suite stops running serially in file order |
| app | 2026-09-20 | A presigned PUT handed out before a lock stays valid for the rest of its five minutes, so a tab holding one can still overwrite a locked diagram's scene object | That window matters enough for a shorter expiry or a bucket policy that reads the lock |
| app | 2026-09-20 | A folder delete that fails partway leaves the folder half emptied and can orphan scene objects | A cascade is seen to fail partway, or the bucket wants a lifecycle rule |
| app | 2026-09-20 | A move is validated against a read of the table and then written without a condition, so two concurrent moves could build a cycle | A second writer appears, human or automated |
| app | 2026-09-20 | An unknown id in the address is navigated away by both the editor's 404 branch and the tab reconciliation, so a stale bookmark can produce two replaces | A third place navigates on the workspace changing, or the double replace lands somewhere wrong |
