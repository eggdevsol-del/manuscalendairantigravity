import {
  CONTROL_QUERIES,
  CONTROL_MUTATIONS,
  queryPracticeControl,
  mutatePracticeControl,
} from "../../shared/practiceControls";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { artistProcedure, router } from "../_core/trpc";
import { getDb, withDatabaseTransaction } from "../services/core";
import {
  PRACTICE_CHAPTERS,
  seedPractice,
  startPractice,
  advancePractice,
  previousPractice,
  type PracticeState,
} from "../../shared/practice";

/** Only this dedicated table is touched. Mock clients never become user/booking rows. */
async function readSession(userId: string): Promise<PracticeState> {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Practice storage is unavailable.",
    });
  const seed = seedPractice();
  await db.execute(
    sql`INSERT IGNORE INTO artist_practice_sessions (artist_id, revision, state) VALUES (${userId}, 0, ${JSON.stringify(seed)})`
  );
  const [rows] = await db.execute(
    sql`SELECT state FROM artist_practice_sessions WHERE artist_id = ${userId}`
  );
  return JSON.parse(
    (rows as unknown as { state: string }[])[0].state
  ) as PracticeState;
}
export const practiceRouter = router({
  template: artistProcedure.query(() => ({
    version: 1,
    chapters: PRACTICE_CHAPTERS,
  })),
  session: artistProcedure.query(({ ctx }) => readSession(ctx.user.id)),
  controlQuery: artistProcedure
    .input(
      z.object({ path: z.enum(CONTROL_QUERIES), input: z.unknown().optional() })
    )
    .query(async ({ ctx, input }) =>
      queryPracticeControl(
        await readSession(ctx.user.id),
        input.path,
        input.input
      )
    ),
  controlMutation: artistProcedure
    .input(
      z
        .object({
          revision: z.number().int().nonnegative(),
          path: z.enum(CONTROL_MUTATIONS),
          input: z.unknown().optional(),
        })
        .refine(
          v => JSON.stringify(v.input ?? {}).length <= 100000,
          "Practice input is too large"
        )
    )
    .mutation(async ({ ctx, input }) => {
      await readSession(ctx.user.id);
      return withDatabaseTransaction(async db => {
        const [rows] = await db.execute(
          sql`SELECT state, revision FROM artist_practice_sessions WHERE artist_id = ${ctx.user.id} FOR UPDATE`
        );
        const row = (
          rows as unknown as { state: string; revision: number }[]
        )[0];
        if (row.revision !== input.revision)
          throw new TRPCError({
            code: "CONFLICT",
            message: "Practice changed. Reload before continuing.",
          });
        let result;
        try {
          result = mutatePracticeControl(
            JSON.parse(row.state),
            input.path,
            input.input ?? {}
          );
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: e instanceof Error ? e.message : "Invalid practice action",
          });
        }
        await db.execute(
          sql`UPDATE artist_practice_sessions SET revision=${result.state.revision}, state=${JSON.stringify(result.state)} WHERE artist_id=${ctx.user.id}`
        );
        return result;
      });
    }),
  command: artistProcedure
    .input(
      z.object({
        revision: z.number().int().nonnegative(),
        action: z.enum(["start", "advance", "reset", "back"]),
        chapterId: z.string().max(80).optional(),
        stepId: z.string().max(80).optional(),
        values: z
          .record(z.string().max(80), z.string().max(4000))
          .refine(
            value => Object.keys(value).length <= 30,
            "Too many practice fields"
          )
          .default({}),
        outcome: z.enum(["success", "decline", "failure"]).default("success"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await readSession(ctx.user.id);
      return withDatabaseTransaction(async db => {
        const [rows] = await db.execute(
          sql`SELECT state, revision FROM artist_practice_sessions WHERE artist_id = ${ctx.user.id} FOR UPDATE`
        );
        const row = (
          rows as unknown as { state: string; revision: number }[]
        )[0];
        if (row.revision !== input.revision)
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Practice changed on another tab or device. Reload to continue.",
          });
        const state = JSON.parse(row.state) as PracticeState;
        let next: PracticeState;
        try {
          next =
            input.action === "back"
              ? previousPractice(state)
              : input.action === "reset"
                ? { ...seedPractice(), revision: state.revision + 1 }
                : input.action === "start"
                  ? startPractice(state, input.chapterId ?? "")
                  : advancePractice(
                      state,
                      input.stepId ?? "",
                      input.values,
                      input.outcome
                    );
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: e instanceof Error ? e.message : "Invalid practice action",
          });
        }
        await db.execute(
          sql`UPDATE artist_practice_sessions SET revision=${next.revision}, state=${JSON.stringify(next)} WHERE artist_id=${ctx.user.id}`
        );
        return next;
      });
    }),
});
