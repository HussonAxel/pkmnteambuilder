// The player's teams, shared by the home grid and the team pages (/team/$teamId).
// shortcut: kept in this browser's localStorage; move to a tRPC + db table once teams follow an account.
import { createContext, type ReactNode, use, useEffect, useMemo, useState } from "react";
import { type PokemonSet, type Team } from "@/components/stacked-list";
import { GAMES } from "@/data/games/index";
import { formatInfo } from "@/lib/legality";
import type { SharedTeam } from "@/lib/share";

const STORAGE_KEY = "pkmnteambuilder.teams.v1";
// The sample team earlier versions started everyone with: dropped from saved teams on read.
const OLD_SAMPLE_ID = "sample-reg-f";

interface Teams {
  teams: Team[];
  // False until this browser's saved teams are read (after hydration: the server has none).
  ready: boolean;
  addTeam: (team: Team) => void;
  updateTeam: (id: string, change: (team: Team) => Team) => void;
  addPokemon: (teamId: string, pokemon: PokemonSet) => void;
  updatePokemon: (teamId: string, pokemon: PokemonSet) => void;
  removePokemon: (teamId: string, pokemonId: string) => void;
}

const TeamsContext = createContext<Teams | null>(null);

function readSaved(): Team[] | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return Array.isArray(saved)
      ? (saved as Team[]).filter((team) => team?.id !== OLD_SAMPLE_ID)
      : undefined;
  } catch {
    return undefined; // private mode, blocked storage or a corrupt value: start with no team
  }
}

export function TeamsProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readSaved();
    if (saved) setTeams(saved);
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return; // don't overwrite the saved teams with the empty list before they're read
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
    } catch {
      // Storage full or blocked: teams still work for this visit.
    }
  }, [teams, ready]);

  const value = useMemo<Teams>(() => {
    const updateTeam = (id: string, change: (team: Team) => Team) =>
      setTeams((prev) => prev.map((t) => (t.id === id ? change(t) : t)));
    return {
      teams,
      ready,
      addTeam: (team) => setTeams((prev) => [team, ...prev]),
      updateTeam,
      addPokemon: (teamId, pokemon) =>
        updateTeam(teamId, (t) => ({ ...t, pokemon: [...t.pokemon, pokemon] })),
      updatePokemon: (teamId, pokemon) =>
        updateTeam(teamId, (t) => ({
          ...t,
          pokemon: t.pokemon.map((p) => (p.id === pokemon.id ? pokemon : p)),
        })),
      removePokemon: (teamId, pokemonId) =>
        updateTeam(teamId, (t) => ({ ...t, pokemon: t.pokemon.filter((p) => p.id !== pokemonId) })),
    };
  }, [teams, ready]);

  return <TeamsContext value={value}>{children}</TeamsContext>;
}

export function useTeams(): Teams {
  const ctx = use(TeamsContext);
  if (!ctx) throw new Error("useTeams must be used inside <TeamsProvider>");
  return ctx;
}

// A shared team (lib/share.ts, already validated) as one of the player's own: fresh ids throughout.
// Throws on a format this app doesn't know, or in the wrong mode: a forged link could say anything.
export function teamFromShared({ v: _v, ...shared }: SharedTeam): Team {
  const known =
    shared.mode === "adventure"
      ? GAMES.some((g) => (g.versions as readonly string[]).includes(shared.format))
      : formatInfo(shared.format)?.mode === shared.mode;
  if (!known) throw new Error(`Unknown format ${shared.format}`);
  return {
    ...shared,
    rules: shared.rules as Team["rules"],
    id: crypto.randomUUID(),
    pokemon: shared.pokemon.map((p) => ({ ...p, id: crypto.randomUUID() }) as PokemonSet),
  };
}
