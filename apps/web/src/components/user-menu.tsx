import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pkmnteambuilder/ui/components/dropdown-menu";
import { Skeleton } from "@pkmnteambuilder/ui/components/skeleton";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogInIcon } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";

export default function UserMenu() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-8 w-24 rounded-full" />;
  }

  if (!session) {
    return (
      <Link
        to="/login"
        className="flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <LogInIcon size={14} />
        <span className="sr-only sm:not-sr-only">{t("auth.signIn")}</span>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex h-8 items-center gap-2 rounded-full bg-muted/60 p-0.5 pr-0.5 text-xs font-medium text-foreground transition-colors hover:bg-muted aria-expanded:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:pr-3"
          />
        }
      >
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold uppercase text-background"
        >
          {session.user.name.trim().charAt(0) || "?"}
        </span>
        <span className="sr-only sm:not-sr-only sm:max-w-32 sm:truncate">{session.user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48 bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("auth.myAccount")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="text-muted-foreground">
            {session.user.email}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    navigate({
                      to: "/",
                    });
                  },
                },
              });
            }}
          >
            {t("auth.signOut")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
