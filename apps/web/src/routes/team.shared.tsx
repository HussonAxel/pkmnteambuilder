import { Button } from "@pkmnteambuilder/ui/components/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { TeamOverview } from "@/components/team-overview";
import { useI18n } from "@/lib/i18n";
import { decodeTeam, SHARE_PREFIX, type SharedTeam } from "@/lib/share";
import { teamFromShared, useTeams } from "@/lib/teams";

export const Route = createFileRoute("/team/shared")({
  component: SharedTeamPage,
});

// A shared link (/team/shared#team=…): the whole team, read-only, with a button to keep a copy.
// The team travels in the hash, so it never reaches the server; decodeTeam validates it.
function SharedTeamPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { addTeam } = useTeams();
  const [shared, setShared] = useState<SharedTeam | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const { hash } = window.location;
    if (!hash.startsWith(SHARE_PREFIX)) return setFailed(true);
    decodeTeam(hash.slice(SHARE_PREFIX.length))
      .then((decoded) => {
        teamFromShared(decoded); // throws on a format this app doesn't know
        setShared(decoded);
      })
      .catch(() => setFailed(true));
  }, []);
  const team = useMemo(() => shared && teamFromShared(shared), [shared]);

  if (failed)
    return <p className="p-8 text-center text-sm text-muted-foreground">{t("share.invalid")}</p>;
  if (!team)
    return <p className="p-8 text-center text-sm text-muted-foreground">{t("page.loading")}</p>;
  return (
    <TeamOverview
      team={team}
      headerAction={
        <>
          <span className="text-xs text-muted-foreground">{t("page.shared")}</span>
          <Button
            className="h-9 rounded-full px-4 text-sm"
            onClick={() => {
              // A fresh copy (new ids): keeping the same link twice gives two independent teams.
              const copy = teamFromShared(shared!);
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
