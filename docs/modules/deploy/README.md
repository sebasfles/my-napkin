---
updated: 2026-09-17
source: 0002_ci_workflow
---

# deploy

GitHub Actions workflows that gate pull requests, ship `develop` to dev and `main` to prd over OIDC, and open the promotion PR that proves a change on dev before it reaches prd.

`ci.yml` and `dependabot.yml` exist; the deploy and promotion workflows are still planned.

## Boundaries

- Owns: `ci.yml` (pull request checks), `dependabot.yml` (weekly dependency updates), `deploy-dev.yml` (deploy dev, open promotion PR), `e2e-dev.yml` (Playwright against dev on PRs into `main`), `deploy-prd.yml` (deploy prd).
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
