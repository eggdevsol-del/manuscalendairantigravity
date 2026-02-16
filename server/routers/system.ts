import { z } from "zod";
import { systemRouter as coreSystemRouter } from "../_core/systemRouter";
import { publicProcedure, router } from "../_core/trpc";
import { createLog } from "../services/systemLogService";

export const systemRouter = router({
    ...coreSystemRouter._def.procedures,
    addLog: publicProcedure
        .input(z.object({
            level: z.enum(['debug', 'info', 'warn', 'error']),
            category: z.string(),
            message: z.string(),
            metadata: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            const userAgent = ctx.req.headers['user-agent'];
            const ipAddress = (ctx.req.headers['x-forwarded-for'] as string) || ctx.req.socket.remoteAddress;

            await createLog({
                ...input,
                userId: ctx.user?.id,
                ipAddress,
                userAgent,
            });
            return { success: true };
        }),
});
