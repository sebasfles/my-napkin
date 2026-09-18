export type ResolvedTheme = "light" | "dark";

export function resolveTheme(
  theme: string | undefined,
  systemTheme: string | undefined,
): ResolvedTheme {
  const selected = theme === undefined || theme === "system" ? systemTheme : theme;
  return selected === "dark" ? "dark" : "light";
}
