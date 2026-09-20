# Replication: 0010 The e2e login helper posts to the API from outside the browser and gets 403 on deployed dev

## Preconditions

- `develop` at 5918a42 or later (0009 merged), so `deploy-dev.yml` deploys and runs the suite.

## Steps

1. Push any commit to `develop`.
2. Open the `e2e-dev` job of that `deploy-dev.yml` run.

## Expected

The suite logs in on `napkin.dev.sdfles.com` and every spec passes.

## Observed

Every spec fails at `tests/e2e/helpers.ts` `login()`: `Error: the password does not open this environment`, `Expected: 200`, `Received: 403`.

## Environment

- App version or commit: 5918a42 (merge of PR #9)
- Platform, browser or device: GitHub Actions, ubuntu-latest, chromium
- Environment: dev

## Evidence

- https://github.com/sebasfles/my-napkin/actions/runs/35478504608/job/105992050640
- `curl -X POST https://napkin.dev.sdfles.com/api/login` with a JSON body answers 403 without `x-amz-content-sha256` and 401 with it.

## om-developer confirmation

Confirmed 2026-09-20 with the `curl` pair above, and with the unchanged helper run locally against dev, which fails at 403 for any password.

## om-reviewer verification
