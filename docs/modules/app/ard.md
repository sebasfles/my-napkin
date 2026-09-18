---
updated: 2026-09-18
source: 0005_password_auth
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

## Known debt

- Scenes never go through the API, because of the 6 MB Lambda request limit.
- The scene never lives in DynamoDB, because of the 400 KB per-item limit; large scenes with base64 images would exceed it.
- Cold start of 1-2 seconds after inactivity is accepted as tolerable.
- The Lambda is not in a VPC and reaches S3 and DynamoDB over the public internet, with no NAT Gateway.
- `allowScripts` in `app/package.json` is pinned per version, so a dependency bump re-blocks its install script.
- 9 transitive npm advisories under the editor package that no change in this repo can resolve.
- The expired-cookie path is proved by unit tests only, because a spec against a deployed environment has no signing secret to forge one with.
