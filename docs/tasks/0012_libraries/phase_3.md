---
phase: 3
branch: feat/0012_libraries-phase-3
updated: 2026-09-20
---

# Phase 3: editor panel

## Scope

- A napkin panel inside the editor through the package's `Sidebar` API, with its own trigger.
  The package's own library trigger is hidden by one CSS rule scoped to the editor wrapper, since `UIOptions` carries no flag for it; see `Context & decisions`.
- One collapsible section per linked library with item thumbnails (`exportToSvg`), click or drag to insert at the viewport center or the drop point, with every id, group, container and binding regenerated as one consistent set.
- "Add selection to library" appending a frame to the chosen linked library or to a new one, and "Browse" opening the napkin Libraries section.
- The `items.json` of the linked libraries load in parallel on open and are cached in memory by library id, keyed on the item's `updatedAt`, so saving a library canvas refreshes the panel in every open tab that links it.
- Playwright: `library-insert.spec.ts` and `library-add-selection.spec.ts`; unit tests for insertion and for the cache.
- Docs: `docs/PRD.md` capability and `docs/modules/app/` prd, trd, ard and database final, carrying the three debts recorded in `Context & decisions`.

## Acceptance

1. Task acceptance 2, 3 and 5 as reworded in `Context & decisions`, and 6 for this phase's flows.
   Acceptance 1 also closes here, where it becomes observable: a linked diagram's panel shows the item, and renaming its frame in the library canvas renames it in the panel.
2. Inserting an item copies it: editing or deleting the library afterwards leaves the diagram intact, and inserting the same item twice produces two independent copies.
3. The panel shows one section per linked library and nothing from an unlinked one, and the package's library button is not shown.
4. PR description carries screenshots, light and dark, of the panel with two linked libraries and of the add-selection dialog.

## om-developer notes

### Round 1

Built: the editor panel through the package's `Sidebar`, one collapsible section per linked library with `exportToSvg` thumbnails, click or drag to insert, "Add selection to library" with its dialog, "Browse", the in-memory item cache, and the CSS rule that takes the package's own library away.
New files: `src/components/library-panel.tsx`, `src/lib/library-cache.ts`, and three specs.
Grown: `library-items.ts` (insertion, the selection, the appended frame), `library-file.ts` (thumbnails, scene coordinates), `library-io.ts` (reading a library's items, appending to one), `item-dialogs.tsx` (the add dialog), `editor.tsx` (the panel's two mount points), `globals.css`, both message files and the e2e helpers.

#### The package's own library, which is where this phase could have gone quietly wrong

`Context & decisions` said one CSS rule on the trigger.
Two things it did not know changed the rule, and both were found by reading 0.18.1 rather than by looking at the screen.

- The button is not the only way in.
  `DEFAULT_SIDEBAR` is `{ name: "default", defaultTab: "library" }` and `DefaultSidebar` renders both of its tab triggers unconditionally, so `actionToggleSearchMenu` (Ctrl+F) and `MainMenu.DefaultItems.SearchMenu` ("Find on canvas"), neither of which `UIOptions.canvasActions` can remove, open a sidebar with the native library one click away.
  The rule therefore carries a second selector for that tab trigger.
  It has no class of its own, being a Radix `Tabs.Trigger` with `asChild`, so it is addressed by the id Radix builds, `${baseId}-trigger-library`.
  That is the most brittle thing this task ships and it is named as debt.
  Two things I checked so as not to widen the rule further: the command palette, which does carry a `toolBar.library` command, is never mounted by `LayerUI` in the package build, and no `0` handler exists outside excalidraw-app, so the trigger's `aria-keyshortcuts="0"` is vestigial.
- Hiding the button is not enough to remove the control.
  `Sidebar.Trigger` renders `label.sidebar-trigger__label-element` wrapping `input.ToolIcon_type_checkbox`, and `default-sidebar-trigger` is a class on an inner div, not on the label.
  Hiding that div would have left a focusable checkbox: Tab, then Space, and the native library opens with nothing on screen to explain it.
  The rule takes the label instead, through `:has(.default-sidebar-trigger)`, and it is `display: none` rather than opacity or pointer events, or the input stays in the tab order.
  No screenshot could have shown this and no click-driven spec would have found it.

