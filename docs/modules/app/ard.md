---
updated: 2026-09-20
source: 0011_workspace_redesign
---

# app: architecture decisions

## 2026-09-17: Embed the npm Excalidraw package instead of forking

- Decision: the editor is the `@excalidraw/excalidraw` npm package embedded in a custom app, not a fork of the Excalidraw repo.
- Alternatives rejected: forking the Excalidraw repository.
- Reason: it is the same editor as excalidraw.com, and updating it is just bumping the package version.
  MIT license allows a custom domain, changes and private use, as long as the LICENSE file is kept.
- Debt created: none.
- Revisit when: a feature is needed that the published package does not expose.
- Source: setup

## 2026-09-17: Presigned S3 upload instead of routing scenes through the Lambda

- Decision: the browser uploads the scene JSON directly to S3 with a presigned PUT URL; the app Lambda never receives the scene content.
- Alternatives rejected: sending the scene through an API route.
- Reason: Lambda requests are capped at 6 MB, and a scene with pasted images can exceed that.
- Debt created: none.
- Revisit when: never, unless the hosting model moves off Lambda.
- Source: setup

## 2026-09-17: Password auth in middleware instead of Cognito

- Decision: authentication is one password in the `APP_PASSWORD` env var, checked in Next.js middleware, with a signed session cookie.
- Alternatives rejected: AWS Cognito.
- Reason: Cognito needs an ALB or its Hosted UI integrated, not worth it for a single user.
- Debt created: no per-user accounts, no password rotation or recovery flow.
- Revisit when: a second user is needed.
- Source: setup

## 2026-09-17: files saved with the scene

- Decision: `onChange(elements, appState, files)` saves `files` as part of the same scene JSON.
- Alternatives rejected: saving only `elements` and `appState`.
- Reason: without `files`, pasted images are lost on reopen.
- Debt created: none.
- Revisit when: never.
- Source: setup

## 2026-09-17: Excalidraw loaded client-side only

- Decision: the Excalidraw component is loaded with `next/dynamic` and `ssr: false`.
- Alternatives rejected: server-rendering the editor.
- Reason: Excalidraw uses `window` and canvas APIs not available during server rendering.
- Debt created: none.
- Revisit when: never.
- Source: setup

## 2026-09-17: The editor's language is a mapped code, not the app locale

- Decision: `src/lib/editor.ts` maps the app locale to the `langCode` the editor takes, and `es` becomes `es-ES`.
- Alternatives rejected: passing the app locale straight through.
- Reason: the package ships `es-ES` and no bare `es`, so a passthrough makes the editor fall back to English while the rest of the interface is Spanish, and nothing fails loudly.
- Debt created: none.
- Revisit when: the package ships a bare `es`, or a third locale is added.
- Source: 0001_repo_base

## 2026-09-17: Theme-dependent client components render from a hydration gate

- Decision: components whose output depends on the resolved theme read `useHydrated()` (`src/lib/use-hydrated.ts`, a `useSyncExternalStore` gate) and render the light branch until the client has hydrated.
- Alternatives rejected: the `useState` plus `useEffect` mounted flag; rendering the theme directly and accepting the mismatch.
- Reason: `next-themes` only knows the real theme on the client, so rendering it during SSR mismatches on hydration; the mounted flag is the documented workaround but the `react-hooks/set-state-in-effect` lint rule rejects it, and silencing that rule in the baseline would licence it everywhere.
- Debt created: none.
- Revisit when: `next-themes` exposes the resolved theme during server rendering.
- Source: 0001_repo_base

## 2026-09-17: shadcn/ui on the radix base, as the CLI generates it

- Decision: components are added with the shadcn CLI using the radix base and the nova preset, and `src/components/ui/` is kept exactly as generated, including the `cn` package it imports instead of `clsx` plus `tailwind-merge`.
- Alternatives rejected: the default `base-nova` preset on `@base-ui/react`; hand-writing the classic setup.
- Reason: keeping the generated form is what makes `shadcn add` usable in later tasks, and it is the form the `styles` check treats as clean; the radix base is the lighter of the two the CLI offers.
- Debt created: `components.json` pins the preset, so a later component added with different flags would not match the ones already in the tree.
- Revisit when: the CLI drops the radix base, or a design system with its own tokens replaces the shadcn defaults.
- Source: 0001_repo_base

## 2026-09-17: Two Next 16 development defaults turned off or moved

