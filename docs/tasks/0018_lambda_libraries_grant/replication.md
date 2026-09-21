# Replication: 0018 lambda_libraries_grant

## Preconditions

- Logged in at `https://napkin.dev.sdfles.com` with the dev password.
- 0012 deployed on dev (merged 2026-09-20, PRs #24 to #26).

## Steps

1. Open the Libraries section of the sidebar.
2. Create a new library, name it `repro-0018`.
3. Open it, or export it, so a presigned `libraries/{id}/...` URL is requested.

## Expected

The library is created, appears in the list with 0 items, opens and exports.

## Observed

The create fails at step 2: the request errors, the library never appears and the page stays where it was.
Observed through `e2e-dev` on dev (runs 35540680158 and 35542288597 of `deploy-dev.yml`, 2026-09-20): every library spec timed out at `waitForURL` right after clicking `library-new`.
The dev server log has, at the same second as each attempt, `AccessDenied: napkin-dev-server is not authorized to perform s3:PutObject on libraries/{id}/scene.json because no identity-based policy allows the action`.

## Environment

- App version or commit: develop at `8842749` deployed on dev
- Platform, browser or device: any
- Environment: dev

## Evidence

- `infra/stacks/app/compute.tf:31` grants `${module.scenes_bucket.arn}/scenes/*` only.
- `app/src/lib/s3.ts:26,30` build `libraries/${id}/scene.json` and `libraries/${id}/items.json`.

## om-developer confirmation

Reproduced before the fix through `e2e-dev` and the dev server log, as above; the deployed role policy (`aws iam get-role-policy napkin-dev-server access`) names `scenes/*` only.
After the fix: pending Sebastian's `terraform apply` in dev, then the next `e2e-dev` on `develop` is the pass.

## om-reviewer verification
