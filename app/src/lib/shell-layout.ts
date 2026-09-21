export type SidebarSection = "diagrams" | "libraries";

export interface ShellLayout {
  panel: boolean;
  section: SidebarSection;
}

export const shellLayoutCookie = "napkin.shell-layout";
export const shellLayoutMaxAge = 60 * 60 * 24 * 365;

export const defaultShellLayout: ShellLayout = { panel: true, section: "diagrams" };

export function parseShellLayout(value: string | undefined): ShellLayout {
  const [panel, section] = (value ?? "").split(":");
  if (panel !== "open" && panel !== "closed") return defaultShellLayout;

  return { panel: panel === "open", section: section === "libraries" ? "libraries" : "diagrams" };
}

export function formatShellLayout(layout: ShellLayout): string {
  return `${layout.panel ? "open" : "closed"}:${layout.section}`;
}

export function toggleSection(layout: ShellLayout, section: SidebarSection): ShellLayout {
  if (layout.panel && layout.section === section) return { panel: false, section };

  return { panel: true, section };
}

export function togglePanel(layout: ShellLayout): ShellLayout {
  return { panel: !layout.panel, section: layout.section };
}
