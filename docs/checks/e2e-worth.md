---
name: e2e-worth
model: opus
paths:
  - app/src/**
  - app/tests/**
reference: docs/conventions/e2e.md
---

# e2e-worth

If the diff changes a user flow as the reference defines it (a page or layout under `app/src/app/`, `app/src/middleware.ts`, a route handler the UI calls, the save and load path, login or logout), the diff also adds or updates a spec under `app/tests/e2e/` that exercises that flow, or the branch's PR description contains a line starting with `No e2e:` followed by a reason.
A spec added or changed in the diff is named after its flow, `app/tests/e2e/{flow}.spec.ts`.
A spec added or changed in the diff drives the app as a person would and asserts what the screen shows; it mocks no network call, except blocking the browser's own request to reach a failure path.
A spec added or changed in the diff asserts what the user sees, not network payloads, unless the flow is the network call itself.
A spec added or changed in the diff removes the diagrams it created.
Report as clean: diffs that only touch styles, translations, `app/src/components/ui/`, unit tests, refactors that keep behavior, or files outside `app/`.
When the diff changes a user flow and no spec covers it, report one finding naming the flow and the spec file the reference expects.
