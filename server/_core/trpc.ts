import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

import { sysLogger, createLog } from '../services/systemLogService';

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

const loggingMiddleware = t.middleware(async (opts) => {
  const start = Date.now();
  const { path, type, ctx, next, input } = opts;

  const result = await next();

  const durationMs = Date.now() - start;
  const level = result.ok ? 'info' : 'error';

  // Log all mutations and any errors (including queries)
  if (type === 'mutation' || !result.ok) {
    await createLog({
      level,
      category: `trpc:${type}`,
      message: `[TRPC] ${type} ${path} - ${result.ok ? 'SUCCESS' : 'FAILURE'} (${durationMs}ms)`,
      metadata: JSON.stringify({
        path,
        type,
        durationMs,
        ok: result.ok,
        error: !result.ok ? result.error : undefined,
        input: (type === 'mutation' && input) ? input : undefined
      }),
      userId: ctx.user?.id,
    });
  }

  return result;
});

export const router = t.router;
export const publicProcedure = t.procedure.use(loggingMiddleware);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export const artistProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "artist" && ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Artist access required",
    });
  }
  return next({ ctx });
});