- Decision: `next.config.ts` sets `agentRules: false` and `devIndicators: { position: "bottom-right" }`.
- Alternatives rejected: leaving both at their defaults; `devIndicators: false`.
- Reason: Next 16 writes its own `AGENTS.md` and `CLAUDE.md` into `app/` on every dev run, which collides with the repo's own `AGENTS.md`; and its dev indicator renders bottom-left, exactly over the sidebar's two toggles, where it intercepts their clicks. Moving the indicator keeps the build-activity signal that disabling it would lose.
- Debt created: none.
- Revisit when: the sidebar's controls move away from the bottom-left corner.
- Source: 0001_repo_base

## 2026-09-17: npm install scripts are allowed by an explicit pinned list

- Decision: `app/package.json` carries an `allowScripts` block naming `esbuild`, `@swc/core`, `unrs-resolver` and `@parcel/watcher`.
- Alternatives rejected: approving the scripts interactively on each machine; trusting the platform optional dependencies to work without their postinstall.
- Reason: npm 11.19 blocks install scripts by default, and without the list `npm ci` on a fresh clone or in CI leaves those packages without their native binaries.
- Debt created: the keys are pinned to exact versions, so bumping any of the four silently re-blocks its install script.
- Revisit when: npm makes the allowlist version independent, or a dependency bump fails for a missing binary.
- Source: 0001_repo_base

## 2026-09-17: The editor's transitive advisories are accepted

- Decision: the 9 advisories `npm audit` reports, all transitive under `@excalidraw/excalidraw` through `@excalidraw/mermaid-to-excalidraw`, are accepted as they are.
- Alternatives rejected: `npm audit fix --force`; overriding the transitive versions; dropping the editor's mermaid support.
- Reason: 0.18.1 is the latest published editor, so nothing in this repo resolves them, and the force fix only downgrades the editor itself. They are reachable through the editor's own mermaid import, which this app adds nothing to, on a single-user private site.
- Debt created: 9 open advisories (7 moderate, 2 high) that no action here can clear.
- Revisit when: the editor publishes a release that bumps the mermaid chain.
- Source: 0001_repo_base

## 2026-09-18: One unit-tested function decides what is public, not a matcher

- Decision: `src/proxy.ts` exports no `config.matcher`; `isPublicPath` in `src/lib/gate.ts` is the only place that says what a request may reach without a cookie, and it allows exact `/login`, `/api/login` and `/favicon.ico`, the `/_next/` prefix, and root-level paths carrying an extension (`/robots.txt`), which is what `public/` serves.
- Alternatives rejected: a `config.matcher` regex excluding `/_next` and the login routes, with the rest checked in code.
- Reason: a matcher beside the function is two allowlists that drift, and drift there is an authentication hole that no unit test can see, the `/loginx` and `/api/loginx` class of accident. The matcher also buys nothing real, since CloudFront serves static assets from the bucket and they never reach the Lambda.
- Debt created: none.
- Revisit when: the gate becomes hot enough in production that skipping it per path measurably matters, which it cannot while static assets bypass the Lambda.
- Source: 0005_password_auth

## 2026-09-18: Web Crypto for both the session signature and the password comparison

- Decision: `src/lib/session.ts` signs and verifies with `crypto.subtle` HMAC-SHA256 over the payload string exactly as received, and compares the password as two SHA-256 digests, byte by byte, instead of using `node:crypto.timingSafeEqual`.
- Alternatives rejected: `jose` or a JWT library; `node:crypto` with `timingSafeEqual`.
- Reason: there are no claims to carry, so a JWT library is a dependency for nothing. One Web Crypto path runs unchanged in the gate and in the route handlers whatever runtime Next puts them on, and comparing fixed 32-byte digests is constant time whatever the length of what the visitor typed, which comparing the raw strings would not be.
- Debt created: none.
- Revisit when: the session needs to carry claims, or a rotation scheme needs more than one secret.
- Source: 0005_password_auth

## 2026-09-18: The Playwright config demands the signing secret only when it starts the server

