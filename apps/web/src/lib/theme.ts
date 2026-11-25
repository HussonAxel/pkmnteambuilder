import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

// Light/dark theme, kept in a cookie like the language: the server renders the right class, so no flash.
export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

const COOKIE = "theme";

// Dark stays the default: it was the app's only look until the light theme existed.
export const readTheme = createIsomorphicFn()
  .server((): Theme => (getCookie(COOKIE) === "light" ? "light" : "dark"))
  .client((): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light"));

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.cookie = `${COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}
