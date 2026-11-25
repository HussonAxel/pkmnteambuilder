import { Link, useRouteContext } from "@tanstack/react-router";
import { Gamepad2Icon, MoonIcon, SunIcon } from "lucide-react";
import { useState } from "react";

import { LANGS, useI18n } from "@/lib/i18n";
import { useEraSprites } from "@/lib/sprites";
import { applyTheme } from "@/lib/theme";

import UserMenu from "./user-menu";

export default function Header() {
  const { lang, setLang, t } = useI18n();
  const links = [
    { to: "/", label: t("nav.home") },
    { to: "/dashboard", label: t("nav.dashboard") },
  ] as const;

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex gap-4 text-lg">
          {links.map(({ to, label }) => {
            return (
              <Link key={to} to={to} className="transition-colors hover:text-muted-foreground">
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label={t("lang.switch")}
            className="flex rounded-full bg-muted/60 p-0.5 text-xs"
          >
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
                className="rounded-full px-2.5 py-1 uppercase text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground"
              >
                {l}
              </button>
            ))}
          </div>
          <EraSpritesToggle />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  );
}

function ThemeToggle() {
  const { t } = useI18n();
  // Same value the server rendered the <html> class with, so the icon hydrates without a mismatch.
  const [theme, setTheme] = useState(useRouteContext({ from: "__root__", select: (c) => c.theme }));
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      aria-label={t(`theme.${next}`)}
      title={t(`theme.${next}`)}
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
      className="flex size-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors hover:text-foreground"
    >
      {theme === "dark" ? <SunIcon size={14} /> : <MoonIcon size={14} />}
    </button>
  );
}

// Era sprites for Adventure teams (lib/sprites.tsx): the in-game sprite of their game, gens 1 to 6.
function EraSpritesToggle() {
  const { t } = useI18n();
  const { enabled, setEnabled } = useEraSprites();
  return (
    <button
      type="button"
      aria-pressed={enabled}
      aria-label={t("sprites.toggle")}
      title={t(enabled ? "sprites.on" : "sprites.off")}
      onClick={() => setEnabled(!enabled)}
      className="flex size-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-foreground aria-pressed:text-background"
    >
      <Gamepad2Icon size={14} />
    </button>
  );
}
