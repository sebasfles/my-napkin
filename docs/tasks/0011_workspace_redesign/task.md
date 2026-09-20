---
id: "0011"
title: workspace_redesign
type: feature
branch:
modules: [app]
repos: ["."]
phases: 4
depends_on: []
ticket:
created: 2026-09-19
updated: 2026-09-20
---

# 0011 Workspace redesign: a beautiful shell with folders, pins and tabs

## Goal

The app becomes a place Sebastian enjoys being in: a deliberate visual identity with its own typeface, and a sidebar that grows from a flat list into a small workspace, with nested folders, pinned diagrams, VS Code-style tabs with preview and fixed states, breadcrumbs, and a per-item menu (rename, lock, delete, info) backed by real metadata.

## Scope

1. Visual refactor: one UI typeface self-hosted through `next/font` (Geist Sans, Geist Mono for metadata), refreshed tokens in `globals.css` (spacing, radii, surfaces, borders, focus rings, motion), and every surface reworked to them: login, sidebar, item rows, menus, dialogs, tab bar, save indicator, empty and error states. Light and dark both. The editor canvas keeps Excalidraw's own fonts and chrome.
2. Folders: nested, created and renamed from the sidebar, deleted with a confirmation that names what is inside and removes it all. Diagrams and folders move between folders from the item menu ("Move to", a dialog with the folder tree). No drag and drop: the sidebar shows one folder at a time, so there is nothing to drop onto.
3. Pinning: a diagram can be pinned or unpinned from its menu; pinned diagrams appear in a "Pinned" section above the "Diagrams" section, in the order they were pinned, wherever the user is.
4. Current diagram: the open diagram is highlighted in the sidebar, is the active tab, and its path shows in the breadcrumbs.
5. Navigation: entering a folder replaces the sidebar's "Diagrams" section with that folder's children; breadcrumbs above the section show the path from root and each crumb is clickable. Location survives a reload.
6. Tabs: single click opens a diagram as a preview tab (italic title) that the next single click replaces; double click, or editing the drawing, promotes it to a fixed tab. Each tab has a close button. Keyboard: Alt+1..9 jumps to a tab, Alt+Shift+Left/Right cycles, Alt+W closes (Alt+Tab belongs to the OS and Ctrl+Tab to the browser). Open tabs and the active one survive a reload; a tab whose diagram was deleted closes itself.
7. Item menu on every diagram row (three dots): Rename (dialog), Lock / Unlock, Delete (confirmation dialog naming the diagram), Info (dialog), Pin / Unpin, Move to. Folder rows get Rename, Delete, Move to.
8. Lock: a locked diagram opens in the editor's view mode (`viewModeEnabled`), which still allows the laser pointer, panning, zoom and reading, and never allows drawing; the saver never runs, and the row shows a lock glyph. Rename and Move stay allowed; Delete asks to unlock first.
9. Metadata, stored on the item and shown in Info: name, path, created, last edited, locked since, pinned since, element count and scene size in bytes (both refreshed by the browser on every save).

## Out of scope

- Search, tags, thumbnails, sharing: deferred. Drag and drop: not planned, the one-folder-at-a-time sidebar has no target.
- Any change to Excalidraw's own UI, fonts or behavior.
- Any `infra` change: no new table, no GSI; the list stays a full Scan (single user, small table).
- Mobile-specific layout beyond keeping the current responsive behavior working.

## Acceptance

