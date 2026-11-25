import { createFileRoute } from "@tanstack/react-router";

import { PokemonPage } from "@/components/pokemon-page";
import { formatInfo } from "@/lib/legality";

// Formats without a valid id in the link fall back to this one.
const DEFAULT_FORMAT = "gen9ou";

// One species (its @pkmn/dex name, "Great Tusk") seen through a competitive format: /pokemon/Great%20Tusk?format=gen9ou.
export const Route = createFileRoute("/pokemon/$species")({
  validateSearch: (search: Record<string, unknown>): { format?: string } =>
    typeof search.format === "string" && formatInfo(search.format) ? { format: search.format } : {},
  head: ({ params }) => ({ meta: [{ title: `${params.species} · pkmnteambuilder` }] }),
  component: PokemonRoute,
});

function PokemonRoute() {
  const { species } = Route.useParams();
  const { format = DEFAULT_FORMAT } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PokemonPage
      species={species}
      format={format}
      onFormat={(next) => navigate({ search: { format: next }, replace: true })}
    />
  );
}
