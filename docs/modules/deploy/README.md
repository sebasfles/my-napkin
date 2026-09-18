---
updated: 2026-09-17
source: setup
---

# deploy

Planned; no code exists yet.
GitHub Actions workflows that gate pull requests and ship pushes to `main` to AWS, over OIDC, without touching Terraform state.

## Boundaries

- Owns: `ci.yml` (pull request checks) and `deploy.yml` (deploy on push to `main`).
- Does not own: infrastructure and configuration (`infra`), the application code being deployed (`app`).
- Code: `.github/workflows/`

## Documents

- [prd.md](prd.md): product behavior
- [trd.md](trd.md): structure and endpoints
- [ard.md](ard.md): decisions and debt
- [database.md](database.md): tables and invariants
- [flows.md](flows.md): diagrams
