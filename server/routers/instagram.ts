/**
 * instagram.ts — tRPC router for Instagram portfolio import
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as schema from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { getInstagramProvider } from "../services/instagramProvider";
import { processInstagramImport } from "../services/instagramImportWorker";

export const instagramRouter = router({
  /**
   * Verify an Instagram username exists and return profile info.
   */
  verifyUsername: protectedProcedure
    .input(z.object({ username: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const provider = getInstagramProvider();
      try {
        const userInfo = await provider.getUserInfo(input.username);
        if (userInfo.isPrivate) {
          return { success: false, error: "This account is private", userInfo: null };
        }
        return { success: true, error: null, userInfo };
      } catch (err: any) {
        return { success: false, error: err.message || "Could not find this account", userInfo: null };
      }
    }),

  /**
   * Start an Instagram portfolio import.
   * Creates an import record and begins processing in the background.
   */
  startImport: protectedProcedure
    .input(z.object({ username: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "artist" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Check for existing in-progress import
      const existing = await db.query.instagramImports.findFirst({
        where: and(
          eq(schema.instagramImports.artistId, ctx.user.id),
          eq(schema.instagramImports.status, "in_progress")
        ),
      });
      if (existing) {
        return { importId: existing.id, alreadyRunning: true };
      }

      // Create import record
      const [result] = await db.insert(schema.instagramImports).values({
        artistId: ctx.user.id,
        instagramUsername: input.username.replace(/^@/, ""),
        status: "in_progress",
      });

      const importId = result.insertId;

      // Start processing in background (don't await)
      processInstagramImport(
        db,
        importId,
        ctx.user.id,
        input.username.replace(/^@/, "")
      ).catch((err) => {
        console.error(`[IG Import] Background import #${importId} crashed:`, err);
      });

      return { importId, alreadyRunning: false };
    }),

  /**
   * Get the current status of an import (for polling progress).
   */
  getImportStatus: protectedProcedure
    .input(z.object({ importId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const importRecord = await db.query.instagramImports.findFirst({
        where: and(
          eq(schema.instagramImports.id, input.importId),
          eq(schema.instagramImports.artistId, ctx.user.id)
        ),
      });

      if (!importRecord) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return importRecord;
    }),

  /**
   * Get the latest import for the current artist.
   */
  getLatestImport: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const latest = await db.query.instagramImports.findFirst({
      where: eq(schema.instagramImports.artistId, ctx.user.id),
      orderBy: [desc(schema.instagramImports.createdAt)],
    });

    return latest || null;
  }),

  /**
   * Get a fresh video URL for a specific portfolio item (for reel playback).
   */
  getVideoUrl: protectedProcedure
    .input(z.object({ portfolioItemId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const item = await db.query.portfolios.findFirst({
        where: eq(schema.portfolios.id, input.portfolioItemId),
      });

      if (!item || item.mediaType !== "video") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Video not found" });
      }

      // Return the currently stored CDN URL
      // In future, refresh if expired
      return { videoUrl: item.cdnUrl || null };
    }),

  /**
   * Stop/cancel an in-progress import.
   * Sets the status to "cancelled" — the worker checks for this and stops gracefully.
   */
  stopImport: protectedProcedure
    .input(z.object({ importId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const importRecord = await db.query.instagramImports.findFirst({
        where: and(
          eq(schema.instagramImports.id, input.importId),
          eq(schema.instagramImports.artistId, ctx.user.id)
        ),
      });

      if (!importRecord) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (importRecord.status !== "in_progress") {
        return { success: false, message: "Import is not in progress" };
      }

      // Set status to cancelled — worker will pick this up and stop
      await db
        .update(schema.instagramImports)
        .set({ status: "cancelled", updatedAt: sql`NOW()` })
        .where(eq(schema.instagramImports.id, input.importId));

      return { success: true };
    }),
});
