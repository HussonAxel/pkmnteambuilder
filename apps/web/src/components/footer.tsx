// Credits every data source the app is built from, with its licence (CC BY-NC-SA asks for attribution).
import { useI18n } from "@/lib/i18n";

const SOURCES = [
  {
    name: "Pokémon Showdown / pkmn",
    href: "https://github.com/pkmn/ps",
    key: "footer.showdown",
    licence: "MIT",
  },
  { name: "Smogon", href: "https://www.smogon.com/stats/", key: "footer.smogon" },
  { name: "pkmn data", href: "https://data.pkmn.cc", key: "footer.pkmndata" },
  { name: "PokeAPI", href: "https://pokeapi.co", key: "footer.pokeapi", licence: "BSD-3-Clause" },
  {
    name: "PKHeX",
    href: "https://github.com/kwsch/PKHeX",
    key: "footer.pkhex",
    licence: "GPL-3.0",
  },
  {
    name: "Bulbapedia",
    href: "https://bulbapedia.bulbagarden.net",
    key: "footer.bulbapedia",
    licence: "CC BY-NC-SA 2.5",
  },
] as const;

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border/40 px-4 py-6 text-xs leading-relaxed text-muted-foreground">
      <div className="container mx-auto grid gap-3">
        <p className="font-medium text-foreground">{t("footer.title")}</p>
        <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {SOURCES.map((s) => (
            <li key={s.name}>
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:decoration-foreground"
              >
                {s.name}
              </a>{" "}
              — {t(s.key)}
              {"licence" in s && <span className="opacity-70"> ({s.licence})</span>}
            </li>
          ))}
        </ul>
        <p className="opacity-70">{t("footer.trademark")}</p>
      </div>
    </footer>
  );
}
