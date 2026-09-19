const prefix = "Napkin";

export function defaultDiagramName(date: Date, existingNames: readonly string[]): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const base = `${prefix} ${day}${month}${date.getFullYear()}`;

  const taken = new Set(existingNames);
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base} (${suffix})`)) suffix += 1;
  return `${base} (${suffix})`;
}
