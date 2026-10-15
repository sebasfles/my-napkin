# Retakes: 0029 old_account_teardown

## 2026-10-15, Sebastian, on PR #45 before merge

PR #45 touches `infra/docs/setup.md`, and `deploy-dev`'s `decide` job (0026) treats it as code because the docs-only rule only knows `docs/**` and root `*.md`.
A docs change under `infra/docs/` or `app/` therefore redeploys dev and runs `e2e-dev` against the dev table, which is exactly what 0026 set out to stop.

Ask: widen the docs-only rule in `.github/workflows/deploy-dev.yml` so that a push is docs-only when every changed path is a Markdown file (`**/*.md`) or sits under any `docs/` directory at any depth (`docs/**`, `*/docs/**`, `**/docs/**`).
Everything else in the rule stays: the guard on the previous run, the fail-closed `if`s, `promotion-pr` always running.
`docs/modules/deploy/trd.md` states the widened rule in one sentence where it states the current one.
`npm run lint:workflows` green.

This PR itself then becomes the live proof when merged: with the change, its own `deploy-dev` run should skip `deploy` and `e2e-dev`.