1. One typeface loads from the app's own origin (no request to a font CDN) and every text outside the canvas uses it; no layout shift on load.
2. Light and dark are both complete: no surface, border or text keeps an old token.
3. Folders nest to any depth; create, rename, move and delete work from the sidebar; deleting a folder asks for confirmation naming how many diagrams and folders it holds and removes them all.
4. Pinned diagrams show in the Pinned section from any folder; unpinning removes them from it and nothing else changes.
5. Entering a folder swaps the Diagrams section and updates the breadcrumbs; clicking a crumb navigates; reload lands in the same folder.
6. Single click opens a preview tab that the next single click replaces; double click or an edit fixes it; close works from the tab and by keyboard; tabs and the active one survive a reload.
7. The open diagram is highlighted in the sidebar and is the active tab.
8. Rename, Lock, Delete and Info behave as in Scope 7 to 9; a locked diagram cannot be drawn on and never saves; Info shows every field in Scope 9.
9. Unit tests cover the tree and tab state logic; one Playwright spec per flow (folders, pinning, tabs, item menu); the full local suite stays green.
10. `docs/PRD.md` drops "Folders" from Not in the product; `docs/modules/app/` prd, trd and database describe the new items and fields.
11. Every phase's PR description carries screenshots of what was built, light and dark.

## Approach

- Data: one table, two kinds of item. Diagram items gain `parentId` (root when absent), `pinnedAt`, `lockedAt`, `elementCount`, `sceneBytes`. Folder items are `kind: folder` with `id`, `name`, `parentId`, `createdAt`, `updatedAt`. Chosen over a second DynamoDB table because it needs no Terraform change, the Scan already reads everything, and the tree is built in the browser from one list.
- API: `GET /api/diagrams` returns both kinds; `POST /api/diagrams` accepts `kind` and `parentId`; `PATCH /api/diagrams/[id]` accepts `name`, `parentId`, `pinned`, `locked`, `elementCount`, `sceneBytes`; `DELETE` on a folder cascades server-side (items first, then scene objects), so a half-failed cascade leaves unreachable objects and never orphan rows, matching the existing invariant.
- Sidebar state (current folder, open tabs, active tab, preview tab) is client state persisted in `localStorage`, keyed per browser; the URL stays `/d/[id]`. Chosen over encoding the folder in the URL because the location is a sidebar concern and nothing links into a folder.
- Tabs: a pure reducer in `src/lib/` (open preview, promote, close, switch, reconcile with the list) with unit tests; the component is thin.
- Lock: the editor gets `viewModeEnabled` and the saver is not mounted; the scene is never uploaded while locked.
- Typeface via `next/font` (self-hosted at build time, zero runtime requests), applied on `html`; Excalidraw is scoped out through its own container.
- Dialogs and menus come from shadcn/ui through its CLI as the ARD requires (dropdown-menu, dialog, breadcrumb, tooltip added).
- Screenshots: the om-developer takes them with Playwright against the local app, light and dark, and the om-reviewer puts them in the PR description. Sebastian validates the UI from the PR (this project only, not a global rule).

## Database

`diagrams` table, existing, no schema change (DynamoDB is schemaless; only the hash key matters). New attributes above; existing items read as root-level, unpinned, unlocked diagrams, so no migration.

## Infra

None.

## Design

No Figma. The om-developer designs in code following the direction in Scope 1; Sebastian iterates on each PR from its screenshots.

## Risks

- Excalidraw's chrome uses its own fonts and CSS variables; the app theme must not bleed into the canvas nor the reverse.
- Keyboard shortcuts for tabs can collide with Excalidraw's own bindings when the canvas has focus.
- Folder delete cascade against a table with no transactions: ordering and idempotency matter.
- Three phases touching the same sidebar component in sequence: each phase merges before the next starts.

## Phases

1. `foundation`: typeface, tokens, visual rework of every existing surface, the item menu with Rename, Lock, Delete and Info, and the metadata fields.
2. `folders`: folder items, nested navigation, breadcrumbs, Pinned and Diagrams sections, Pin and Move actions, folder menu, location persistence.
3. `tabs`: tab bar with preview and fixed tabs, close, keyboard switching, current diagram highlight, persistence.

## Depends on

None active. 0004 (done) owns the current list and persistence.

## Context & decisions

Consolidated 2026-09-19 with Sebastian through the om-manager.

### Decided in the consolidation