`library-panel.spec.ts` guards both halves, and how it asserts is the point.
It counts what is on screen, exactly one visible `.sidebar-trigger` in the editor's top right and exactly one visible tab trigger in the package's sidebar, rather than asserting that the library trigger is absent.
A locator keyed on the Radix id satisfies "is absent" by matching nothing, which is precisely what happens when the id scheme changes, so that spec would have gone green on the rot it exists to catch.
Asserting the right number of things are present cannot be satisfied by absence.

#### Decisions this round took that `Approach`, `Context & decisions` and the phase file did not record

- The insert gesture is a pointer drag with `setPointerCapture`, not HTML5 drag and drop.
  The package's `handleCanvasOnDrop` already reads `MIME_TYPES.excalidrawlib` off the dataTransfer and inserts with its own id regeneration, so a native drag would either race it or quietly depend on it, and either way the insertion stops being ours while still looking like ours.
  Capture keeps the gesture out of the editor entirely and gives one code path for click and drop: a release inside the panel means the viewport centre, a release over the canvas means that point.
  It also means the spec drives `mouse.down/move/up` rather than Playwright's `dragTo`.
- The gesture lives in a ref and only its ghost in state, and a second ref suppresses the click that a captured release still fires.
  Reading `moved` from state would race a pointerup that lands in the same frame as the last pointermove, and without the suppression a drop would insert twice, once at the drop point and once at the centre.
- The release point is converted by the package's own `viewportCoordsToSceneCoords`, reached through `library-file.ts`, rather than by arithmetic of ours.
  This is the opposite call from `modules/app/ard.md` 2026-09-18 "`sceneVersion` is reimplemented instead of imported", and deliberately: that entry's reason was a module-scope import running during server rendering, which a lazy import inside a function does not do, and a viewport transform that disagrees with the editor's by a rounding rule is a bug nobody would find.
- The panel and its trigger are reached through `next/dynamic` with `ssr: false`, so `library-panel.tsx` may import `Sidebar` and `CaptureUpdateAction` at module scope the way `editor.tsx` imports `Excalidraw`.
  `npx next build` is what proves it, and it exercises the real boundary rather than the convention.
- Both render only when the open item is a diagram and is not locked.
  A library canvas has no `libraryIds` and nothing to insert into itself, and a locked diagram refuses scene writes at the table, so offering an insert there would promise a save the server will refuse.
- The panel is not dockable.
  `Sidebar` supports it, the plan does not ask for it, and undocked is what the package's own library does: a click on the canvas closes it, and `useOutsideClick` listens on pointerdown only, so a drag that starts inside and ends on the canvas survives.
- Three copies of the id remapping became one, `reidentified` in `library-items.ts`, taking the identity, the placement and the frame.
  The derivation, the import layout and the insertion each had their own, and the third would have been a third copy of the rule the om-reviewer said he would check: that ids, groups, containers and bindings are remapped as one consistent set.
  The 17 tests that already covered the first two passed unchanged, which is what says the refactor moved nothing.
- An inserted or appended copy carries `index: null`.
  Keeping the fractional index it came with would have a second copy claiming the first one's place in the order; `updateScene` runs `syncInvalidIndices`, so null is the honest way to say "put it at the end".
  The import layout keeps its indices, unchanged from phase 1, because nothing there can collide.
- An added selection carries the labels of the containers in it, which the editor does not select on its own, and leaves out frames, deleted elements and images.
  Images cannot be an item, so carrying one onto a library canvas would need the binary in the library's `files` for a frame that would then show the permanent hint from phase 1 about something the user did not put there.
  When images are dropped the editor's own toast says so, rather than losing them silently; a selection that is nothing but images is refused with its own message.
- An appended frame lands below everything on the library canvas, at the left edge of what is there, not beside it.
  A four column grid from an import would otherwise stretch into one row.
- The frame an added selection makes is left unnamed, exactly like a frame the user draws.
  The alternative was a second input in the dialog, and the rule that a frame's name names the item is already the way to name it.
- Adding to a brand new library links it to the open diagram in the same action.
  Otherwise the item is missing from the panel it was added from, which reads as a bug rather than as a missing link.
- The cache holds one entry per library, replaced when `updatedAt` moves, and never asks for the items of a library whose `itemCount` is 0.
  Keying on `id@updatedAt` alone would grow an entry per save while a library canvas is being edited; the empty rule is phase 1's debt turned into behaviour, since a library has no items file until its first save.
  A failed load is forgotten, so the next open tries again instead of serving the failure.
