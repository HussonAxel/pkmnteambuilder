import { protectedProcedure, publicProcedure, router } from "../index";
import { teamRouter } from "./team";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  team: teamRouter,
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
});
export type AppRouter = typeof appRouter;
