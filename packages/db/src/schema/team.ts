// The player's teams, once they're signed in: the browser keeps its own copy (apps/web/src/lib/teams.tsx)
// and syncs it here. Anyone with a team's link can read it; only its owner can change it
// (packages/api/src/routers/team.ts).
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const team = sqliteTable(
  "team",
  {
    id: text("id").primaryKey(), // the browser's id (a UUID), so /team/<id> links keep working
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // name, mode, format, rules, pokemon: validated by the API before it's stored.
    data: text("data", { mode: "json" }).notNull(),
    // The browser's last change (ms): the newer copy wins when two devices sync.
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("team_userId_idx").on(table.userId)],
);
