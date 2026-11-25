import { createFileRoute } from "@tanstack/react-router";

import { PokemonPage } from "@/components/pokemon-page";
import { formatInfo } from "@/lib/legality";

// Links with neither a valid format nor a generation fall back to this format.
const DEFAULT_FORMAT = "gen9ou";

// One species (its @pkmn/dex name, "Great Tusk", or its national dex number) seen through a competitive
// format (/pokemon/Great%20Tusk?format=gen9ou), or a generation alone, without strategy data
// (/pokemon/Gengar?gen=1): that's how gens 1 to 3, which have no format here, are shown.
export const Route = createFileRoute("/pokemon/$species")({
  validateSearch: (search: Record<string, unknown>): { format?: string; gen?: number } => {
    if (typeof search.format === "string" && formatInfo(search.format))
      return { format: search.format };
    const gen = Number(search.gen);
    return Number.isInteger(gen) && gen >= 1 && gen <= 9 ? { gen } : {};
  },
  head: ({ params }) => ({ meta: [{ title: `${params.species} · pkmnteambuilder` }] }),
  component: PokemonRoute,
});

function PokemonRoute() {
  const { species } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const format = search.gen ? undefined : (search.format ?? DEFAULT_FORMAT);
  return (
    <PokemonPage
      species={species}
      format={format}
      gen={search.gen}
      onScope={(next) =>
        navigate({
          search: /^gen\d$/.test(next) ? { gen: Number(next.slice(3)) } : { format: next },
          replace: true,
        })
      }
    />
  );
}
