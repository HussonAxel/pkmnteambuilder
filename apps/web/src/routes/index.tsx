import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";

import StackedList, { NewTeamCard } from "@/components/stacked-list";
import { useI18n } from "@/lib/i18n";
import { decodeTeam, SHARE_PREFIX } from "@/lib/share";
import { teamFromShared, useTeams } from "@/lib/teams";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const { teams, addTeam, addPokemon, updatePokemon, removePokemon } = useTeams();
  const { t } = useI18n();

  // A shared link (#team=…) adds a copy of that team, then the hash is cleared so a reload doesn't
  // add it twice. decodeTeam validates everything that comes from the link.
  useEffect(() => {
    const { hash, pathname, search } = window.location;
    if (!hash.startsWith(SHARE_PREFIX)) return;
    window.history.replaceState(null, "", pathname + search);
    decodeTeam(hash.slice(SHARE_PREFIX.length))
      .then((shared) => {
        const team = teamFromShared(shared);
        addTeam(team);
        toast.success(t("share.imported", { name: team.name }));
      })
      .catch(() => toast.error(t("share.invalid")));
    // Once, on arrival; `t` is stable enough and re-running would re-read an already cleared hash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container mx-auto grid content-start grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))] gap-6 px-4 py-6">
      {/* auto-fill: as many 24rem teams as fit per row, then wrap */}
      <NewTeamCard
        onCreate={(team) => addTeam({ ...team, id: crypto.randomUUID(), pokemon: [] })}
      />
      {teams.map((team) => (
        <StackedList
          key={team.id}
          team={team}
          onAddPokemon={(pokemon) => addPokemon(team.id, pokemon)}
          onUpdatePokemon={(pokemon) => updatePokemon(team.id, pokemon)}
          onRemovePokemon={(id) => removePokemon(team.id, id)}
        />
      ))}
    </div>
  );
}
