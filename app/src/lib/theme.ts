export const themeChoices = ["system", "light", "dark"] as const;

export type ThemeChoice = (typeof themeChoices)[number];
export type ResolvedTheme = "light" | "dark";

export function themeChoice(theme: string | undefined): ThemeChoice {
  return themeChoices.find((choice) => choice === theme) ?? "system";
}

export function resolveTheme(
  theme: string | undefined,
  systemTheme: string | undefined,
): ResolvedTheme {
  const choice = themeChoice(theme);
  const selected = choice === "system" ? themeChoice(systemTheme) : choice;
  return selected === "dark" ? "dark" : "light";
}