- `AddToLibraryDialog` sits in `item-dialogs.tsx` with the other four, and `LibraryPanel` renders it outside `<Sidebar>`.
  `Sidebar` returns null when it is closed, so a dialog inside it would unmount with the panel.
- The insert with no drop point goes to the centre of the canvas, part of which the undocked panel covers.
  This is what the package does for its own library and it is the first thing to look at in the screenshots.
- The panel keeps the package's sidebar background rather than ours.
  `.excalidraw .sidebar` is unlayered CSS and Tailwind's utilities are layered, so an unlayered package rule wins over any utility whatever its specificity; fighting it would take a rule of our own on top of the rule we already have for the package's library, and the panel arguably belongs to the editor's chrome anyway.
  Worth a look in the shots.
- `openLibraryPanel` in the helpers is idempotent, because the trigger is a toggle and any click on the napkin sidebar closes an undocked panel, so the specs reopen it constantly.
- `elementsOf` reads the count out of the Info dialog.
  It is the only number the app shows about a diagram's contents, and it is what makes "two inserts are two copies" an assertion rather than a hope.

#### A defect the new tests found

`remapBinding` threw on an arrow whose `endBinding` key was absent rather than null.
Every arrow the editor makes carries both keys, so the derivation never met one, but a hand written or older `.excalidrawlib` can leave them out, which is exactly what `tests/e2e/fixtures/shapes.excalidrawlib` is an example of the shape of.
A binding that is not there is now a binding to nothing, and a test covers it as what it is: a file that never wrote the key.

#### New tests, and why each can fail for a reason that matters

Unit, 24 new across `library-items.test.ts` and `library-cache.test.ts`, 287 in the suite.

- The insertion tests: centred on the drop point, centred as a whole rather than per element, every id and group and container and binding new and consistent, two copies sharing nothing, and no inherited place in the order.
  The fourth is acceptance 2: it runs both inserts off one id generator, as the app does, so it would catch a collision that two fresh generators would hide.
- The selection tests: the label of a selected container comes along, frames and deleted and unselected elements do not, images are left out and counted.
- The appended frame tests: below everything at the left edge, at the origin on an empty canvas, every element inside the frame, and no id the canvas already holds.
- The cache tests: one load for concurrent readers, none for a second read, a reload when `updatedAt` moves, no load at all for a library with no items, a failure forgotten, and one library's failure not touching another's items.

I checked four of them by mutation rather than trusting that they would fail.
Inserting at the top left instead of the centre fails 2; appending above instead of below fails 1; keeping the ids the item came with fails 4, including the two-copies test and the derivation's own; dropping the labels fails 1.
All four restored to green afterwards.

