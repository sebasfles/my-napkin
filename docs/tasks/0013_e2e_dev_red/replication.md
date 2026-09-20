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

2026-09-20, on 865e181 (branch `bugfix/0013_e2e_dev_red`, before any change).

Cause 1, reproduced, and the diagnosis is confirmed rather than assumed.
`https://napkin.dev.sdfles.com/icon-192.png` and `/icon-512.png` do not answer 200; every other metadata path does (`/favicon.ico`, `/icon.png`, `/icon.svg`, `/apple-icon.png`, `/manifest.webmanifest`), served by the Lambda with `x-cache: Miss from cloudfront`.
So the failure is exactly the two files of `public/` and nothing else, which is what the CDN serves nothing of.
Step 3 of the steps above reports 404 for `/icon-192.png`; for the new `/static/icon-192.png` the pre-apply answer is instead 307 to `/login?next=%2Fstatic%2Ficon-192.png`, because the deployed `gate.ts` has no `/static/` prefix and a nested path does not match its `rootFile` regex.

Cause 2, not reproduced locally, mechanism established from the CI log and the source.
Four runs of `editor.spec.ts -g "keeps a drawn rectangle"` against deployed dev passed, so the failure does not appear on this machine; those runs are also discarded as evidence, since three Playwright suites shared the machine at the time.
What the CI log of run 35526315218 shows is that `getByTestId("toolbar-rectangle")` resolves 34 times over the 15 s and is never checked, with the page alive.
The editor is therefore mounted and interactive: nothing was still loading, the input was lost.

The mechanism, from the code rather than from timing:

- `@excalidraw/excalidraw` binds its key handling to `onKeyDown` on the `.excalidraw-container` div (`tabIndex: 0`), not to the document, because `handleKeyboardGlobally` defaults to false and the app does not set it. `r` only reaches the editor when focus is already inside that container, and the canvas click is the only thing that puts it there.
- `NameDialog` is a Radix `Dialog` with no `modal={false}`, so while it is open or closing the body carries `pointer-events: none` and focus is held by `name-input`, which is `autoFocus`.
- `sidebar.tsx:291` calls `setOpen(false)` synchronously on submit and fires the rename after it, and `renameThrough` (`helpers.ts:200`) never waits for the dialog to be hidden.
- `drawRectangle` then fires `page.mouse.click()` at raw coordinates. A blind coordinate click into a body that takes no pointer events hits nothing, focus never enters the container, and the following `r` is dropped. Both inputs are one-shot, so the 15 s assertion that follows can never recover them.

The run's one flaky spec is the same cause reached by a different key, and it is what fixes the shape of the window.
`save-reload.spec.ts:35`, "keeps a pasted image after a reload", runs `newDiagram` and then `pasteImage`, the same first click after the rename dialog closes, and failed at line 40 with `redPixelsOnCanvas` returning 0.
Nothing had been pasted: the click was swallowed, focus never entered the container, and `ControlOrMeta+V` went nowhere.
`pasteImage` retries nothing either, and that spec still passed on its retry.

So the window is a finite race with a real duration, not a fixed ordering that a given machine always loses.
The runner loses it nearly always through `drawRectangle` and sometimes wins it through `pasteImage`.
That is the reason the fix has to be an actionability gate on the click rather than any duration: a delay would be tuned against a window that moves.
Why the two helpers sit differently in that window is not established; `pasteImage` does call `grantPermissions` before its click, which is one more protocol round trip of gap, but nothing here proves that is the cause.


## om-reviewer verification

2026-09-20, round 1 at `1cc4d5f`.

- Cause 2: verified. The om-developer's run against deployed dev returns 63 passed, 1 failed, 0 flaky, with all eight `drawRectangle` specs passing and `save-reload.spec.ts:35` passing without a retry, against the same environment that failed them twice each in run 35526315218.
  The Observed section's first bullet no longer reproduces.
- Cause 1: not yet observable, by design, and the Observed section's second bullet still reproduces.
  Probed by the om-reviewer against dev at review time: `/icon-192.png` answers 404, `/static/icon-192.png` answers 307 to `/login` because the deployed gate predates this branch, `/manifest.webmanifest` and `/icon.png` answer 200 from the Lambda, which is the wildcard rejection holding.
  The new keys reach the assets bucket on the merge deploy and the CloudFront behavior on Sebastian's apply, so Expected is provable only after both, per Acceptance 2 as adjusted in `Context & decisions`.
- The steps as written remain executable; no correction to preconditions or steps was needed.
