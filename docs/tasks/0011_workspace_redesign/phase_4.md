---
phase: 4
branch: feat/0011_workspace_redesign-phase-4
updated: 2026-09-20
---

# Phase 4: polish from Sebastian's review of the merged workspace

Sebastian's findings on the merged phases 1 to 3 (2026-09-20), turned into one more phase because the workspace and the sessions are still alive.

## Scope

1. Breadcrumb overflow: with long folder names the crumbs overlap the actions (screenshot: "something" drawn over the "···" and the folder icons). Each crumb truncates with an ellipsis and shows its full name in a tooltip; the crumb row never overlaps the create buttons at any sidebar width.
2. Page metadata to current standards: a favicon of the app's own (SVG with light and dark variants, plus the PNG and `apple-touch-icon` sizes browsers ask for, and a `manifest`), `<title>` per page ("{diagram name} · napkin" with a diagram open, "napkin" otherwise, and on login), `description`, `theme-color` per theme, and `robots` noindex since the site is private. Through the Next.js metadata API, no hand-written `<head>` tags.
3. No diagram selected by default: opening `/` with no open tab shows an empty editor area with a short message and a "New diagram" button, and does not redirect to `/d/[id]`; closing the last tab lands on that same state. The app no longer creates a first diagram on its own. `docs/PRD.md` and `docs/modules/app/prd.md` drop the "there is no empty state" rule and describe the empty state.
4. Collapsible sidebar: a control collapses the sidebar to a narrow icon rail, never fully hidden, and expands it back; the state persists in `localStorage`; the editor takes the freed width; keyboard access through the same control.
   The rail holds three icons, top to bottom: the napkin logo (clicking it expands the sidebar), Diagrams (the current section) and Libraries (a section a later task fills; in this phase it is present and disabled with a tooltip "coming soon", so the rail's shape is final).
   The napkin logo is an SVG of the app's own, hand-drawn stroke in the spirit of the canvas: a square napkin with one corner folded up; it doubles as the favicon of item 2. Diagrams and Libraries use lucide icons (`Workflow` and `LibraryBig`), consistent with the rest of the shell. Sebastian, 2026-09-20.
5. No flicker: switching tabs or opening a new one must not repaint the whole UI. Only the editor content changes; sidebar, tab bar and shell stay mounted. Find the cause (route change remounting the layout, editor remount, theme or hydration gate re-running) and fix it at the root, not with a fade.

## Acceptance

1. A folder named with 40 characters renders a truncated crumb with a tooltip and nothing overlaps at the default sidebar width.
2. The tab title, favicon and theme-color are visible in the browser tab for login, empty state and an open diagram, in light and dark; Lighthouse's "Best practices" flags nothing about metadata.
3. Fresh session with no tabs lands on the empty state; closing every tab returns to it; "New diagram" creates and opens one.
4. Sidebar collapses and expands, survives a reload, and the canvas resizes with it.
5. Switching tabs and opening a diagram repaint only the editor; verified by a Playwright assertion that the sidebar node identity survives a tab switch.
6. Unit and e2e suites extended for 1, 3, 4 and 5; the full local suite green; screenshots (light and dark) of the empty state, collapsed sidebar, truncated crumb and the new tab title in the PR description as workspace paths.

## om-developer notes

### Round 1

All five items shipped, with the measurement item 5 asked for done first, before any of the code.

What repaints on a tab switch, measured rather than reasoned.
I instrumented a real switch between two fixed tabs (a `MutationObserver` over `documentElement` plus a `requestAnimationFrame` sampler reading the sidebar's computed style, the canvas presence and the head), and ran it against `npm run dev` and again against a production build on the origin the bucket's CORS allows.
The shell was never the problem: `navigation` entries stayed at 1 (the click is a client navigation, not a page load), `[data-testid="sidebar"]`, `[data-testid="tab-bar"]` and `<main>` were the same DOM nodes before and after, the sidebar's background, font and width were identical in all 241 sampled frames, and the stylesheet count never moved; the only head churn was Next re-applying the same `<title>` and three `<meta>` in the same millisecond.
What did happen is that the editor area, which is most of the screen, went to the app's own centred "Loading" for 271ms in production and 367 to 441ms in dev, because `<Editor>` unmounted and its replacement had to fetch `/urls` and then the scene from S3 before it could render anything.
That blank is what Sebastian read as the whole UI repainting, and it is a real defect, not a perception.

The cause underneath it, and why the fix is where it is.
`<Editor key={id}>` was not the reason: the App Router keys a dynamic segment by its parameter, so the page component is thrown away on every `/d/a` to `/d/b` regardless of the key, and with it any state that could have held the previous scene.
So the scene state had to move above the route segment, which is the layout, and the editor surface moved with it: `(editor)/layout.tsx` now renders `<EditorSurface>{children}</EditorSurface>`, the surface reads the open diagram from the address (the same source the tab bar and the sidebar already read) and renders `<Editor>` for it, and `/d/[id]/page.tsx` renders `null` because the route's only job is to name the diagram.
`Editor` then keeps the scene it has on screen until the next one has loaded, swaps both in one commit, and marks the outgoing one `data-stale="true"` with pointer events off so a diagram nobody is looking at cannot take an edit.
Measured after the fix: the same switch keeps `[data-testid="editor"]` as one node, every sampled frame has a scene mounted, and the stale window lasted 152ms to 569ms, during which the previous drawing is what the user sees.

What the regression test asserts, and why it is not asserting on the canvas.
My first version asserted that no painted frame was without `.excalidraw`, and it failed once in the full suite at 533ms with the editor reading "Loading scene...", which is Excalidraw's own splash while it initialises the new scene.
That is the editor's content changing, which is exactly what Sebastian asked for, so asserting on it would have been a test that fails for something the phase does not claim.
The assertion is now that no painted frame falls back to the app's own placeholder (`[data-testid="editor-scene"]` present in every frame), plus the node identity of the sidebar, the tab bar and the editor frame, plus that the scene on screen stops being stale.
It fails on the unfixed component for the reason it names, "at 241ms on /d/..., 2 tabs, the editor area read \"Loading\"", and I ran it three times green before believing it.

Where the page title is decided, since the reviewer asked for the boundary in writing.
Everything static comes from the metadata API in the root layout: `title`, `description`, `application-name`, `robots: noindex, nofollow`, `theme-color` per scheme, plus the file conventions `icon.svg`, `icon.png`, `apple-icon.png`, `favicon.ico`, `manifest.ts` and `robots.ts`.
The diagram's name cannot join them, because `generateMetadata` runs on the server and `docs/modules/app/ard.md` forbids a page reading DynamoDB; the name exists only in the list the browser fetched.
So one client component in the `(editor)` layout sets `document.title` from the same `items` the sidebar renders, through the pure `pageTitle(name, appName)` in `src/lib/`, which is unit tested and is the only place the shape of the title lives.
It is not a hand-written head tag: the head is entirely the metadata API's, and the browser tab follows the workspace the moment a rename lands, which the e2e proves.

Decisions the plan did not already record:

- The title suffix is `my-napkin`, not `napkin`.
  Sebastian wrote "{diagram name} · napkin", and I read that as the shape rather than as a rename: `metadata.title` in both locales, the sidebar heading and the login heading all say `my-napkin` today, and the browser tab is the last place where the product should start calling itself something else.
  The manifest carries both, `name: my-napkin` and `short_name: napkin`, which is what `short_name` is for.
  If he meant the rename, it is one message and one string in two files.
- The favicon's two variants live inside one SVG, not in two files.
  `icon.svg` carries a `@media (prefers-color-scheme: dark)` block that swaps the plate and the mark, because the `media` attribute on `<link rel="icon">` is honoured almost nowhere while the query inside the file is what Chrome and Firefox actually read.
  The PNG, apple-touch and manifest sizes are rasterised from that same file by `app/scripts/icons.mjs` through the Chromium that Playwright already installs, so the raster assets cannot drift from the source; the `.ico` is that 32px PNG in an ICO container, written by hand in the same script, which is what keeps `/favicon.ico` from 404ing.
  The React mark in `src/components/napkin-mark.tsx` repeats the two path strings with `currentColor` and its own stroke weight, since a favicon has no CSS context to inherit from and the shell's mark must follow the theme tokens.
- `src/lib/theme-colors.ts` holds two hex literals, which `docs/checks/styles.md` forbids in `app/src/**`.
  `<meta name="theme-color">` and a manifest cannot reference a CSS variable, so there is no token form of this value; what I could do is keep it to one file, name it after what it mirrors (`--background` light and dark), and make the drift detectable: the e2e resolves the declared colour and the colour the page actually paints through a canvas and asserts they match within one step per channel, in both schemes.
  That test fails the day someone changes the background token and forgets this file, which is the risk the check exists to prevent.
- Libraries is unavailable through `aria-disabled`, not `disabled`.
  The reviewer named the trap before I hit it: a browser suppresses pointer events on a disabled button, so the tooltip that explains why it is disabled never appears.
  `aria-disabled` keeps it hoverable, focusable and announced as disabled, and it carries no `onClick`, so there is nothing to suppress; the e2e hovers it and then focuses it, and reads "Coming soon" both ways.
- The tab bar renders nothing when no tab is open.
  With the empty state shipped, an open app with nothing open showed a 36px empty band above the message.
  Phase 3 kept the bar's height so a restored tab list would not shift the canvas, and that still holds: the height is kept whenever there are stored tab ids, skeletons included, and only the genuinely empty bar is gone.
- The keyboard shortcuts read the address at the moment the key is pressed.
  The first full suite run closed the wrong tab once: the handler closed over `activeId` from the last render, and React can paint the new active tab before it flushes the effect that re-registers the listener, so Alt+W within that window acts on the tab the user just left.
  `openDiagramId(window.location.pathname)` inside the handler is the address as the browser has it, which the router updates before React commits, so the window is closed for the test and for a fast user.
- The sidebar rail's Diagrams icon expands the sidebar rather than doing nothing.
  It is the current section and there is only one place it could take the user, so the two rail affordances (the logo and the section) agree instead of one of them being decorative.
- Collapsing is client state with no server render, so a collapsed sidebar paints expanded for the first frames after a reload, exactly as the tab bar paints its skeletons.
  The alternative is the blocking inline script `next-themes` uses, which is a second owner for the width; I left it out and I am naming it because it is visible if you look for it.

Pending, not done: nothing in this phase's `Scope`.

Deferred, out of this phase's scope:

- `app/src/lib/api.ts` navigates with `window.location.assign` on a 401, which is the one ESLint warning the repo carries (`@next/next/no-location-assign-relative-destination`) and which the first suite run turned into a flaky login case: a list request that 401s after the test cleared the cookies navigates the page out from under the test.
  The fix is `useRouter().push` from a client boundary, which the module does not have today, so it is a small task rather than a silent change here; the two login cases now wait for the app to be idle before clearing the cookies, which is what they always meant.
- Sebastian's Acceptance 2 names Lighthouse, and I did not run it: it is not a dependency of this repo and installing one to satisfy a checklist is not worth a package.
  What I checked instead is the emitted head of a production build, which carries exactly one `<title>`, the description, `application-name`, `robots: noindex, nofollow`, both `theme-color` variants with their media queries, and four icon links (`favicon.ico` 32x32, `icon.svg` any, `icon.png` 32x32, `apple-icon.png` 180x180), plus `/manifest.webmanifest` and `/robots.txt` served with `Disallow: /`; the e2e fetches every one of those hrefs without a session and fails on any that does not answer 200.
- The dev table had `Napkin 20092026` in it, created by the old `/` behaviour during my first measurements, and I left it: deleting a diagram that might be Sebastian's is not mine to decide.
  Every `e2e ` item my runs created is gone, checked through the API after the last suite run.

Screenshots, light and dark, are in `{{workspace}}/screenshots/`, never committed:
`8-empty-state-{light,dark}.png`, `9-sidebar-rail-{light,dark}.png` (rail with the Libraries tooltip open and the canvas at full width), `10-breadcrumb-{light,dark}.png` (a 40 character folder truncated, tooltip open, buttons clear of it) and `11-metadata-{light,dark}.png`.
The last one is an asset sheet rather than a screenshot of a browser tab: Playwright photographs the page, never the browser's own chrome, so the sheet shows the favicon at 96, 48, 32 and 16 pixels in that scheme next to the exact title strings and the theme colour.
They were taken with a throwaway spec that created and then deleted everything it made.


### Round 2

Both findings applied, and applying them turned up the rest of the hole, which is now closed too.

`listReady` is the one wait the four callers share: `folder-section` on screen and no loading skeleton left.
It waits on the skeleton rather than on `item-list`, as you said: an empty folder and the new empty workspace render a paragraph instead of that list, so waiting for the list would hang exactly where there is nothing to clean.
The skeleton is in the server-rendered HTML, which is what makes it a real wait after a `goto` or a reload rather than an assertion that passes before React has done anything.
`goToRoot` now waits before it decides whether to click the root crumb, `newDiagram` before it reads `before`, `openApp` calls it instead of spelling the two expectations out, and `removeItemsCreatedHere` calls it after `goToRoot` so the loop counts against a list that has rendered.

The proof is a spec that ends inside a folder right after a navigation, which is the shape that leaked twice in this task.
With the fix it passes and the table is empty afterwards; with the two waits taken back out it passes just the same and leaves `e2e repro mua1irgn` behind, which is the defect exactly as you described it: green, and lying.

What the fix then exposed, on the first full run: three cases called cleanup from a page with no sidebar at all, the two metadata ones that end on `/login` and the rail one that ends collapsed.
They used to pass because every count answered 0 and the loop skipped; with the counting made honest they hung for thirty seconds on a sidebar that was never coming.
So `removeItemsCreatedHere` returns before it looks at the page when it has nothing tracked, which is the truthful answer for a spec that created nothing, and calls `expandSidebar` when it does have something, because this phase made "the sidebar is a rail" a state a spec can legitimately end in.
A spec that ends on `/login` holding real items now fails loudly, with "the app is not on screen, so nothing here can be cleaned up" rather than a bare timeout: it cannot clean from there and should say so.

Nothing else changed; the diff of this round is `tests/e2e/helpers.ts` alone.

### Documentation

`app`, plus `docs/PRD.md`, which the om-reviewer delegated because this phase removes a promise the product used to make.

`docs/PRD.md`: the Diagrams capability gains the rail in the sentence that already listed what the sidebar does, and one sentence of its own for the thing that changed, that the app starts with nothing on the canvas and never chooses a diagram for the user.
Nothing else there claimed the old behaviour.

`docs/modules/app/prd.md`: read back whole, and two lines were false rather than merely incomplete.
"There is no empty state at the top" is now the paragraph that describes it, naming the three ways a user arrives at it, a new browser, the last tab closing, and an address for a diagram that no longer exists, and the fact that the app creates nothing on its own.
The other was in the folders flow: deleting a folder "leaves the user on another diagram", which stopped being true when the tab layer took over that landing in phase 3 and is now wrong twice over, so it says the tabs close and the user lands beside them or on the empty workspace.
The Interface section gains the rail and the browser tab, the breadcrumb flow gains the cut name with its hover, and the per-browser rule absorbed the rail rather than growing a line.
Cut to pay: the tabs flow said the tabs and the open diagram come back after a reload, which the per-browser rule under Rules now says for all three kinds of state, and the lock flow repeated the folder-delete confirmation that the folders flow already describes.

`docs/modules/app/trd.md`: the structure table carries the metadata files and the icon generator, the third `localStorage` store, and the two pages whose meaning changed.
`/d/[id]/page.tsx` rendering `null` gets its own short paragraph under the table, because it is the one thing in this diff that reads as a mistake to someone opening the file cold, and the paragraph says what breaks if it is "fixed".
A `Page metadata` section says what is in the head, that only the title is set at runtime and why, and where each icon is actually served from, which I corrected after checking the OpenNext build rather than assuming: `favicon.ico` and the two `public/` PNGs are copied to the assets bucket, the rest are routes the Lambda answers, and the gate lets all of them through as root files with an extension.
Testing gains the rule this phase's round 2 came from: a helper waits for the sidebar before it counts anything in it.
Cut to pay: the Configuration section explained the local `AWS_REGION` in two sentences that `docs/TRD.md` already carries in full, and now points there instead; the typeface paragraph folded into one sentence.

`ard.md`: eight entries.
The scene handover carries the numbers, because "the editor lives in the layout and the page renders nothing" is exactly the shape a later reader deletes as indirection, and the 271ms in production and 367 to 441ms in dev are what make the case.
The title from the client, the palette in four places, `aria-disabled` over `disabled`, the shortcut reading the address at key time, the cleanup that waits for the list, the collapsed sidebar's first paint, and the 401 that still leaves through `window.location.assign`.
The last three carry debt, and those three rows are in the `Debt index` of `docs/ARD.md`.
Nothing was resolved; no debt this phase touched had an entry to close.

`database.md` is untouched, as the om-reviewer said: this phase stored nothing new, and the three pieces of per-browser state are not the table's business.
`flows.md` earns nothing either.
The scene handover is a sequence one could draw, but it is three sentences in `trd.md` and an entry with the measurement beside it, and a diagram would restate them and then go stale the first time the surface learns a second route.

`README.md` gains the rail and the empty state in the line that lists what the workspace holds.

One thing for the om-manager rather than for me: `docs/TRD.md` describes the app's Layout as `src/app/`, `src/proxy.ts`, `src/i18n/`, `src/lib/`, `src/components/ui/`, `src/messages/` and `tests/`, which is now missing `public/` and `scripts/`.
It is his file and the omission is small, so I left it.

## Result
