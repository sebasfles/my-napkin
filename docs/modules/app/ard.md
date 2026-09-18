---
updated: 2026-09-17
source: setup
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

## Known debt

- Scenes never go through the API, because of the 6 MB Lambda request limit.
- The scene never lives in DynamoDB, because of the 400 KB per-item limit; large scenes with base64 images would exceed it.
- Cold start of 1-2 seconds after inactivity is accepted as tolerable.
- The Lambda is not in a VPC and reaches S3 and DynamoDB over the public internet, with no NAT Gateway.
