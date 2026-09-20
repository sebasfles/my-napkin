---
phase: 3
branch: feat/0011_workspace_redesign-phase-3
updated: 2026-09-19
---

# Phase 3: tabs

## Scope

- Tab bar above the editor: single click opens a preview tab (italic) replaced by the next single click; double click or an edit promotes it to fixed; close button per tab.
- Keyboard: Alt+1..9 jump, Alt+Shift+Left/Right cycle, Alt+W close; bindings do not fire while Excalidraw owns the key.
- Open tabs, the preview tab and the active tab persisted in `localStorage`; a tab whose diagram was deleted closes itself; a tab whose diagram was renamed updates.
- The open diagram is highlighted in the sidebar and its path shows in the breadcrumbs.
- Pure tab reducer in `src/lib/` with unit tests; Playwright spec for tabs.

## Acceptance

1. Task acceptance 6, 7, and 9 for this phase's flows.
2. Task acceptance 10 completed: PRD and app module docs describe the final product.
3. PR description carries screenshots, light and dark, of the tab bar with a preview and fixed tabs.

## om-developer notes

### Round 1

Built: the tab bar above the editor with preview and fixed tabs, close by button and by keyboard, Alt+1..9, Alt+Shift+Left/Right and Alt+W, the tab list persisted per browser, and a reconciliation that closes the tab of a diagram the list no longer holds.
Everything in this phase's `Scope` shipped; the full suite is green on its first run, 51 e2e against dev, five of them new.

Where the keyboard listens, and what it claims.
The handler is one `keydown` listener on `window` in the capture phase, so it runs before anything the editor binds: capture reaches `window` first on the way down, and `stopPropagation()` there ends the trip before `document` or the canvas sees the key.
It claims a chord only on an exact match (Alt held, Ctrl and Cmd not) and then calls `preventDefault()` and `stopPropagation()`; on anything else it returns having done nothing at all, so no editor binding is stolen by accident.
The match reads `event.code`, never `event.key`: Alt rewrites `key` on several layouts (Option+w is a sigma on a Mac), while `KeyW` and `Digit1` are the physical keys the user pressed.
I checked the editor's own bindings before choosing: it binds Alt with H, R, S, V, Z, C, F, the brackets and Shift+D, and nothing with a digit, an arrow or W, so the three bindings collide with none of them today, and capture decides in our favour if a future version adds one.
`tabShortcut` is a pure function over the five fields of the event, unit tested for what it claims and, more usefully, for what it refuses.

What survives a restored tab list, and who decides.
`keepTabs` takes the tab ids, the ids the list actually holds and the diagram the URL has open, and answers both the tabs that survive and where the user should now be.
It runs from `items`, not from the ids `remove` returns: `items` is the one place a diagram stops existing, so the same code closes a tab after a direct delete, after a folder cascade that took several at once, and after a reload that restored a tab deleted from another browser.
A rename needs no reconciliation at all, since a tab renders the name from `items` rather than a copy of its own.
`parseTabs` treats `localStorage` as untrusted input and falls back to no tabs on anything it cannot read, which is what keeps a hand-edited or half-written value from reaching the reducer.

Decisions the plan did not already record:

- The active tab is the URL, not a third field in the stored state.
  `/d/[id]` already says which diagram is open, and Acceptance 6 asks that the active tab survive a reload, which it does because the URL does.
  Storing it again would give the same fact two owners that can disagree, and the one frame after a reload where they do is exactly when the tab bar would highlight the wrong tab.
  So `localStorage` holds `{ ids, previewId }`, and every reducer function that needs the active tab takes it as an argument and answers where to go next.
- The sidebar no longer navigates when a delete takes the open diagram; the tab layer does.
  `Context & decisions` sends the user to `/` there, and that still happens when the deleted diagram was the only tab, but with tabs open the honest landing is the tab beside the one that closed.
  Two components navigating on the same event is a race, so the one that owns the tab list owns the answer, and `closeTab` and `keepTabs` compute it the same way: the tab on the right, then the one on the left, then nothing.
- An edit fixes the preview tab through the saver's first status report, not through a second notion of "changed".
  `SceneSaving` already reports when a scene write starts, and that report is only made after the saver's opening reconciliation has absorbed the editor's first `onChange`, so it means the same thing the rest of the app means by edited: `updatedAt` is about to move.
  The consequence worth naming is that panning or zooming fixes the tab too, because the app already saves and timestamps those; a locked diagram mounts no saver, so it can never promote itself.
