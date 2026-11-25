import { createFileRoute } from "@tanstack/react-router";

import { TeamOverview } from "@/components/team-overview";
import { useI18n } from "@/lib/i18n";
import { useTeams } from "@/lib/teams";

export const Route = createFileRoute("/team/$teamId")({
  component: TeamPage,
});

// One of the player's teams, in full and editable. Teams live in this browser (lib/teams.tsx).
function TeamPage() {
  const { teamId } = Route.useParams();
  const { t } = useI18n();
  const { teams, ready, addPokemon, updatePokemon, removePokemon } = useTeams();
  const team = teams.find((x) => x.id === teamId);
  if (!team)
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        {ready ? t("page.notFound") : t("page.loading")}
      </p>
    );
  return (
    <TeamOverview
      team={team}
      actions={{
        onAdd: (pokemon) => addPokemon(team.id, pokemon),
        onUpdate: (pokemon) => updatePokemon(team.id, pokemon),
        onRemove: (id) => removePokemon(team.id, id),
      }}
    />
  );
}