- Decision: `playwright.config.ts` requires `APP_PASSWORD` always and `SESSION_SECRET` only when no `BASE_URL` is set, that is only when it starts `npm run dev` itself.
- Alternatives rejected: requiring both always; requiring neither and letting the suite fail at the first request.
- Reason: with `BASE_URL` set the test process starts no server and the deployed app holds its own secret, and `e2e-dev.yml` passes only `BASE_URL` and `APP_PASSWORD` from the `dev` environment, so demanding both would fail the promotion PR for a variable nobody there needs.
- Debt created: a spec cannot forge a session cookie when it runs against a deployed environment, so the expired-cookie path is proved by unit tests only; the e2e suite proves the tampered-payload path instead.
- Revisit when: the e2e run against dev ever needs to mint a cookie, which would mean handing CI the signing secret.
- Source: 0005_password_auth

## 2026-09-18: Playwright never adopts a dev server it did not start

- Decision: `playwright.config.ts` sets `reuseExistingServer: false`, so a busy port 3000 is a loud error instead of a server the suite silently adopts.
- Alternatives rejected: the `!process.env.CI` idiom the Next and Playwright templates ship; a per-workspace port.
- Reason: several worktrees of this repo run side by side and all of them default to port 3000, so the adopted server belongs to another branch. While only this branch has auth routes that shows up as a flood of 404s, but once every branch has them an adopted server answers correctly and the suite passes against the wrong tree, which is a green that lies on the one artifact the review rests on. In CI the flag was already false, and `e2e-dev.yml` sets `BASE_URL` and starts no server, so nothing there changes.
- Debt created: none; each local run pays a few seconds for a fresh server.
- Revisit when: the suite gets a per-workspace port, which would make adoption safe again.
- Source: 0005_password_auth
## 2026-09-18: The browser talks to `/api`, no page reads DynamoDB or S3

- Decision: every read and write goes through a route handler called from a client component; no server component or page touches either store, and the sidebar shows a skeleton while the list loads.
- Alternatives rejected: rendering the list in the `/` server component; a server action per mutation.
- Reason: one way in and out of the data, which the Playwright suite drives exactly as the user does, and pages that stay cheap to render.
- Debt created: the first paint of the list waits for a round trip, so a cold Lambda shows the skeleton for the length of its cold start.
- Revisit when: the skeleton lasts long enough to be worth server rendering the first list.
- Source: 0004_diagram_persistence

## 2026-09-18: The saver ends in two ways, `stop()` and `abandon()`

- Decision: `stop()` starts no further upload and lets one already running finish, `abandon()` writes nothing ever, and the editor abandons when the diagram was deleted and stops otherwise.
  The saver also reads a `deleted` marker the provider sets before the DELETE leaves, checked before the debounce advances and before the upload writes.
  Both are undone by `resume()`, which the effect calls on setup, because the saver lives in a `useMemo` and the stop lives in an effect cleanup, and an effect cleanup has to be undoable by the next effect run.
- Alternatives rejected: a single `stop()` that refuses every pending write; relying on the editor unmounting to know the diagram is gone; aborting the request in flight with an `AbortController`.
- Reason: the flush on unmount is what saves a change made in the last second and a half before switching diagrams, so a single stop that refuses everything trades an orphan object for the user's work.
  Unmount order cannot carry it either: the editor only unmounts after the DELETE responds, which on a cold Lambda outlives the debounce.
- Debt created: a PUT whose bytes are already on the wire when the DELETE lands can still leave a scene object no code will delete.
- Revisit when: orphan objects show up in the bucket, or a lifecycle rule is wanted to sweep them.
- Note: without `resume()` the first remount stopped the saver permanently and autosave died in silence, in production as much as in development.
  The Playwright suite runs against `npm run dev`, so React Strict Mode is part of the environment under test, and that is what made it catchable.
- Source: 0004_diagram_persistence

## 2026-09-18: Opening a diagram adopts the editor's first report as the baseline

- Decision: the first change the editor reports after a mount becomes the saved baseline when it changes no element, instead of being uploaded; from the second report on, a change that touches no element (a pan, a zoom, a background color) saves normally.
- Alternatives rejected: uploading it, which is what the plain comparison did; comparing only element versions and never the appState.
- Reason: the editor normalizes what it imports, so the scene it reports back is not byte identical to the JSON it was given, and without this every open would rewrite the scene, bump `updatedAt` and reorder the sidebar.
  Opening a diagram must not modify it, and that now holds whatever the editor's `restore()` decides to normalize.
- Debt created: the stored scene keeps the shape it was written in until a real edit rewrites it, so a scene saved by an older editor version is normalized on load, never on disk.
- Revisit when: an editor upgrade needs saved scenes migrated rather than normalized on read.
- Source: 0004_diagram_persistence

