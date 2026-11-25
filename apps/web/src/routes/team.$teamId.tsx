import { Button } from "@pkmnteambuilder/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";

import { type Team } from "@/components/stacked-list";
import { TeamOverview } from "@/components/team-overview";
import { useI18n } from "@/lib/i18n";
import { useTeams } from "@/lib/teams";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/team/$teamId")({
  component: TeamPage,
});

// One team, in full. In this browser's teams (lib/teams.tsx): editable. Otherwise, a team its owner
// saved to their account (lib/teams-sync.tsx): anyone with the link sees it read-only, and can keep a copy.
function TeamPage() {
  const { teamId } = Route.useParams();
  const { t } = useI18n();
  const { teams, ready, addPokemon, updatePokemon, removePokemon, mergeRemote } = useTeams();
  const team = teams.find((x) => x.id === teamId);
  const trpc = useTRPC();
  const remote = useQuery({
    ...trpc.team.get.queryOptions({ id: teamId }),
    enabled: ready && !team,
    retry: false,
  });

  // The owner's own team, saved from another device: bring it into this browser, editable.
  const owned = remote.data?.isOwner ? remote.data.team : undefined;
  useEffect(() => {
    if (owned) mergeRemote([owned as Team]);
    // mergeRemote changes with every team edit; the team itself is what matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owned]);

  if (team)
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
  if (!ready || remote.isPending || remote.data?.isOwner)
    return <p className="p-8 text-center text-sm text-muted-foreground">{t("page.loading")}</p>;
  if (!remote.data)
    return <p className="p-8 text-center text-sm text-muted-foreground">{t("page.notFound")}</p>;
  return <ReadOnlyTeam team={remote.data.team as Team} />;
}

function ReadOnlyTeam({ team }: { team: Team }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { addTeam } = useTeams();
  return (
    <TeamOverview
      team={team}
      headerAction={
        <>
          <span className="text-xs text-muted-foreground">{t("page.shared")}</span>
          <Button
            className="h-9 rounded-full px-4 text-sm"
            onClick={() => {
              // A fresh copy (new ids) that's the player's own; the original stays its owner's.
              const copy: Team = {
                ...team,
                id: crypto.randomUUID(),
                pokemon: team.pokemon.map((p) => ({ ...p, id: crypto.randomUUID() })),
              };
              addTeam(copy);
              toast.success(t("share.imported", { name: copy.name }));
              void navigate({ to: "/team/$teamId", params: { teamId: copy.id } });
            }}
          >
            {t("page.keep")}
          </Button>
        </>
      }
    />
  );
}
