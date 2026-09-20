## Retake 1: 2026-09-18

Source: PR #2, inline (Sebastian via om-manager)

- `ci.yml` runs no e2e and holds no app secrets. Commit 8241682 on `develop` (`docs: e2e runs only on the promotion PR against deployed dev, no mocks`) and `docs/conventions/e2e.md` are the reference: e2e runs only in `e2e-dev.yml` on pull requests into `main`, against the deployed dev. Remove the ci e2e step and the secrets wired into it (round 4, `896fc87`).
- `docs/modules/deploy/trd.md:22` still says `ci.yml` runs Playwright e2e without the `@aws` tag; the tag is gone and `ci.yml` runs no e2e at all. Correct it.
- The branch HEAD is `tmp: invalid terraform to prove ci goes red at validate (acceptance 2, to be reverted)`; revert it before the PR is re-published.
- Rebase on `origin/develop` (now 2e2be66, with 0005 and 0006 merged) as part of the round.
