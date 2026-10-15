import {
  defaultDiagramSort,
  sortDirections,
  sortFields,
  type DiagramSort,
  type SortDirection,
  type SortField,
} from "@/lib/tree";

export type SidebarSection = "diagrams" | "libraries";

export interface ShellLayout {
  panel: boolean;
  section: SidebarSection;
  sort: DiagramSort;
}

export const shellLayoutCookie = "napkin.shell-layout";
export const shellLayoutMaxAge = 60 * 60 * 24 * 365;

export const defaultShellLayout: ShellLayout = {
  panel: true,
  section: "diagrams",
  sort: defaultDiagramSort,
};

function isSortField(value: string | undefined): value is SortField {
  return sortFields.some((field) => field === value);
}

function isSortDirection(value: string | undefined): value is SortDirection {
  return sortDirections.some((direction) => direction === value);
}

function parseSort(field: string | undefined, direction: string | undefined): DiagramSort {
  if (!isSortField(field) || !isSortDirection(direction)) return defaultDiagramSort;

  return { field, direction };
}

export function parseShellLayout(value: string | undefined): ShellLayout {
  const [panel, section, field, direction] = (value ?? "").split(":");
  if (panel !== "open" && panel !== "closed") return defaultShellLayout;

  return {
    panel: panel === "open",
    section: section === "libraries" ? "libraries" : "diagrams",
    sort: parseSort(field, direction),
  };
}

export function formatShellLayout(layout: ShellLayout): string {
  const { field, direction } = layout.sort;

  return `${layout.panel ? "open" : "closed"}:${layout.section}:${field}:${direction}`;
}

export function toggleSection(layout: ShellLayout, section: SidebarSection): ShellLayout {
  if (layout.panel && layout.section === section) return { ...layout, panel: false };

  return { ...layout, panel: true, section };
}

export function togglePanel(layout: ShellLayout): ShellLayout {
  return { ...layout, panel: !layout.panel };
}

export function openSection(layout: ShellLayout, section: SidebarSection): ShellLayout {
  return { ...layout, panel: true, section };
}

export function sortDiagrams(layout: ShellLayout, sort: DiagramSort): ShellLayout {
  return { ...layout, sort };
}
