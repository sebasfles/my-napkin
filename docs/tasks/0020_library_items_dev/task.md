---
id: "0020"
title: library_items_dev
type: bug
branch: bugfix/0020_library_items_dev
modules: [app, infra]
repos: ["."]
phases: 0
depends_on: []
ticket: https://github.com/sebasfles/my-napkin/actions/runs/35630985274/job/106437288399
created: 2026-09-21
updated: 2026-09-21
---

# 0020 Library items never show up on deployed dev

## Goal

On dev, a library's items load in the editor panel and an imported library file opens as a canvas with its frames, as they do locally.
`e2e-dev` on `develop` at `b2f2331` (2026-09-21) fails 4 library specs: the panel shows 0 items for a linked library with 2, and an imported library canvas stays empty.
Creating and linking libraries works, so this is the items path (`libraries/{id}/items.json` and the imported scene), not the library row.

## Scope

- Reproduce on deployed dev as a user does (link a library with items to a diagram, open the panel; import a library file) with a Playwright trace against `BASE_URL=https://napkin.dev.sdfles.com`, and find where the items path breaks on AWS but not locally: IAM (0018's grant applied or not, `s3:ListBucket` missing so a 403 replaces a 404), bucket versioning, the presigned read, or the Lambda's write of `items.json`.
- Fix at the root; if the fix is infra, it lands here with Sebastian applying dev from the branch before the merge so `e2e-dev` proves it.
- The 4 specs go green in `e2e-dev`: `library-import.spec.ts:30`, `library-insert.spec.ts:29` and `:73`, `library-panel.spec.ts:27`.
- Dev's shared table is swept of the rows those failed runs left.

## Out of scope

- `library-panel.spec.ts:93`, whose failure is the row menu moving under an autosave: task 0021.
- Any change to the libraries UI.

## Acceptance

1. Replication steps fail on dev before the fix and pass after it.
2. `e2e-dev` green on the merge commit, all 5 library specs included once 0021 lands or the flaky one is excluded from this count.
3. Local suite green.
4. If infra changed, `terraform plan` in dev shows only that change and Sebastian applied it before the merge.

## Approach

- Module `app` primary (`s3.ts`, `library-io.ts`, `library-cache.ts`, the library API routes), `infra` if the cause is IAM or the bucket.
- The om-developer reproduces first against deployed dev, then verifies locally and on dev after Sebastian applies if needed.
- CloudWatch logs of the dev Lambda are the fastest evidence; Sebastian pastes them if agents cannot read them.

## Database

None new; the `diagrams` table and scenes bucket through the existing repositories.

## Infra

Possibly the Lambda role (`s3:ListBucket`, or 0018 not yet applied); applied by hand by Sebastian.

## Design

None.

## Replication

See `replication.md`.

## Risks

- The cause may be that 0018 was never applied on dev; then the fix is one `terraform apply` and this task only proves it and adds the missing guard.
- The e2e runs leave rows in the shared dev table when they fail mid-cleanup.

## Depends on

None.

## Context & decisions

Consolidated 2026-09-21 with the om-manager and Sebastian.

### Cause, proven in round 0

- The import writes both objects correctly, and a second write about a second later replaces them with an empty canvas and an empty items file (om-developer, from the noncurrent versions the bucket still holds of run 35630985274).
- The writer is the editor's saver, not any import path: the clobbered canvas carries the package's post-`resetScene` appState, where the import deliberately writes `libraryLayout.clearOfTheEditorChromeX/Y`, and `JSON.stringify(emptyScene())` is 40 bytes against the clobber's 128, so `createEmpty` is excluded byte-exactly (om-reviewer).
- `editor.tsx:104` resets the scene whenever `api` is live while `shown` is still null, and the comment above it claims that window has "no saver to hear" it. Dev's latency opens the window and the claim is false, which is the bug. The fix corrects that claim rather than leaving it asserting something untrue.
- The remaining unknown is the commit ordering that lets the reset's report through the opening rebase in `scene-save.ts`. It is settled before any code is written, since the shape of the fix depends on it.
- The symptoms follow from that one cause, so nothing else is being hunted. The panel shows 0 items because `library-cache.ts` returns `[]` with no request and no error once `itemCount` is 0, `library-import.spec.ts:42` passes because it exports before the clobber lands, and `library-drop.spec.ts` passes because it never opens the library canvas.
- Every AWS candidate in `Scope` is dead by evidence rather than by argument: the grant, the presigned PUT, the presigned read, versioning and the Lambda write all behaved. So is the CDN, which serves the list with `CachingDisabled` and `no-store`.
- This is silent data loss for a real person, not a suite artefact: an import on a slow connection loses its items and leaves the row behind as an empty library.

### Round 1 decisions (om-reviewer)

- Diagrams are reachable by the same window, proven in the harness, with one historical witness in the bucket (`5027bda7`, 6415 bytes to 128, before 0016). Goal is unchanged, the fix stays at the root as `Scope` asks, and the PR leads with the diagram reach because that is the part that loses a person's drawing.
- No jsdom and no `.tsx` in the unit suite. `docs/modules/app/trd.md` (lines 50 and 145) defines `tests/unit/` as pure logic in a Node environment, and the module's `ard.md` already records that a unit test reaching the editor package dies on its CSS. A bug fix does not get to redefine the suite's contract, and the render test it would buy proves a boolean against a mocked package.
- Instead the gate becomes a named pure rule in `src/lib/editor.ts`, tested in the existing `tests/unit/editor.test.ts`, red on today's rule because it has no `painted` term. That is the shape the module already uses for its rules (`tree.ts` holds the one rule that decides a move), so it adds no pattern and no dependency.
- Accepted gap, recorded rather than hidden: the rule's test does not prove the JSX calls it. The JSX becomes one named call, which is the cheapest thing in the diff to review, and the alternative costs a documented convention.
- The saver-level probes from round 0 are committed as characterisation, not as the regression: they pin that an empty report uploads over a non-empty baseline and that the zero-version rebase is what protects a new canvas.

### Constraints the fix respects

- The role has no `s3:ListBucket` (`infra/stacks/app/compute.tf`), so a missing key answers 403 and not 404, while `docs/modules/app/ard.md` (2026-09-20, the items file) requires a missing `items.json` to read as no items. Nothing in the fix may rely on a 404 there.
- A new bucket prefix goes in the single declared list and nowhere else (`docs/modules/infra/ard.md`, 2026-09-21).
- Scenes never pass through the Lambda (`docs/TRD.md#Conventions`), so items may not be moved onto an API route.

### Adjustments

- Acceptance 2 counts this task's 4 specs (om-manager). `library-panel.spec.ts:93` stays 0021's, whichever task is ready first merges first, and `develop` may carry that one red spec briefly.
- Acceptance 2 and 4 are post-merge for an app-code fix (Sebastian). `deploy-dev.yml` fires only on a push to `develop` and the dev Actions environment admits that one branch (`docs/modules/infra/ard.md`, 2026-09-19), so no branch of this task can reach dev. The PR carries a red reproduction against dev and a green local suite, and `e2e-dev` on the `develop` run proves the fix.
- Read-only `aws` calls with `AWS_PROFILE=personal` are allowed for diagnosis (Sebastian), the dev Lambda's CloudWatch logs included, so `Approach`'s fallback of Sebastian pasting them is not needed. No agent mutates anything in AWS: no write, no delete, no apply.
- The table sweep therefore runs through the app's own delete path, the row menu the suite's cleanup already uses, and never `aws dynamodb delete-item` (om-reviewer). That keeps it inside the previous decision and lets the API's cascade take the bucket objects with the row, so the sweep creates no orphan; a leftover the UI cannot delete goes to Sebastian.

### Replication corrections

- No run against dev was ever started, so the dev table carries nothing of ours and the slot went back to 0021 unused.
- Step 1 holds only if the library is opened after its items are added, since `items.json` appears on the first save and not on the create (`docs/modules/app/ard.md`, 2026-09-20).

### Beyond the Pipeline, in review-task

- The reproduction is run 35630985274 itself, read from the noncurrent versions the scenes bucket still holds (om-reviewer, round 0).
  No Playwright run against dev is required or wanted: the run in the ticket is stronger evidence than a re-run, the bug cannot reproduce locally by construction, and acceptance 2 is post-merge on `e2e-dev`.
- The regression is unit level and must be red on the current code before it is green: a test written after the fix that cannot fail is a finding.
- Every candidate the fix did not take is ruled out by evidence carried in the round.
- No AWS mutation by an agent, and the sweep through the UI, announced to the om-manager, restricted to suite-generated names, with no 0021 run in flight.

## om-developer notes

### Round 1

What the fix is: `CanvasSaving` is mounted through `canSaveCanvas(shown, painted, locked)` instead
of `shown !== null && !locked`, so the saver subscribes only once the editor has been handed the
scene and painted it. `scene-save.ts` is untouched.

Why there and not in the saver: the saver is right to upload a scene the editor reports as emptied,
because a user who deletes everything means it. Guarding it there would have dropped that save. The
defect is that the editor could report a scene it was never shown.

Why it swallows nothing: `canSaveCanvas` is the cover's own condition, and `CanvasCover` is
`absolute inset-0 z-[3]` with no `pointer-events-none`, so the canvas is genuinely covered until the
gate opens. The saver starts at the first moment a stroke can land.

How the ordering was settled, since reading could not: `onChangeEmitter.trigger` exists at exactly
one place in the package, inside `componentDidUpdate`, guarded by `!isLoading`, never on mount. So
`onChange` carries whatever the scene holds at that instant. I then drove the real `createSceneSaver`
through every candidate ordering. With an imported library as the baseline, an empty report uploads
when it arrives alone, before the frames, after them, or pending at `flush()` on leaving; it uploads
nothing only when a non-empty report follows it inside the same 1500ms window. Every ordering but
one destroys the library, so the fix must not depend on which one fires, and pinning it down was not
needed. The probe was scratch and is not in the tree; its two load-bearing cases are committed as
characterisation in `tests/unit/scene-save.test.ts`.

Two om-reviewer findings arrived against the working tree, before the round could be committed, and
are folded into this same commit: the mechanism was explained in four places and is now in two, the
rule in `editor.ts` and the one-liner at the gate, with the comment in `editor.test.ts` cut and the
header in `scene-save.test.ts` trimmed; and `canSaveCanvas`'s type parameter was renamed from
`Scene` to `Canvas`, since nothing passed to it is a `Scene` and the project has a real one two
files away. Agreed with both. Comment and naming only, so the 313 tests are unchanged.

Decisions this round took that `Approach` and `Context & decisions` did not record:

- The regression is a pure rule in `src/lib/editor.ts` tested in `tests/unit/editor.test.ts`, not a
  rendered component. `docs/modules/app/trd.md:50` and `:145` define the unit suite as pure logic in
  a Node environment, and a bug fix does not rewrite that. Decided by the om-reviewer after I
  recommended the opposite; the gap it accepts is that the rule's test does not prove the JSX calls
  the rule, which is one named call in the diff.
- No new Playwright spec and no stubbed latency, per `docs/TRD.md#Conventions`. The `No e2e:` line
  for `docs/checks/e2e-worth.md` is below.
- The reproduction is forensic rather than re-run, and no dev run was spent. See `replication.md`.

Deferred, not done here:

- A diagram is reachable by the same window and this fix covers it, but nothing proves it. A
  freshly created diagram is spared only because its baseline is empty and the zero-version rebase
  absorbs the report; a drawn diagram reopened has neither protection. `5027bda7` in dev's bucket
  went 6415 bytes to 128 on 2026-09-20, which predates 0016 and is the loss its own ARD describes,
  so the reach is unwitnessed since, not witnessed and dismissed. Worth its own task.
- `infra/stacks/app/storage.tf` expires noncurrent versions under `scenes/` only, so `libraries/`
  keeps every version forever. It is why the reproduction was possible at all, and it is unbounded
  growth against the $0 target. For `document-task` as debt, not fixed here.
- A DOM harness for the unit suite. I recommended one and the om-reviewer refused it on
  `docs/modules/app/trd.md:50` and `:145`, correctly: a bug fix does not rewrite the unit suite's
  contract. It is worth raising on its own merits, because the swap now carries three rules that
  only a rendered editor can check end to end (the gate, the `viewModeEnabled` resync and the
  cover's timing), and each is tested today only as the pure part of itself. For `document-task` to
  put a revisit condition where the next person to touch the swap will find it.
- `useCanvasSave`'s cleanup calls `flush()` then `stop()`, and `stop()` mutes the success callback,
  so a saver rebuilt while dirty leaves the indicator reading "Saving". Already recorded as debt on
  2026-09-21 and untouched.

Debt this round creates: the editor's tools stay above the cover and reachable, so a keyboard paste
in the window before the gate opens mutates the scene with no saver mounted. It is not lost, since
the package reports on every re-render and any later interaction carries it, but it can sit
unreported until one happens. Strictly better than the window destroying the scene, which is what it
did before.

### Documentation

`docs/modules/app/`: two `ard.md` entries (the gate, and why the rule is pure rather than rendered),
a `trd.md` row for `src/lib/editor.ts`, and one corrected sentence in `flows.md`, which claimed the
saver runs "while the editor is open" and now says from the paint. That sentence was false in the
same way the `viewModeEnabled` comment was, so it is corrected rather than added to.
`docs/modules/infra/ard.md`: the `libraries/` version retention debt. `docs/ARD.md`: three new debt
rows and one widened, none removed, since this task resolves no recorded debt. The widened one is
the cover's animation frame, which now delays the saver too: that is one mechanism discharged by one
event, so it is one row rather than a second alongside it. Caught by the om-reviewer, who noticed
the module entry already called it a widening while the index was adding a duplicate.

`prd.md` is untouched on purpose. The fix restores the behaviour it already describes at line 79,
that a saved canvas reports its items, so there is nothing new for a user to read. `README.md` and
`database.md` likewise: no boundary, table or invariant moved.

`No e2e:` the fix is one gate on when the saver subscribes, and the window it closes only opens when
the scene fetch is slower than the editor's own mount. A spec cannot make that true against dev
without stubbing the network, which `docs/TRD.md#Conventions` forbids, and the four library specs
already in the suite are the ones that caught it and are the ones that prove it fixed on
`e2e-dev`.
