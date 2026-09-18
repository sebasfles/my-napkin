---
updated: 2026-09-17
source: 0001_repo_base
---

# app

Next.js application that serves the editor: a diagram list, an embedded Excalidraw canvas, password login, and the API routes that back both.
The shell exists today, in Spanish and English and in light and dark mode.
The diagram list is still an empty placeholder, and persistence, login and the API routes are not built.
Runs as a single Lambda behind CloudFront, built with OpenNext.

## Boundaries

- Owns: the UI (diagram list, editor, login form), the API routes under `/api`, the session cookie and middleware, presigned URL issuance.
- Does not own: the AWS infrastructure that hosts it (see `infra`), the deploy pipeline (see `deploy`).
- Code: `app/`

## Documents

- [prd.md](prd.md): product behavior
- [trd.md](trd.md): structure and endpoints
- [ard.md](ard.md): decisions and debt
- [database.md](database.md): tables and invariants
- [flows.md](flows.md): diagrams
