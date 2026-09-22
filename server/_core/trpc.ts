import { usageActions } from "../services/usageActions";
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

import { sysLogger, createLog } from "../services/systemLogService";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

const loggingMiddleware = t.middleware(async opts => {
  const start = Date.now();
  const { path, type, ctx, next, input } = opts;

  const result = await next();

  const durationMs = Date.now() - start;
  const level = result.ok ? "info" : "error";

  // Log all mutations and any errors (including queries)
  if (type === "mutation" || !result.ok) {
    await createLog({
      level,
      category: `trpc:${type}`,
      message: `[TRPC] ${type} ${path} - ${result.ok ? "SUCCESS" : "FAILURE"} (${durationMs}ms)`,
      metadata: JSON.stringify({
        path,
        type,
        durationMs,
        ok: result.ok,
        error: !result.ok
          ? { message: result.error?.message, code: result.error?.code }
          : undefined,
        // Deliberately omit request inputs: these may contain passwords or medical data.
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

  if (!ctx.user || ctx.user.role?.startsWith("disabled_")) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const usageMiddleware = t.middleware(async ({ next, type, path, ctx }) => {
  const result = await next();
  const action = usageActions[path];
  if (
    result.ok &&
    type === "mutation" &&
    action &&
    ctx.user &&
    ctx.user.role !== "master_dev"
  )
    await createLog({
      level: "info",
      category: "usage:action",
      message: action,
      userId: ctx.user.id,
    });
  return result;
});
export const protectedProcedure = t.procedure
  .use(requireUser)
  .use(usageMiddleware);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
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

export const merchantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "merchant") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Merchant access required",
    });
  }
  return next({ ctx });
});
