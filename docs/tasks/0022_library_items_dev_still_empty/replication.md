# Replication: 0022 library_items_dev_still_empty

## Preconditions

- Logged in at `https://napkin.dev.sdfles.com`.
- `develop` at `7a717e3` (merge of #34) or later deployed on dev.
- `APP_PASSWORD` for dev and the e2e token from the om-manager.

## Steps

1. Create a library and add two items to it from a diagram, as the e2e helpers do; open the library after the items are added.
2. Open a diagram, link the library, open the editor's Libraries panel.
3. Separately, import a `.excalidrawlib` file from the Libraries section.

## Expected

The panel section for the library shows two items; the imported library opens as a canvas with one frame per item.

## Observed

The panel section is there with 0 items; the imported library canvas shows the empty state (`empty-library-canvas`).

## Environment

- App version or commit: `7a717e3` on dev
- Platform, browser or device: chromium in GitHub Actions, `e2e-dev` job
- Environment: dev

## Evidence

- https://github.com/sebasfles/my-napkin/actions/runs/38497207353: `library-import.spec.ts:30`, `library-insert.spec.ts:29`, `library-insert.spec.ts:73`, `library-panel.spec.ts:27` red, each `Expected: 2, Received: 0`.
- 0020's run 35630985274 with the same failures before #34.
- PR #34's forensics on the bucket versions of 0020's run.

## om-developer confirmation

## om-reviewer verification