E2E, three specs: `library-panel.spec.ts` (sections and the package's library, above), `library-insert.spec.ts` (a click insert, two inserts counted through Info, the library deleted underneath, and a drag whose landing place is proved by rubber banding the drop point and then somewhere else), `library-add-selection.spec.ts` (into a linked library and through to a second diagram, and into a brand new library that must come out linked).
The drag spec deselects with a landed click before each rubber band, because the editor's shape properties open over the top left of the canvas the moment anything is selected and the band has to start on bare canvas.
No key is pressed anywhere in this round without a landed click before it.

#### Verification

Four targets green: deploy, infra-core, infra-dev, infra-prd.
The app target is red on e2e and only on e2e: lint, typecheck and 287 unit tests all exit 0, and the suite never ran at all.
This session's permission layer refused it twice as [Interfere With Workloads], as `npx playwright test --workers=1` and as `npm run test:e2e`.
No exit code could be captured, so `verify-task` calls the step fail rather than pass and the app target is unverified.
The e2e token was granted and held while this happened; nothing was swept, nothing was retried blind, no runner was started and port 3000 was left free.
Raised with Sebastian, whose decision it is; not handed to the om-reviewer, whose session's answer is not the one mine was refused and who audits this log rather than producing it.

Outside the targets, `npx next build` succeeds, and the built CSS carries the panel's utilities (`aspect-square`, `grid-cols-3`, `touch-none`), so the panel will not paint unstyled when the screenshots are finally taken.

Pending, in order, once the permission is settled: the suite, the screenshots from `screenshots-phase3.mjs` in the workspace, then the round commit.
Nothing is committed yet, because a squashed round the om-reviewer cannot audit later reads as something that was checked.

Deferred, out of this phase's scope:

- The panel has no way to reorder or rename an item; the library canvas is where a frame is renamed, and that is the design rather than a gap, but nothing in the panel says so.
- A thumbnail is exported once per item per theme and thrown away when the panel closes, so reopening it re-exports every one.
  It is imperceptible at the size of a personal library and it is a cache away if it ever is not.
- `screenshots-phase3.mjs` still deletes its rows through the API with an `x-amz-content-sha256` it computes itself, as phase 2's did.
  It is not test code, it never enters the repo, and a `finally` block that cleans up has to work when the UI is the thing that broke, so the suite's "no test code computes a payload hash" still holds.
- The four suite findings from phase 1 are unchanged and still belong to their own task: the 30s budget `awsTimeout` consumes whole, `removeItemsCreatedHere` silently skipping anything inside a folder, and a local `verify-task` not being isolated from Sebastian using dev by hand.

### Round 2, by a second developer

Round 1 was written, never committed, and stopped when its session was refused the e2e command twice.
This session is a fresh one, launched to pick up current policy rather than to persist through that refusal, and it inherited the round above intact.
Nothing in it was rebuilt.
What follows is what a second reader found in it, and the four changes that came out of that.

The probe that did not happen is worth one line, because it is the same lesson as the findings.
Before running the e2e command to learn whether the refusal was still there, I looked at the machine and found 0016 mid-suite on port 3000, and `playwright.config.ts` setting `webServer.reuseExistingServer: false`.
So the run would have tried to start a second dev server on an occupied port and died there, and a port error would have been read as an answer about permissions.
A check that cannot tell its own subject from an unrelated failure is worth less than no check.

#### Four findings in round 1, and what each one cost

Round 1's account of the package's own library is accurate and I verified every claim in it against 0.18.1 rather than against the notes: `default-sidebar-trigger` really is on an inner div, the label really does wrap a focusable checkbox, `.default-sidebar` and `.sidebar-triggers` exist, and the library tab really is a Radix trigger with `asChild`.
The reasoning held.
What it had not done was ask what else opens that panel.

1. **A dropped `.excalidrawlib` opened the package's library panel in full, and acceptance 5 would have shipped false.**
   `handleAppOnDrop` sends a dropped file to `loadSceneOrLibraryFromBlob`, and on `MIME_TYPES.excalidrawlib` it calls `updateLibrary({ merge: true, openLibraryMenu: true })`, which sets `openSidebar: { name: "default", tab: "library" }` directly.
   Every trigger the CSS hides is irrelevant to a state set in code.
   The file merged into a localStorage store this app never reads, and the gesture that gets there is the one phase 2's own export button invites: export a library, drag it back.
   The drop is now ours, and it creates a napkin library rather than refusing the file.

2. **The canvas context menu still offered "Add to library".**
   It writes to that same invisible store and toasts success, so it was a dead end, and it sat beside this phase's own "Add selection to library" doing something different under nearly the same name.

3. **A selected frame added nothing, and the message then explained it with images.**
   Selecting a frame puts only the frame's own id in `selectedElementIds`, which is why the package's own action passes `includeElementsInFrames`.
   So the most natural thing to select, once this task has taught someone that frames are items, contributed nothing, and the toast said "An image on its own cannot become a library item" to a person who had selected no image.
   The unit test that pinned "leaves out a frame" used a childless frame, so it could not tell "the frame element is left out" from "a frame contributes nothing".

4. **The drag insert asked the wrong question about where it landed.**
   It tested "outside the panel" rather than "over the canvas", so a release over the napkin sidebar or the editor's own islands inserted the item at a scene point that was not on screen.

#### What the fixes are

The import flow has one producer, `importLibraryFile` in `library-io.ts`, with its ports injected in the style `modules/app/ard.md` 2026-09-18 already sets for the saver.
`library-list.tsx` lost its copy of the sequence.
Two doors, one order of operations, because the copy that diverges is always the one nobody is reading.

The interceptor is `onDropCapture` on a wrapper inside `EditorCanvas`, and it claims a drop only when `libraryFileAmong` finds a name ending in `.excalidrawlib`.
It works for a reason worth recording, because it would have half-worked for a subtly different one.
The package registers **native** `dragover` and `drop` listeners on its own container, not only React props, so the question was whether ours runs first.
It does: React 18 attaches its capture listener to the app root, an ancestor of that container, and a capture listener on an ancestor fires before any listener on a descendant.
React's `stopPropagation` also calls the native one, so the event never reaches the package at all rather than reaching it and being ignored.
Had React attached at the container instead, this would have appeared to work and failed on ordering.

The drop creates the library, links it to the open diagram, stays put, and toasts.
It does not navigate, because navigating would take someone off the diagram they are drawing on to show them a canvas they did not ask for, and leave the library unlinked so the items still would not be where they dropped them.
This is not a new rule: it is the one this phase already took for adding a selection to a brand new library.
Because there is no navigation, the toast carries the whole outcome, which library it became and that it is linked and therefore in the panel now, and a second toast covers a library canvas where there is nothing to link.
Both locales, like everything else.

`selectionForLibrary` now takes what a selected frame holds, as the package does, and the empty case says something true.

#### The one mistake this phase made three times: a check that the wrong thing can satisfy

Three times in this phase a check passed for a reason unrelated to what it was meant to establish.
They look like different mistakes and they are one.

1. A locator keyed on a third party's id or testid satisfies "the thing is gone" by **matching nothing**, which is precisely what happens when the scheme changes.
   So the assertion goes green on the rot it exists to catch.
   Both halves of acceptance 5 are therefore written as counts of what is on screen: exactly one visible `.sidebar-trigger` and exactly one visible tab trigger, and the context menu entry asserted **present and hidden**, both.
   Absence cannot satisfy either form.
2. The round 1 test that pinned "a frame is left out of the selection" used a frame with no children, so "leaves out the frame" and "leaves out everything" were **the same observation**.
   It passed either way, and the behaviour it appeared to protect was in fact missing.
   Its frame now has children, which is what makes the two outcomes distinguishable.
3. The memory sampler written while waiting for the machine piped `ps` into `awk`, and the awk program names the very processes it matches, so `ps` saw the matcher's own command line and counted it.
   There was a guard, and a synthetic test of the guard printed a clean zero, so it looked correct.
   It was passing **by accident**: the self-matched line's fields were non-numeric and summed to zero rather than being excluded, so any edit to the program's text would have turned a passing guard into a silent overcount.

The third is the sharpest, though it is tooling rather than shipped code, because it would have produced *a number* rather than a failure, and that number was going into a proposal to gate other tasks' machine access.
An instrument that counts itself is worse than no instrument.
Its fix is the one to copy: `ps` writes to a file and exits, then awk reads the file, so the matcher cannot be running when the snapshot is taken.
That removes the fault by construction where a fourth guard would only have added another thing that can appear to work.

A fourth case came up while waiting for the machine, and it is the rule working rather than a fourth defect, so it is written as one.
The drop spec asserts `.default-sidebar` has count 0, which is only meaningful if the package unmounts a closed sidebar instead of hiding it.
Asking what else could satisfy that check is what surfaced the question at all; the answer is that `Sidebar` ends in `if (!shouldRender) return null`, gated on `appState.openSidebar?.name === props.name`, so count 0 really is the closed state.
Had it been render-then-hide, the assertion would have been true before the drop and after it, and would have proved nothing while reading as the strongest line in the spec.
What settles it is better than that reading, and it was already half built: `library-panel.spec.ts` opens the same element through Find on canvas and counts what is inside it, so if the sidebar were render-then-hide the drop spec's count 0 would fail on its first run rather than pass vacuously.
The two assertions establish together, on this version of the package, what neither establishes alone, and a comment in the drop spec says so, because the hazard is someone later deleting one and leaving the other looking fine.

A fifth case, also not a defect, is about verification rather than code and is worth one line because the sentence will be written again.
I reported "all 58 testids used by the specs resolve" as a completed selector pass.
The extraction behind it read testids and only testids, while the same specs also assert on `data-items`, `data-linked` and five other data attributes, two of which carry the whole meaning of the add-selection spec's last three assertions.
All seven resolve, so nothing was wrong, but the claim was wider than its evidence, and the narrowness lived in the grep rather than in the sentence, so re-reading the sentence could never have found it.
"I verified the selectors" is the kind of statement whose scope is set by how it was built rather than by what it says.

The rule, stated so the next person does not have to rediscover it: **ask what else could satisfy this check**, and prefer the form that the wrong answer cannot satisfy.
Count what is there rather than assert an absence.
Give a fixture the feature under test, or it cannot tell two outcomes apart.
Remove a self-reference structurally rather than filtering it.
Everyone reaches for the weaker form by instinct, including three times here.

#### New tests, and what each can fail for

Unit, six new, 293 in the suite.
Three on `libraryFileAmong`: it claims the library file among several, claims it whatever the case of the extension, and claims neither an image nor an `.excalidraw` scene, which is the one that would go wrong quietly since it ends in the same letters.
Three on the selection: what a selected frame holds comes along and the frame element does not, an element both selected and inside a selected frame comes once, and an empty frame reports zero images rather than leaving the caller to explain it with one.
I mutated the frame clause out and watched the first of those fail, and restored it.

E2E, one new spec and one new test.
`library-drop.spec.ts` covers the positive (a dropped library file becomes a linked library whose items are in the panel, and the package's sidebar never opens) and the negative the reviewer asked for by name: a dropped image still reaches the editor and creates no library.
The negative matters more than the positive here, because intercepting drops on the editor is exactly the change that silently breaks image dropping, and a broken image drop is a worse regression than the hole being closed.
`library-panel.spec.ts` gains the context menu entry, present and hidden.

**What those two drop tests cover, and what closes the rest.**
Both dispatch a synthetic `drop` with a constructed `DataTransfer`, because Playwright cannot perform a real OS file drag.
That covers the half that is ours: the claim, the routing, and the release of every file we do not recognise.
The half that is the browser's is closed by reading the package rather than by a test.
A real drag only delivers a `drop` event if something prevents the default on `dragover`, and the package registers native `dragover` and `drop` listeners on its own container bound to `disableEvent`, which is exactly `event.preventDefault()` with no condition on the file or anything else.
So delivery is an unconditional guarantee in their code, not an assumption in ours, and it does not depend on the dropped file being one we claim.
Put beside the ordering above, the chain is complete: their `dragover` means the event fires, React's root capture listener means we see it first, and React's `stopPropagation` calling the native one means they never see it.
Sebastian's one drag by hand on the PR is a confirmation of that reading rather than the only evidence for it, and it is also what tells us the day the package stops doing this.
It sits next to the excalidraw.com check acceptance 4 already asks of him.

#### Scope, for Sebastian rather than for us

At consolidation the agreement was that acceptance 5 would be met by one CSS rule scoped to the editor wrapper.
It is now that rule with two selectors, plus a context menu selector, plus a drop interceptor that routes to the import.
Each step is justified and the first was not wrong, only incomplete, but the total is materially more than what was approved, and it is his call whether to keep it or fall back to refusing the drop with a message.
This is at the top of the PR's `Decisions` in those terms.

#### Also done, and not done

Round 1 left two unused-import warnings in its own specs, and `clickCanvas` in the helpers was a one-line alias around a private function with the same body, imported once and never called.
Both gone, inside files this round already had to touch.

Deferred: `window.location.assign` in `src/lib/api.ts` is the one lint warning left.
It predates this task, it is in a file this phase never touches, and changing how the app leaves a page on an auth failure is not something to do quietly at the end of a round.

#### Verification: three attempts, one code defect, no green run

The suite ran three times. Every test passed at least once, no test failed twice for a code reason, and no single attempt was green, so the app target is logged unverified rather than assembled out of three runs.
A composite green would have been the most defensible-looking false claim in the task.

| Attempt | Machine | MemAvailable floor | Failures |
|---|---|---|---|
| 1 | contended | 16 MB | 3 host, 1 code |
| 2 | clean | 1012 MB | 1 code |
| 3 | contended | 11 MB | 3 host, code one fixed and green |

The host failures name themselves: "Target crashed", "Navigation failed because page crashed", `page.goto` timing out, `.excalidraw` never rendering.
They are not assertions failing, they are the browser and the server dying.

**The one code defect, and it was in a spec rather than the feature.**
`library-insert.spec.ts` read the element count once, after waiting for the save indicator to read "Saved".
`elementsOf` reports the table's `elementCount`, which a save writes, so it lags the canvas by one save, and `saveIndicator` renders the saver's `idle` state as "Saved", so after any earlier save that wait is satisfied the instant it is made.
The second read therefore always landed before the second save completed.
Deterministically, not sometimes, which is why it failed identically at a 16 MB floor and at a 1012 MB floor; a real race would have varied, and that invariance is what identified it.
Acceptance 2 was never in question once the spec was fixed: two inserts are two independent copies, ids are unique by construction because `useInsert` builds a fresh generator per insert, and `updateScene` appends rather than replaces.

The fix is structural.
`elementsOf` is private and `expectElements`, a retrying assertion, is the only exported way to assert on that number, so the unsafe form cannot be written rather than being written and discouraged.
The `saveIndicator` waits that existed only to guard a count are gone rather than left in place looking meaningful.
**Any assertion on `elementCount` has to be written as "becomes" and never as "is"**, and the next person will reach for `elementsOf` believing it reads the canvas, which is why the read is not reachable.

#### Two process findings, neither about this task

**A trailing command can hand the om-reviewer a green block for a red run.**
Run 1 was reported to me as "completed (exit code 0)" while Playwright had exited 1, because the command ended in an `echo` that always succeeds and the harness reported the compound status.
I noticed only because the output said "4 failed" while the notification said 0.
`verify-task`'s rule is that `pass` comes from the exit code and the om-reviewer audits those codes rather than re-running the suite, so a log filled this way would be internally consistent and simply wrong, and on a genuinely green run nobody would ever look.
The shape that avoids it is `EXIT=$?` immediately after the command with nothing in between, and the value recorded from there.
This has been true of every round of every task, not just this one.

**The e2e token is scoped per project and memory is per machine.**
Two of the three attempts were ruined by another project building on the same host: `auvral/.workspaces/0042_docs_api_base_url`, 1.7 GB, started inside a granted slot.
Standing my-napkin work down cannot help, because what took the memory was not my-napkin.
The measured cost of one uncontended run, from `memory-sample.sh` in the workspace: floor 1012 MB from a 2851 MB start, so about **1.8 GB of headroom consumed**, dev server peaking at 1425 MB and the chromium tree at 892 MB, both summed RSS and therefore upper bounds.
That number, not a runner count, is what a token should gate on.

A consequence of that fix, which nobody was aiming at and which is worth stating precisely rather than generously.
`verify-task` already redirects each step to its own file, so the artefacts exist; that is the skill's shape, not an audit anyone designed.
What turns an artefact from a transcript into something checkable is that it **ends with the shell's own `$?`**, so the block's claim and the shell's claim can be compared and can disagree.
After the exit-code fix that is true of exactly two files in this round, `app-e2e-run2.out` and `app-e2e-run3.out`.
It is not true of `app-e2e.out` from the first attempt, whose exit code went to the harness instead of the file, and it is not true of any lint, typecheck or unit artefact, none of which carries a code at all.
So the log's other exit codes remain my testimony, checkable only against output that has to be read and interpreted.
If this becomes a requirement, the property to require is that **every** step's artefact ends with the shell's `$?` and the block is derived from it, not that artefacts are written, which yields two testimonies and the appearance of a check.

One smaller thing, recorded because the artefact is the om-reviewer's evidence rather than my testimony: writing this round's log I filled the `deploy` line from the previous invocation instead of from a command just run.
I then ran it for real, exit 0, so the line is true, and `verify.log` carries a note saying it was true by luck rather than by evidence when written.
A correction that quietly made the line true would have left an accurate and unreliable log, which is worse than a wrong one, because nobody would have had reason to look.

#### Documentation agreed while waiting for the machine

Drafted and accepted by the om-reviewer during the wait, and written here first rather than into the documents, because a documentation commit ahead of a verified round would have to be redone, and because a session that is stopped loses everything it did not put on disk.
All four were written into the documents on the clean signal; what follows is the text as agreed, and the section after it records what the pass actually did.

`docs/PRD.md`, new capability, in the file's voice and with no mention of phases:

> ### Libraries (module `app`)
>
> The user keeps his own libraries of reusable drawings and edits each one as a canvas like any other: every frame he draws in it is one item, and the frame's name names the item.
> Libraries are global and each diagram links the ones it wants, so a panel in the editor shows one section per linked library and a click or a drag copies an item into the drawing.
> He adds a selection from any diagram to a library as a new frame, imports a `.excalidrawlib` from the sidebar or by dropping it on the canvas, and exports any library back to the same format.
> An inserted item is a copy: editing or deleting the library afterwards leaves every drawing that used it untouched.
> Details: [modules/app/prd.md](modules/app/prd.md)

`docs/PRD.md`, cross-cutting rule, **which this task makes false and which Sebastian has to accept**.
The rule promises the editor does not diverge from the package's behaviour, and acceptance 5 is a deliberate divergence.
The om-reviewer cited this same line at consolidation when he put the `UIOptions` problem to Sebastian, Sebastian agreed to the divergence, and nobody amended the rule, so it has been false since phase 3 was approved and three documentation passes went over the file without catching it.
It goes in the PR's `Decisions` immediately under the scope paragraph, because it is the same conversation in the product's own voice.

> The editor is the upstream Excalidraw package, unmodified, and the product does not diverge from its behavior with one exception: the package's own library is hidden and replaced by the product's, so libraries live with the diagrams rather than in the browser.

`docs/PRD.md`, `Open questions`, the image limitation.
That section is in practice the product's list of known constraints rather than open questions, since both existing entries are settled limitations stated plainly, so this belongs beside them rather than in `Not in the product`, which lists excluded features rather than limits of shipped ones.
Without it the only record of this limitation is a debt entry in `ard.md`, read by people working on the code and never by someone asking what the product does.

> A library item carries no image; a frame holding one says so and the item is skipped.

`docs/PRD.md`, `Not in the product`, two entries from the task's own `Out of scope`: publishing to or syncing with libraries.excalidraw.com, and sharing libraries.

#### Documentation written

`docs/modules/app/`: `prd.md` gains "Draw with a library", the panel's nine points including that the package's own library is not offered; `trd.md` gains `library-cache.ts` and `library-panel.tsx` and widens `library-io.ts` to the one import producer both doors use; `database.md` gains the invariant that `libraryIds` is the only reference a diagram holds to a library and that an inserted item names nothing a library owns; `README.md` stops calling the panel "still being built"; `ard.md` gains four entries.
`docs/ARD.md` gains two debt rows and nothing else.
`flows.md` untouched: this phase added no flow that deserves a diagram, the insert being one gesture and one `updateScene`.

`docs/PRD.md` was written too, and it is worth naming that `document-task` reserves that file for the om-manager while `task.md#Scope` assigns it to this task.
I followed the task and the om-reviewer's instruction and wrote it: the capability line, the two `Not in the product` entries, the image limitation under `Open questions`, and the cross-cutting rule.
If the skill's ownership rule is the one that should win, the om-reviewer can take that file out of this commit; the rest of the documentation does not depend on it.

**The cross-cutting rule is the one thing here Sebastian has to accept rather than read.**
`docs/PRD.md` promised that the editor does not diverge from the package's behaviour, and this task deliberately diverges.
It has been false since phase 3 was approved, not since it was built, and three documentation passes went over that file without catching it.
It is now worded as the promise plus its single exception, and it belongs at the top of the PR's `Decisions` with the scope paragraph.

#### Two findings that are not this phase's and must not read as its debt

Neither is in the debt index, because neither is debt this task created.
Both are against 0011's surface and belong to a task of its own.

- **A full list refetch inside the consistency window of a create can be read as a deletion.**
  `list()` in `dynamo.ts` is a paginated `ScanCommand` with no `ConsistentRead`; `setItems(loaded)` replaces the list wholesale; `reload()` sets loading without clearing items; and the tab bar's reconciliation treats an id absent from `items` as deleted and calls `router.replace`.
  Every link exists in the code and **the sequence has not been observed**: the realistic path is creating a diagram and then reloading the page before the scan catches up, since the optimistic paths cover the create itself.
  Rare, recoverable, real.
- **One unexplained observation of a missing tab**, seen once in four screenshot passes: the editor showed a diagram open with no tab for it.
  Three candidate mechanisms and no evidence choosing between them: the render dropping a tab whose item is missing in the `failed` case, the consistency window above, and `openTab` replacing a preview tab in place rather than appending.
  The retake showed three ids and three rendered, so the window was not hit rather than closed, and the reads that would have discriminated were not taken at the time it occurred.
  The accent bar being plainly visible on the retaken dark shot rules out the one theory that would have been worse, that the active tab is unreadable in dark mode.

## Result