- Screenshots are never committed (Sebastian). The om-developer leaves them in the workspace and the PR description lists their absolute paths; Sebastian views them locally. `gh` cannot upload an image to a PR body, so no URL exists to render; keeping the repo free of binaries wins over rendering them inline. Adjusts Acceptance 11 and the last Approach bullet: the PR description carries the paths, not the images; each phase's own acceptance point about screenshots reads the same way.
- `updatedAt` means the scene was edited (Sebastian). A PATCH carrying only metadata (`name`, `parentId`, `pinned`, `locked`) leaves it alone; only the PATCH that follows a scene upload touches it. Renaming therefore no longer moves a diagram to the top of the list, and Info's "last edited" stays true. Adjusts `app/src/lib/dynamo.ts` `touch` and the invariant in `docs/modules/app/database.md`.
- A pinned diagram appears in both the Pinned section and its own folder (Sebastian). A pin is a shortcut, not a move. Clarifies Acceptance 4.
- One breadcrumb, the sidebar's, and opening a diagram moves the sidebar to that diagram's folder (Sebastian). Resolves the conflict between Scope 4 and Scope 5; a reload restores the last sidebar location.
- Rename in place goes away, only the Rename dialog from the item menu (Sebastian). Phase 1 removes it and corrects `docs/modules/app/prd.md`.

### Decided by the om-reviewer

- The typeface comes from the `geist` npm package, or `next/font/local` with the files committed; never `next/font/google`, so no build depends on reaching a font host. Acceptance 1 asks for no CDN request and this also keeps the build offline and reproducible. Adjusts the Approach's typeface bullet, which left the source open.
- Sidebar order: folders A to Z first, then diagrams by `updatedAt` desc; the Pinned section by `pinnedAt` asc, the order they were pinned, as Scope 3 says.
- Move to never offers the moved folder or one of its descendants, and `PATCH` rejects with 400 a `parentId` that is the item itself, a descendant, a missing item or an item that is not a folder. A cycle would make a subtree unreachable and the delete cascade non-terminating.
- A folder owns no scene object: `POST` with `kind: folder` writes no S3 object and `/urls` answers 404 for a folder, which keeps the invariant "every diagram has exactly one scene object" literally true.
- Deleting a folder that holds the open diagram sends the user to `/`, the same path the existing delete already takes.
- Locking a diagram with an unsaved change flushes it first, then remounts the editor in view mode. Lock must not cost the user the last edit.
- Info shows a dash for `elementCount` and `sceneBytes` on diagrams that have not been saved since this task; nothing is backfilled.
- Each phase's documentation covers what that phase shipped, so Acceptance 10 completes in phase 3.

### Constraints the om-developer respects

- Colors only from theme tokens, every string through `next-intl` in `es` and `en`, a spec per changed flow: `docs/checks/styles.md`, `docs/checks/i18n.md`, `docs/checks/e2e-worth.md`.
- `src/components/ui/` stays exactly as the shadcn CLI writes it, radix base and nova preset: `docs/modules/app/ard.md`, "shadcn/ui on the radix base".
- Every call to `/api` goes through `signedFetch`, and no route handler answers a native form post or a Server Action: `docs/modules/app/ard.md`, "Client-side SHA-256 of the request body".
- No page reads DynamoDB or S3; the browser talks to `/api` only: `docs/modules/app/ard.md`, "The browser talks to `/api`".
- Saving a diagram stays one PUT plus one PATCH: `elementCount` and `sceneBytes` travel in the PATCH that already exists, never in a request of their own.
- Theme-dependent client components render behind `useHydrated()`: `docs/modules/app/ard.md`, "Theme-dependent client components render from a hydration gate".
- No `infra` change, no new table, no GSI; the list stays a full Scan.

### What review-task checks beyond the Pipeline

- The app font does not reach inside `.excalidraw`, and the editor's own chrome keeps its fonts; the reverse bleed too.
- Every consumer of the list filters by kind once folders exist, `HomeRedirect` included, or `/` will try to open a folder as a diagram.
- The e2e specs delete the folders they create, not only the diagrams, and `tests/e2e/helpers.ts` follows the sidebar into a folder instead of assuming a flat list.
- A locked diagram issues no PUT and no PATCH at all, proved by the spec, not by the absence of a saver in the tree.

## om-developer notes
