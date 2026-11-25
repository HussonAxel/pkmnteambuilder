import { Link, useRouteContext } from "@tanstack/react-router";
import { ChartNoAxesColumnIcon, Gamepad2Icon, MoonIcon, SunIcon } from "lucide-react";
import { useState } from "react";

import { LANGS, useI18n } from "@/lib/i18n";
import { useEraSprites } from "@/lib/sprites";
import { applyTheme } from "@/lib/theme";

import { PokemonSearch } from "./pokemon-search";
import UserMenu from "./user-menu";

export default function Header() {
  const { lang, setLang, t } = useI18n();

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Same container as the pages, so the logo lines up with the first team card. */}
      <div className="container mx-auto flex h-14 items-center justify-between gap-3 px-4">
        <Link
          to="/"
          className="group flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <TeamMark />
          <span className="sr-only text-base font-semibold tracking-tight text-foreground sm:not-sr-only">
            pkmn
            <span className="text-muted-foreground transition-colors group-hover:text-foreground">
              teambuilder
            </span>
          </span>
        </Link>
        <nav className="mr-auto">
          <Link
            to="/meta"
            title={t("meta.title")}
            className="flex h-7 items-center gap-1.5 rounded-full px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3 [&.active]:bg-muted/60 [&.active]:text-foreground"
          >
            <ChartNoAxesColumnIcon size={14} />
            {/* Icon only on phones, like the logo's name: the header must fit 360px. */}
            <span className="sr-only sm:not-sr-only">{t("meta.nav")}</span>
          </Link>
        </nav>
        <div className="flex items-center gap-1.5">
          <PokemonSearch />
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
                aria-label={t(`lang.${l}`)}
                lang={l}
                onClick={() => setLang(l)}
                className="rounded-full px-2.5 py-1 uppercase text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
              >
                {l}
              </button>
            ))}
          </div>
          <EraSpritesToggle />
          <ThemeToggle />
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

// Six slots, two rows of three: a full team. Pure shapes, no franchise artwork.
function TeamMark() {
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-foreground text-background transition-transform group-hover:scale-105">
      <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
        {[3.5, 8, 12.5].flatMap((cx) =>
          [5.5, 10.5].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.6} />),
        )}
      </svg>
    </span>
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
