import type { Session } from "@pkmnteambuilder/auth";
import type { Database } from "@pkmnteambuilder/db";

export type Context = {
  session: Session | null;
  db: Database;
};