## 2026-09-18: The save machinery is a plain factory with its ports injected

- Decision: the debounce, the single upload at a time, the retry and the baseline live in `createSceneSaver`, which takes presign, put, touch, status and saved as arguments; the hook around it only wires the lifecycle.
- Alternatives rejected: putting the logic in the hook and testing it with a rendered editor.
- Reason: Vitest runs in the node environment and the project adds no jsdom, so this is what makes the timing rules testable with fake timers, which is where the save bugs live.
- Debt created: none.
- Revisit when: the app needs a second saver and the factory has to grow options instead of arguments.
- Source: 0004_diagram_persistence

## 2026-09-18: `sceneVersion` is reimplemented instead of imported from the editor

- Decision: `src/lib/scene.ts` sums the elements' versions itself rather than importing `getSceneVersion` from `@excalidraw/excalidraw`.
- Alternatives rejected: importing it; importing it lazily inside the callback.
- Reason: the editor package may only be evaluated behind the `next/dynamic` boundary, and a top level import in a module the client component loads would run it during server rendering, which is the failure the package is dynamically imported to avoid.
- Debt created: a four line copy of a function the package owns, which diverges silently if the package changes what a scene version means.
- Revisit when: the package exports it from a module that is safe to import on the server.
- Source: 0004_diagram_persistence

## 2026-09-18: One presigned pair per editor session, renewed near expiry

- Decision: `/urls` returns the GET and the PUT together with an expiry, the editor loads the scene with the GET and keeps the PUT for later saves, re-requesting the pair when it is within a minute of expiring or after a failed upload.
- Alternatives rejected: one `/urls` call per save; a long lived signature.
- Reason: a save costs one PUT and one PATCH instead of three requests, while the signature stays short lived; a failure is the signal that the URL may be the problem, so dropping it there covers clock skew and early expiry.
- Debt created: none.
- Revisit when: saves start failing for expiry despite the renewal window.
- Source: 0004_diagram_persistence

## 2026-09-18: The editor routes live in an `(editor)` route group

- Decision: `/` and `/d/[id]` sit in `src/app/(editor)/`, whose layout holds the diagram provider and the sidebar.
- Alternatives rejected: repeating the sidebar in each page; putting the provider in the root layout.
- Reason: the list is fetched once and survives navigation between diagrams, and `/login` stays outside the group with no sidebar and no list request.
- Debt created: none.
- Revisit when: a route needs the list without the sidebar.
- Source: 0004_diagram_persistence

## 2026-09-18: The theme is a three-option control, with system as a choice of its own

- Decision: the sidebar carries a `ToggleGroup` with `type="single"` and system, light and dark always visible, added with the shadcn CLI and kept as generated.
  `src/lib/theme.ts` normalizes any stored value to one of the three with `themeChoice`, which both the control and the Excalidraw prop read.
  The border sits on the options (`variant="outline"`) rather than on a container, and the selected option's colour is set where the control is used.
- Alternatives rejected: keeping the two-state toggle; a cycling button; a dropdown; a bordered container around the options.
- Reason: the two-state toggle wrote light or dark on the first click and never wrote system again, so the interface stopped following the OS until localStorage was cleared.
  Showing the three options makes the current state readable and system reachable, and the single-select group is a `radiogroup` with `aria-checked` and roving focus, so keyboard and screen reader behaviour come for free.
  The selected colour is overridden at the call site because the generated variants paint hover and selected both `bg-muted`, which leaves the selection unreadable, and the generated files stay as the CLI wrote them.
  A container with `overflow-hidden` would clip the options' focus ring, which is an outset shadow, so the border lives on the options instead.
- Debt created: the selected option's colour is fixed at the call site, so a second toggle group repeats it or diverges from it.
- Revisit when: a second `ToggleGroup` is added, or the CLI ships a variant whose selected state already differs from its hover state.
- Source: 0006_theme_three_state

## 2026-09-19: Client-side SHA-256 of the request body instead of Lambda@Edge signing

