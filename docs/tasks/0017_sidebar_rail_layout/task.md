---
id: "0017"
title: sidebar_rail_layout
type: feature
branch: feat/0017_sidebar_rail_layout
modules: [app]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-09-21
updated: 2026-09-21
---

# 0017 The sidebar rail stays, the panel comes and goes

## Goal

The narrow rail of icons is always there; expanding the sidebar adds a panel next to it instead of replacing it, so the room is taken and given back without the sidebar changing shape.
Theme, language and logout leave the panel's bottom row and live behind one settings icon at the rail's bottom.
Sebastian approved the collapsed rail as it looks on dev today (2026-09-21) and wants the expanded state built around it.

## Scope

- Rail, always visible: the mark at the top, the Diagrams and Libraries icons, a settings icon at the bottom. Same width and look as today's collapsed rail.
- Panel: appears to the right of the rail with the section's content (Diagrams or Libraries). Its header keeps "My Napkin" and the section's actions (new folder and new diagram; new library). The section-switch icons and the collapse button leave the header; the rail owns them.
- Toggling: clicking the active section's rail icon collapses the panel; clicking the other section's icon opens the panel on it or switches it; Alt+B toggles the panel; the rail icons name the chord in their tooltip.
- Settings icon opens a popover with the three-state theme control, the language toggle and logout; the same popover whether the panel is open or not. The panel's bottom row goes away.
- Persisted per browser as today: panel open or not, and which section.
- Layout: the canvas and the tab bar move by the panel's width only; the rail width is constant.
- Tests: the existing sidebar and shortcut specs adapted to the rail; one Playwright case for the settings popover (theme, language and logout reachable from it in both states); unit tests where the sidebar state changes.
- Docs: `docs/modules/app/prd.md` sidebar paragraph and the flows that mention the bottom controls.

## Out of scope

- A sort control for diagrams (draft `sidebar_sort`).
- Resizing the panel.
- Any change to the Libraries panel inside the editor.

## Acceptance

1. With the panel collapsed the app shows the rail exactly as dev shows it today; expanding adds the panel beside it and the rail does not move or change.
2. Clicking the active section's rail icon collapses the panel; clicking the other section's icon opens or switches it; Alt+B toggles it; the panel header has no section icons and no collapse button.
3. The settings icon at the rail's bottom opens a popover with theme (light, dark, system), language and logout, working in both states; the panel has no bottom row.
4. Panel state and section survive a reload.
5. Canvas and tab bar shift only by the panel's width.
6. Suite green; before and after screenshots of both states and the popover, in light and dark, as workspace paths in the PR description.

## Approach

- Module `app`: `sidebar.tsx` split into a rail and a panel, `theme-control.tsx`, `locale-toggle.tsx` and `logout-button.tsx` composed inside a popover (shadcn `Popover`), `shortcuts.tsx` for Alt+B, the layout that positions canvas and tab bar.
- Decisions:
  - Rail owns section switching and collapse: chosen over keeping the header controls because one place for the same action is enough and the header gets its room back.
  - Settings popover: chosen over a settings page or a bottom row because three controls do not deserve a row that is always visible.
- UI is validated by Sebastian on the PR; the developer does not start the app to check pixels.

## Database

None.

## Infra

None.

## Design

None; Sebastian's two screenshots of dev (collapsed rail, expanded panel) are the reference and are described in Goal and Scope.

## Risks

- The e2e helpers and specs that locate the collapse button or the bottom-row controls break; they move to the rail and the popover.
- Focus and keyboard access of the popover (Escape closes, focus returns to the rail icon).

## Depends on

None. 0016 (same files) is merged.

## Context & decisions

Consolidated 2026-09-21 with Sebastian through the om-manager.

### Layout and state
- The panel is 288px beside a 48px rail, so expanded totals 336px and the canvas gives up 48px more than today (Sebastian).
  `w-72` in `sidebar.tsx:118` is the only width literal in `app/src`, and a second one is a finding.
- Collapsed and section move into one shell-layout cookie read in `(editor)/layout.tsx`, replacing the `localStorage` section store (Sebastian).
  This is the revisit named in `docs/modules/app/ard.md`, 2026-09-20 "the collapsed sidebar is a cookie, so the server renders the rail", so it takes an ARD entry of its own.
- The mark at the rail's top becomes non-interactive (Sebastian); the two section icons own the toggle and carry Alt+B in their tooltip, as `ard.md` 2026-09-20 "the chord rides in the tooltip" already has it.
  `sidebar-toggle` goes away and `expandSidebar` in `tests/e2e/helpers.ts` moves onto the rail icons.

### Scope adjustment, superseding the Panel bullet (Sebastian)
- The panel header keeps only the title.
  Each section keeps its own heading row, DIAGRAMS or LIBRARIES, not interactive, carrying its actions: new folder and new diagram; new library and import.
- The breadcrumb leaves that row and sits on a row of its own below it, at every level including the root.
- The root crumb is HOME, a home icon or the localized word, not DIAGRAMS; it needs a new key in `es.json` and `en.json` and it is always visible.
- Levels count HOME: the root shows HOME alone, then HOME > A, then HOME > A > B, and from three folders on HOME > ... > C with the hidden folders in the existing menu.
  This is not the `visibleCrumbs` constant moved from 2 to 1, which would give HOME > ... > B at two folders.
  It is collapsing only from three folders on, and then showing the last one alone.
- `diagrams-heading` moves from the breadcrumb wrapper onto the section heading, and `locale.spec.ts` follows it there.
  It keeps asserting "Diagrams" and "Diagramas", since `uppercase` is CSS and does not change the text.
- This supersedes the `prd.md` sentence about a long path keeping its ends.

### Acceptance adjustment (Sebastian)
- 6 loses the before screenshots; the after set stays, both states and the popover, in light and dark.
- 1 reads as the width, the mark and the two section icons unchanged, plus the new settings icon, since Scope itself adds it.

### Constraints
- `Popover` arrives through the shadcn CLI and stays as generated: `app/components.json` pins the `radix-nova` preset and `ard.md` 2026-09-17 carries that debt.
- Every color is a theme token and every string a key present in both message files, per `docs/checks/styles.md` and `docs/checks/i18n.md`.

### At review, beyond the Pipeline
- More specs move than Scope counts: `theme.spec.ts`, `locale.spec.ts` and the `expandSidebar`, `showLibraries` and `showDiagrams` helpers, besides `sidebar-collapse.spec.ts`.
- The popover closes on Escape and returns focus to the settings icon, and the locale toggle's `router.refresh()` does not close it.
- The rail neither remounts nor changes width when the panel opens.

## om-developer notes
