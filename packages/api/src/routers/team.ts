// Saved teams. Reading one is public (anyone with its link sees it, read-only); listing and saving are
// for its signed-in owner only.
import { team } from "@pkmnteambuilder/db/schema/index";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";
import { type TeamData, teamData, teamId } from "../team-schema";

// A stored row as the browser's Team. `data` was validated on the way in.
const toTeam = (row: typeof team.$inferSelect) => ({
  ...(row.data as TeamData),
  id: row.id,
  updatedAt: row.updatedAt,
});

export const teamRouter = router({
  // null when no signed-in player saved a team with this id.
  get: publicProcedure.input(z.object({ id: teamId })).query(async ({ ctx, input }) => {
    const [row] = await ctx.db.select().from(team).where(eq(team.id, input.id));
    if (!row) return null;
    return { team: toTeam(row), isOwner: row.userId === ctx.session?.user.id };
  }),

  mine: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.select().from(team).where(eq(team.userId, ctx.session.user.id));
    return rows.map(toTeam);
  }),

  // Creates the team, or updates it when it's the caller's. Someone else's team: FORBIDDEN.
  save: protectedProcedure
    .input(z.object({ id: teamId, data: teamData, updatedAt: z.int().min(0) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [existing] = await ctx.db
        .select({ userId: team.userId, updatedAt: team.updatedAt })
        .from(team)
        .where(eq(team.id, input.id));
      if (existing && existing.userId !== userId)
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your team" });
      // An older copy (another device that hadn't synced yet) doesn't overwrite a newer one.
      if (existing && existing.updatedAt > input.updatedAt) return { saved: false };
      await ctx.db
        .insert(team)
        .values({ id: input.id, userId, data: input.data, updatedAt: input.updatedAt })
        .onConflictDoUpdate({
          target: team.id,
          set: { data: input.data, updatedAt: input.updatedAt },
          // Never someone else's row, even if it appeared since the check above.
          setWhere: eq(team.userId, userId),
        });
      return { saved: true };
    }),
});
