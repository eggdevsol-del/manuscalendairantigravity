import { TRPCError } from "@trpc/server";
import { systemRouter as coreSystemRouter } from "../_core/systemRouter";
import { artistProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const systemRouter = router({
    ...coreSystemRouter._def.procedures
});
