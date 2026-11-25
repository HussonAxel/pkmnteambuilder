// Signed in, the browser's teams follow the account: they're pulled once (missing or newer teams come in),
// then every change is pushed (debounced). That makes /team/<id> readable by anyone with the link,
// editable only by its owner (packages/api/src/routers/team.ts). Signed out, teams stay in this browser.
import { useEffect, useRef, useState } from "react";

import type { Team } from "@/components/stacked-list";
import { authClient } from "@/lib/auth-client";
import { useTeams } from "@/lib/teams";
import { useTRPCClient } from "@/utils/trpc";

const PUSH_DELAY = 800;

export function TeamsSync() {
  const client = useTRPCClient();
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const { teams, ready, mergeRemote } = useTeams();
  // updatedAt of each team as the server has it (pushed or pulled): unchanged teams aren't sent again.
  const synced = useRef(new Map<string, number>());
  const [pulledFor, setPulledFor] = useState<string | null>(null);
  // A new function on every change of the teams: read through a ref so a pull isn't restarted.
  const merge = useRef(mergeRemote);
  merge.current = mergeRemote;

  // Pull once per signed-in player.
  useEffect(() => {
    if (!ready || !userId || pulledFor === userId) return;
    let cancelled = false;
    synced.current.clear();
    client.team.mine
      .query()
      .then((remote) => {
        if (cancelled) return;
        for (const team of remote) synced.current.set(team.id, team.updatedAt);
        merge.current(remote as Team[]);
        setPulledFor(userId);
      })
      .catch(() => {}); // offline or signed out meanwhile: the next sign-in or visit retries
    return () => {
      cancelled = true;
    };
  }, [client, ready, userId, pulledFor]);

  // Push what changed since, once the player pauses.
  useEffect(() => {
    if (!userId || pulledFor !== userId) return;
    const pending = teams.filter((t) => synced.current.get(t.id) !== (t.updatedAt ?? 0));
    if (pending.length === 0) return;
    const timer = setTimeout(() => {
      for (const { id, updatedAt = 0, ...data } of pending) {
        client.team.save
          .mutate({
            id,
            updatedAt,
            data: {
              name: data.name,
              mode: data.mode,
              format: data.format,
              rules: data.rules as Record<string, boolean> | undefined,
              pokemon: data.pokemon,
            },
          })
          // FORBIDDEN (another account's team in this browser) won't change on retry either.
          .then(
            () => synced.current.set(id, updatedAt),
            (error: { data?: { code?: string } }) => {
              if (error.data?.code === "FORBIDDEN" || error.data?.code === "BAD_REQUEST")
                synced.current.set(id, updatedAt);
            },
          );
      }
    }, PUSH_DELAY);
    return () => clearTimeout(timer);
  }, [client, teams, userId, pulledFor]);

  return null;
}
