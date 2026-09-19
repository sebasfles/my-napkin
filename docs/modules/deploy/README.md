---
updated: 2026-09-19
source: 0007_deploy_workflows
---

# deploy

GitHub Actions workflows that gate pull requests, ship `develop` to dev and `main` to prd over OIDC, and open the promotion PR that proves a change on dev before it reaches prd.

Every workflow exists: a change merged into `develop` reaches prd without a manual AWS command.

## Boundaries

- Owns: `ci.yml` (pull request checks, and the same checks on every push to `develop`), `dependabot.yml` (weekly dependency updates), `deploy-dev.yml` (deploy dev, run the suite against it, open the promotion PR), `deploy-prd.yml` (deploy prd), `reusable-deploy.yml` (the deploy steps both callers share).
- Does not own: infrastructure and configuration (`infra`), the application code being deployed (`app`).
- Code: `.github/workflows/`, `.github/dependabot.yml`
- Borrows: the workflow linter is a devDependency of `app/`, because npm is the only package manager the repo has.
  See [trd.md](trd.md).

## Documents

- [prd.md](prd.md): product behavior
- [trd.md](trd.md): structure and endpoints
- [ard.md](ard.md): decisions and debt
- [database.md](database.md): tables and invariants
- [flows.md](flows.md): diagrams
