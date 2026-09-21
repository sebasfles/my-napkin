# Replication: 0020 library_items_dev

## Preconditions

- Logged in at `https://napkin.dev.sdfles.com`.
- `develop` at `b2f2331` or later deployed on dev.

## Steps

1. Create a library, add two items to it (from a diagram, as the e2e helpers do).
2. Open a diagram, link the library, open the editor's Libraries panel.
3. Separately, import a `.excalidrawlib` file from the Libraries section.

## Expected

The panel section for the library shows two items; the imported library opens as a canvas with one frame per item.

## Observed

The panel section is there with 0 items; the imported library canvas shows the empty state (`empty-library-canvas`).
Locally, through `npm run dev` with the admin profile, both pass.

## Environment

- App version or commit: `b2f2331` on dev
- Platform, browser or device: chromium in GitHub Actions, `e2e-dev` job
- Environment: dev

## Evidence

- https://github.com/sebasfles/my-napkin/actions/runs/35630985274/job/106437288399: 85 passed, 5 failed, 4 of them on library items.
- Same 4 specs passed locally in 0012 phase 3 (83/83) and 0017 (90/91).

## om-developer confirmation

## om-reviewer verification