- Every reducer function returns the state object it was given when nothing changed, and the store writes only when the object is new.
  The store notifies subscribers on every write, so a reducer that always built a new object would turn each of the two synchronising effects into a render loop.
  It is the one property of `tabs.ts` that the component depends on and cannot check, so `keepTabs` has a test on the identity, not just on the value.
- The bar lives in the `(editor)` layout, above `{children}`, so it survives navigation between diagrams, and it keeps a fixed height with a skeleton per stored tab while the list loads.
  Rendering nothing until `items` arrive would move the canvas down a row on every load, which is the layout shift Acceptance 1 rules out for the typeface and is no more acceptable here.
- `openDiagramId(pathname)` moved into `src/lib/diagrams.ts` because the sidebar and the tab bar both needed it and had it twice.
- Closing the last open tab lands on `/`, which opens the most recently edited diagram as a fresh preview tab.
  The app has no empty editor state and `/` has meant "open the newest" since phase 1; inventing a blank screen for the one case where the user closed everything is a surface nobody asked for.

Accepted, and worth the om-reviewer's eye:

- Single click, double click and an edit all reach the reducer from different places: the pathname effect for the click, `onDoubleClick` on the sidebar row and on the tab itself for the double click, and the editor's status report for the edit.
  They are three events with one meaning each, and the component holds no tab logic of its own.
- The preview tab is replaced in place, at its own index, so opening a diagram never reorders the fixed tabs around it.

Pending, not done: nothing in this phase's `Scope`.

Deferred, out of this phase's scope:

- The sidebar's relative time can read "in 3 seconds" right after a save.
  `UpdatedAtLine` formats against `useNow()` with no update interval, so `now` is the time the page was server rendered and a diagram saved after that lands in its future.
  It is phase 1 code, the fix is `useNow({ updateInterval })` there, and it is visible in this phase's screenshots, so it is worth a retake or a small task rather than a silent change in the last round of this one.
- `docs/` is untouched, as the rounds require.
  `document-task` writes the module docs, `docs/PRD.md` and the three `docs/TRD.md` lines the om-manager delegated on the clean signal, which is where task Acceptance 10 completes.

Screenshots, light and dark, are in `{{workspace}}/screenshots/`, never committed: `7-tab-bar-light.png` and `7-tab-bar-dark.png`, three tabs with the active one fixed, a second fixed tab and a preview tab in italic.
They were taken with a throwaway spec that created, renamed and then deleted its three diagrams through the app's own UI; the spec is gone and the dev table holds nothing of it.

### Round 2

The finding applied, and it was two defects as you read it, with one more turn to it than either of us wrote down.

I reproduced both before touching the component, since the row I had deferred was not the one that shows the lie.
A row whose time line is mounted *after* its save reads correctly: `UpdatedAtLine` and `SaveStatusLine` are different components in the same slot, so the line remounts when the indicator hands the row back, and `useNow` seeds from that moment.
The rows in the screenshots were the other case: draw, then leave before the save lands.
The line remounts on the navigation, the `PATCH` answers two or three seconds later, `markSaved` writes an `updatedAt` past a `now` that will never move again, and the row settles on "in 3 seconds" for the rest of the session.
A probe spec printed "in 3 seconds" and then the same string five seconds later, which is both defects in one reading.

`useNow({ updateInterval: 30_000 })` fixes the one you named second: the row ages now, instead of saying "4 hours ago" all evening.
It does not fix the first, and I checked rather than assumed: with the interval in and the clamp out, the regression spec failed 49 polls in a row on "in 3 seconds", because the interval bounds how long the falsehood lasts, it does not stop the row claiming the future in the meantime.
So the line also formats against `Math.max(now, updatedAt)`.
A row describing an edit cannot honestly sit before the edit it describes, and clamping to that floor is true for the real cause here and for the other one that produces it, a browser clock a second or two behind the server that stamped `updatedAt`.
Together: the clamp makes the future impossible, the interval makes the past keep moving.

The regression is `diagram-list.spec.ts`, "never says a diagram was edited in the future": it draws, creates the next diagram without waiting for the save, and asserts the row's own time line, which now carries `data-testid="updated-at"` because asserting on the whole row would have matched the diagram's name instead.
It fails on the unfixed component for the reason it names, and I ran it that way before restoring the fix.

`7-tab-bar-light.png` and `7-tab-bar-dark.png` were retaken: the three rows that read "in 3 seconds" now read "now".

## Result