- Decision: `src/lib/signed-fetch.ts` wraps `fetch` for same-origin calls.
  It hashes the request body with `crypto.subtle.digest` (the hash of the empty string when there is no body) and sets `x-amz-content-sha256`, on every method, since a same-origin GET needs the header as much as a POST.
  It throws when the body is present but not a string, since hashing anything else would not match the bytes `fetch` puts on the wire.
  `src/lib/api.ts`'s `call()` and `login-form.tsx`'s own `fetch` both go through it; the two presigned S3 calls in `api.ts` (`loadScene`, `putScene`) do not, since they never reach CloudFront.
  No route handler answers a native form post or a Server Action, since a browser cannot set a header on either; `logout-button.tsx` became a client component for this reason.
  Nothing posts from outside the browser: the suite's `login()` in `tests/e2e/helpers.ts` used to post straight to `/api/login` through Playwright's request context, bypassing `signedFetch`, and the first `e2e-dev` run against deployed dev answered 403 to every login; since 0010 it types the password into the form, like a person, so no test code carries the header.
- Alternatives rejected: Lambda@Edge signing (SST's `oac-with-edge-signing`); setting the Function URL's auth to `NONE`.
- Reason: this app controls every POST source, so hashing client-side adds no Lambda@Edge function, no latency and no extra 1 MB body cap; `NONE` would leave the Function URL invocable outside CloudFront, which is cost and abuse surface `infra/ard.md`'s "Function URL over API Gateway" entry rejects.
- Debt created: a third party cannot compute this header, so a webhook or another caller that is not this app's own browser code cannot POST through the OAC-protected Function URL.
- Revisit when: a third party needs to POST to the app; Lambda@Edge signing is the fallback.
- Source: 0008_oac_payload_hash

## Known debt

- Scenes never go through the API, because of the 6 MB Lambda request limit.
- The scene never lives in DynamoDB, because of the 400 KB per-item limit; large scenes with base64 images would exceed it.
- Cold start of 1-2 seconds after inactivity is accepted as tolerable.
- The Lambda is not in a VPC and reaches S3 and DynamoDB over the public internet, with no NAT Gateway.
- `allowScripts` in `app/package.json` is pinned per version, so a dependency bump re-blocks its install script.
- 9 transitive npm advisories under the editor package that no change in this repo can resolve.
- The expired-cookie path is proved by unit tests only, because a spec against a deployed environment has no signing secret to forge one with.
- The theme control's selected colour is set at the call site, not in the generated variant.
- A PUT already on the wire when a delete lands can leave an orphan scene object in the bucket.
- The first paint of the diagram list waits for a round trip, since no page renders it on the server.
- A stored scene keeps the shape it was written in; the editor normalizes it on read, never on disk.
- `sceneVersion` copies four lines the editor package owns, to keep that package behind its dynamic import.
- A third-party webhook cannot POST through the OAC-protected Function URL, since only this app's own browser code can compute the payload hash.
- A presigned PUT handed out before a lock stays valid for the rest of its five minutes, so a tab that already held one can still overwrite the scene object of a locked diagram.
- A folder delete that fails partway leaves the folder half emptied and can orphan scene objects; nothing reconciles the bucket.
- A move is validated against a read of the table and then written without a condition, so two concurrent moves could build a cycle.

## 2026-09-19: the first editor paint of the suite carries an explicit 30s timeout

- Decision: `app/tests/e2e/diagram-list.spec.ts:23` asserts `toBeVisible({ timeout: 30_000 })` on `.excalidraw`, matching the `toHaveURL` one line above it. The identical pair at lines 96-97 keeps the 15s default.
- Alternatives rejected: raising `expect.timeout` for the whole suite in `playwright.config.ts`, which would slow every genuine failure to 30s; a helper wrapping the assertion, which would spread one site's problem across the file; leaving it and relying on CI's single retry.
- Reason: spec files run alphabetically and this is the first test of the first file, so it is the only `.excalidraw` assertion in the suite that waits on a cold compile of the editor route. Every other one sits behind a warm one. It failed once on exactly that, while the navigation directly above it survived because it already had 30s, which is the asymmetry this removes.
  The timeout is a ceiling, not a delay: a fast run is unaffected.
- Debt created: the twin at line 97 still carries the default, so if execution order ever changes and that test becomes the cold one, the flake moves there rather than disappearing.
- Revisit when: the suite stops running serially in file order, or a second cold editor paint appears.
- Source: 0007_deploy_workflows

## 2026-09-20: `updatedAt` moves only when the scene was uploaded

- Decision: `diagramRepository.touch` became `update(id, changes)`, and `PATCH /api/diagrams/[id]` takes one intent at a time: a name, a lock flag, or the pair `elementCount` and `sceneBytes`. Only that pair moves `updatedAt`, and a body that changes nothing answers 400 rather than writing.
- Alternatives rejected: keeping a `touch` that always moved `updatedAt` and letting the browser skip it on a rename; a separate `renamedAt` so both timestamps could live side by side.
- Reason: the sidebar is ordered by `updatedAt` and Info shows it as "last edited", so a rename that moved it both reordered the list and told the user something untrue. With one meaning, the order and the label are the same fact, and the two counters can only be written by the request that uploaded the bytes they describe.
- Debt created: none.
- Revisit when: a second kind of write needs its own timestamp, at which point the item grows a field rather than overloading this one.
- Source: 0011_workspace_redesign

## 2026-09-20: a locked diagram is refused by the server, in both places a write can start

- Decision: the scene PATCH carries `attribute_exists(id) AND attribute_not_exists(lockedAt)`, so DynamoDB refuses it atomically and the route answers 409; `/urls` signs no upload at all while `lockedAt` is set, and `sceneStore.urls(id, write)` takes that as an argument rather than signing a URL to throw away. A rename and an unlock keep the plain condition, or a locked diagram could never be unlocked. Locking waits for the open editor's saver to settle before it writes the lock.
- Alternatives rejected: enforcing the lock in the browser only, which was the first implementation; reading the item before every save to check the flag, which costs a read on every save and still races; refusing the write at `/urls` alone and leaving the PATCH open.
- Reason: the lock exists to protect a finished diagram from being drawn over, and the list is fetched once per page load, so a second tab or a second device open since before the lock is exactly the case that needs stopping. The condition costs nothing on the happy path, and the extra read happens only when a write was already refused, which is what lets the route tell a locked diagram from a missing one. Sequencing the saver first is what keeps Lock from answering 409 to the user's own last edit.
- Debt created: a presigned PUT handed out before the lock stays valid for the rest of its five minutes, so a tab that already holds one can still overwrite the scene object, though its PATCH is refused and the item's timestamps and counters never move.
- Revisit when: that window matters, which needs either a shorter expiry or a bucket policy that reads the lock; neither is worth it while one person uses the app.
- Source: 0011_workspace_redesign

## 2026-09-20: the item menu is not modal, because a dialog opened from a modal menu kills the page

- Decision: the diagram row's `DropdownMenu` takes `modal={false}`, and the three dialogs it opens are mounted for the life of the sidebar with `open` driven by state rather than mounted and unmounted with the selection.
- Alternatives rejected: leaving the menu modal and clearing `document.body.style.pointerEvents` by hand after each dialog closed; opening the dialog on a timer after the menu had finished closing.
- Reason: a modal menu writes `pointer-events: none` on the body; a dialog opened from it saves that value as the one to restore and writes it back when it closes, so the whole app was unclickable until a reload after every rename. The e2e suite failed 16 of 35 on it. A sidebar menu needs no scroll lock, so dropping modal removes the value there is to capture instead of papering over it. Unmounting a Radix dialog while it is open leaks the same style by a second route, which is why the dialogs now stay mounted, as the delete confirmation already did before this task.
- Debt created: none, but every future menu in this app that can open a dialog has to stay non-modal, and nothing enforces that beyond this entry and the specs that drive the menu.
- Revisit when: Radix restores the style correctly for nested modals, or a menu here genuinely needs to trap focus and lock scroll.
- Source: 0011_workspace_redesign

## 2026-09-20: one table, one `Item` union, and a list payload named `items`

- Decision: diagrams and folders are one `Item` union in `src/lib/diagrams.ts`, told apart by an optional `kind`, stored in the one table, and `GET /api/diagrams` answers `{ items }` while `POST` and `PATCH` answer `{ item }`.
  The repository is `itemRepository`, the provider is `WorkspaceProvider`, and the files that now serve both kinds are named for the item, not the diagram.
- Alternatives rejected: a second DynamoDB table for folders; keeping the `{ diagrams }` payload and the `Diagram` type and letting folders travel inside them.
- Reason: a second table needs a Terraform change, a second read on every page load and a join in the browser, for a tree that is already fully in memory from one Scan.
  Keeping the old names was the real risk: the list is read in five places and every one of them now has to choose a kind, so `HomeRedirect` picking `items[0]` would have opened a folder as a diagram.
  Renaming the payload and the type turned that into a compile error at each call site instead of a rule to remember, which is why the rename was worth a wider diff.
- Debt created: none.
- Revisit when: the table stops fitting in one Scan, at which point the tree needs an index and folders may want their own key space.
- Source: 0011_workspace_redesign

## 2026-09-20: a folder delete cascades deepest first, with each scene object paired to its row

- Decision: `DELETE` on a folder reads the table, orders the subtree deepest first with the folder last, and for each member removes the row and then, for a diagram, its scene object.
  There is no transaction and no batch.
- Alternatives rejected: deleting every row and then every object, which is what the plan sketched; `TransactWriteItems`, capped at 100 items; deleting the folder row alone and sweeping orphans later.
- Reason: both orders leave an unreachable object rather than a diagram with no scene, but only deepest first leaves a tree that is still whole when it stops halfway: what remains is a smaller subtree the user can still reach and delete again, where rows first would leave children whose parent is gone and which no screen can show.
  The transaction limit would cap how much a folder may hold, for a guarantee a single user does not need.
- Debt created: a cascade that fails partway leaves the folder half emptied and, at worst, scene objects nothing will delete.
  The user sees a smaller folder and can delete it again; nothing reconciles the bucket.
- Revisit when: a cascade is seen to fail partway, or the bucket grows enough to want a lifecycle rule over orphans.
- Source: 0011_workspace_redesign

## 2026-09-20: `tree.ts` is the only place that decides a move

- Decision: the tree lives in one pure module used by both sides: the Move dialog builds its choices from `folderChoices`, and `PATCH` validates `parentId` with `canMoveInto`, both over the same list.
  `pathTo` and `subtree` carry visited sets and terminate on any stored data, cyclic included.
- Alternatives rejected: validating the move in the route with an ancestor walk of repeated `get` calls, while the dialog filtered its own list; trusting the dialog, since it is the only caller.
- Reason: the dialog and the API answering different questions is how a UI comes to offer something the server refuses, and here the refusal exists for a reason that outlives the UI: a cycle makes a subtree unreachable and the cascade above non-terminating.
  One rule read from one list makes them the same answer by construction, and it is unit tested without a browser or a table.
  The termination guards matter because the code that walks a cycle is the code that has to survive one.
- Debt created: `PATCH` reads the table, decides, then writes without a condition, so two moves racing each other could in principle build the cycle the rule exists to prevent.
  One user with one browser does one of these at a time.
- Revisit when: a second writer appears, human or automated, at which point the write needs a condition on the parent it was validated against.
- Source: 0011_workspace_redesign

## 2026-09-20: where the sidebar is, is a store over `localStorage`, not state seeded by an effect

- Decision: `use-sidebar-folder.ts` is a `useSyncExternalStore` whose snapshot reads `localStorage` and whose server snapshot is the root, with writes notifying subscribers and the `storage` event subscribed for free.
  The current folder never appears in the URL.
- Alternatives rejected: `useState` seeded in an effect, which is what was written first; putting the folder in the URL.
- Reason: seeding state from storage in an effect is a cascading render that the project's lint rules reject, and it renders the root for one frame before correcting itself.
  A store reads the root on the server, so hydration matches, and the stored folder is there on the first client render.
  The URL stays `/d/[id]` because the location is a sidebar concern and nothing links into a folder, which `Context & decisions` settled; the consequence worth writing down is that the location is per browser, so two browsers sit in different folders on the same diagram, which is what a sidebar should do.
- Debt created: none.
- Revisit when: a folder needs to be linkable, or a second surface needs the same location.
- Source: 0011_workspace_redesign

## 2026-09-20: deleting a folder takes the locked diagrams inside it, and says so

- Decision: the cascade deletes locked diagrams without asking for an unlock, while deleting a locked diagram directly still refuses.
  The confirmation counts the diagrams and folders inside and, when any diagram is locked, how many.
- Alternatives rejected: refusing to delete a folder that holds a locked diagram; silently skipping the locked ones and leaving the folder behind.
- Reason: a lock protects a drawing from being drawn over, which is why rename, move and pin stay allowed on one.
  Refusing the cascade would send the user hunting through a subtree for an item the dialog will not name, and skipping the locked ones would leave a folder that will not go away.
  Naming the count is what makes it a decision rather than a surprise, which is the protection the lock is actually owed here.
- Debt created: none.
- Revisit when: a second user exists, where one person's lock would have to stop another person's delete.
- Source: 0011_workspace_redesign
