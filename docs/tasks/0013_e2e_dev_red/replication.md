# Replication: 0013 e2e-dev is red on develop

## Preconditions

- `develop` at f6e6c84 (0011 phase 4 merged), dev deployed from it.
- `app/.env.local` present for the local runner; Playwright installed.

## Steps

1. Push any commit to `develop`, or rerun `deploy-dev.yml` on f6e6c84; open the `e2e-dev` job.
2. Locally: `cd app && BASE_URL=https://napkin.dev.sdfles.com npx playwright test --workers=1`.
3. In a browser: open `https://napkin.dev.sdfles.com/icon-192.png`.

## Expected

64 passed; the icon answers 200 and the browser tab shows it.

## Observed

- 10 failed, 1 flaky, 53 passed in 9.2 min.
- 8 specs fail at `helpers.ts:298`: `expect(page.getByTestId("toolbar-rectangle")).toBeChecked()` times out after 15 s, on the retry too (editor.spec, item-menu.spec, locale.spec, save-failure.spec, save-reload.spec x4, tabs.spec, diagram-list.spec).
- `metadata.spec.ts:100` fails: `/icon-192.png is missing` (non-200 from dev).

## Environment

- App version or commit: f6e6c84
- Platform, browser or device: GitHub Actions ubuntu-latest, chromium; also reproducible from a developer machine with `BASE_URL`
- Environment: dev

## Evidence

- https://github.com/sebasfles/my-napkin/actions/runs/35526315218
- https://github.com/sebasfles/my-napkin/actions/runs/35519420749 (same failures on 2cfe563)
- `infra/stacks/app/variables.tf` `static_path_patterns` default `["/_next/static/*"]` with the description "The application has no public/ directory".

## om-developer confirmation

## om-reviewer verification
