---
updated: 2026-09-20
source: 0012_libraries
---

# app

Next.js application that serves the editor: a sidebar of diagrams, folders and libraries, a bar of open tabs over an embedded Excalidraw canvas, password login, and the API routes that back them.
The workspace is complete: the password gate, folders, pinning, locking, the menu on every row, the tabs, the sidebar that collapses to a rail, the empty state the app starts on and every piece of persistence, in Spanish and English and in light and dark mode.
Libraries are a canvas of their own whose frames are the items, browsed from their own section of the sidebar, imported and exported as `.excalidrawlib` and linked per diagram, and the editor carries its own panel that inserts from the linked ones, adds a selection to one and takes a dropped library file; the editor package's own library is not offered.
Runs as a single Lambda behind CloudFront, built with OpenNext.

## Boundaries

- Owns: the UI (sidebar, tab bar, editor, login form), the API routes under `/api`, the session cookie and the request gate in `src/proxy.ts`, presigned URL issuance.
- Does not own: the AWS infrastructure that hosts it (see `infra`), the deploy pipeline (see `deploy`).
- Code: `app/`

## Documents

- [prd.md](prd.md): product behavior
- [trd.md](trd.md): structure and endpoints
- [ard.md](ard.md): decisions and debt
- [database.md](database.md): tables and invariants
- [flows.md](flows.md): diagrams
