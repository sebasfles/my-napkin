export function pageTitle(diagramName: string | null, appName: string): string {
  return diagramName === null ? appName : `${diagramName} · ${appName}`;
}
