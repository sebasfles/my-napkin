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

## Result
