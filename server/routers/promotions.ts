/**
 * Promotions Router - SSOT Compliant
 * 
 * Handles all promotion-related operations:
 * - Template CRUD (create, read, update, delete)
 * - Issuing promotions to clients
 * - Auto-apply rules
 * - Redemption during booking
 * 
 * @version 1.0.0
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as schema from "../../drizzle/schema";
import { eq, and, desc, or, gte, lte, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { getDb } from "../db";

// Input validation schemas
const promotionTypeEnum = z.enum(['voucher', 'discount', 'credit']);
const valueTypeEnum = z.enum(['fixed', 'percentage']);
const statusEnum = z.enum(['active', 'partially_used', 'fully_used', 'expired', 'revoked']);

export const promotionsRouter = router({
  /**
   * Create a new promotion template
   */
  createTemplate: protectedProcedure
    .input(z.object({
      type: promotionTypeEnum,
      name: z.string().min(1).max(255),
      description: z.string().max(500).nullable().optional(),
      valueType: valueTypeEnum.default('fixed'),
      value: z.number().min(1), // cents for fixed, percentage for percentage
      templateDesign: z.string().default('classic'),
      primaryColor: z.string().nullable().optional(),
      gradientFrom: z.string().nullable().optional(),
      gradientTo: z.string().nullable().optional(),
      customText: z.string().max(100).nullable().optional(),
      logoUrl: z.string().nullable().optional(),
      backgroundImageUrl: z.string().nullable().optional(),
      backgroundScale: z.number().min(0.5).max(3).optional(),
      backgroundPositionX: z.number().min(0).max(100).optional(),
      backgroundPositionY: z.number().min(0).max(100).optional(),
      validityDuration: z.number().min(1).nullable().optional(),
      autoApplyTrigger: z.enum(['none', 'new_client', 'birthday']).default('none'),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (ctx.user.role !== 'artist' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only artists can create promotions" });
        }

        const db = await getDb();
        if (!db) {
          console.error('[promotions.createTemplate] Database connection failed');
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        }

        const [result] = await db.insert(schema.promotionTemplates).values({
          artistId: ctx.user.id,
          type: input.type,
          name: input.name,
          description: input.description || null,
          valueType: input.valueType,
          value: input.value,
          templateDesign: input.templateDesign,
          primaryColor: input.primaryColor || null,
          gradientFrom: input.gradientFrom || null,
          gradientTo: input.gradientTo || null,
          customText: input.customText || null,
          logoUrl: input.logoUrl || null,
          backgroundImageUrl: input.backgroundImageUrl || null,
          backgroundScale: input.backgroundScale?.toString() || '1.00',
          backgroundPositionX: input.backgroundPositionX || 50,
          backgroundPositionY: input.backgroundPositionY || 50,
          isActive: 1,
          validityDuration: input.validityDuration || null,
          autoApplyTrigger: input.autoApplyTrigger,
        });

        console.log(`[promotions.createTemplate] Created template for artist ${ctx.user.id}`);
        return { success: true, id: result.insertId };
      } catch (error) {
        console.error('[promotions.createTemplate] Error:', error);
        throw error;
      }
    }),

  /**
   * Update an existing promotion template
   */
  updateTemplate: protectedProcedure
    .input(z.object({
      id: z.number(),
      type: promotionTypeEnum,
      name: z.string().min(1).max(255),
      description: z.string().max(500).nullable().optional(),
      valueType: valueTypeEnum.default('fixed'),
      value: z.number().min(1),
      templateDesign: z.string().default('classic'),
      primaryColor: z.string().nullable().optional(),
      gradientFrom: z.string().nullable().optional(),
      gradientTo: z.string().nullable().optional(),
      customText: z.string().max(100).nullable().optional(),
      logoUrl: z.string().nullable().optional(),
      backgroundImageUrl: z.string().nullable().optional(),
      backgroundScale: z.number().min(0.5).max(3).optional(),
      backgroundPositionX: z.number().min(0).max(100).optional(),
      backgroundPositionY: z.number().min(0).max(100).optional(),
      validityDuration: z.number().min(1).nullable().optional(),
      autoApplyTrigger: z.enum(['none', 'new_client', 'birthday']).default('none'),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (ctx.user.role !== 'artist' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only artists can update promotions" });
        }

        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        }

        // Verify ownership
        const existing = await db.query.promotionTemplates.findFirst({
          where: and(
            eq(schema.promotionTemplates.id, input.id),
            eq(schema.promotionTemplates.artistId, ctx.user.id)
          )
        });

        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Promotion not found" });
        }

        await db.update(schema.promotionTemplates)
          .set({
            type: input.type,
            name: input.name,
            description: input.description || null,
            valueType: input.valueType,
            value: input.value,
            templateDesign: input.templateDesign,
            primaryColor: input.primaryColor || null,
            gradientFrom: input.gradientFrom || null,
            gradientTo: input.gradientTo || null,
            customText: input.customText || null,
            logoUrl: input.logoUrl || null,
            backgroundImageUrl: input.backgroundImageUrl || null,
            backgroundScale: input.backgroundScale?.toString() || '1.00',
            backgroundPositionX: input.backgroundPositionX || 50,
            backgroundPositionY: input.backgroundPositionY || 50,
            validityDuration: input.validityDuration || null,
            autoApplyTrigger: input.autoApplyTrigger,
            updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
          })
          .where(eq(schema.promotionTemplates.id, input.id));

        console.log(`[promotions.updateTemplate] Updated template ${input.id} for artist ${ctx.user.id}`);
        return { success: true };
      } catch (error) {
        console.error('[promotions.updateTemplate] Error:', error);
        throw error;
      }
    }),

  /**
   * Get promotions based on role
   * - Artists: Get their templates
   * - Clients: Get promotions issued to them
   */
  getPromotions: protectedProcedure
    .input(z.object({
      type: promotionTypeEnum.optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) {
          console.error('[promotions.getPromotions] Database connection failed');
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        }

        const isArtist = ctx.user.role === 'artist' || ctx.user.role === 'admin';

        if (isArtist) {
          // Artists see their templates
          const templates = await db.query.promotionTemplates.findMany({
            where: and(
              eq(schema.promotionTemplates.artistId, ctx.user.id),
              eq(schema.promotionTemplates.isActive, 1),
              input?.type ? eq(schema.promotionTemplates.type, input.type) : undefined
            ),
            orderBy: desc(schema.promotionTemplates.createdAt),
          });

          return templates.map(t => ({
            id: t.id,
            type: t.type,
            name: t.name,
            description: t.description,
            valueType: t.valueType,
            value: t.value,
            remainingValue: t.value,
            templateDesign: t.templateDesign,
            primaryColor: t.primaryColor,
            gradientFrom: t.gradientFrom,
            gradientTo: t.gradientTo,
            customText: t.customText,
            logoUrl: t.logoUrl,
            backgroundImageUrl: t.backgroundImageUrl,
            backgroundScale: t.backgroundScale ? parseFloat(t.backgroundScale) : 1,
            backgroundPositionX: t.backgroundPositionX,
            backgroundPositionY: t.backgroundPositionY,
            status: 'active' as const,
            code: null,
            expiresAt: null,
            validityDuration: t.validityDuration, // Return validityDuration
            autoApplyTrigger: t.autoApplyTrigger, // Return autoApplyTrigger
          }));
        } else {
          // Clients see promotions issued to them
          const promotions = await db.query.issuedPromotions.findMany({
            where: and(
              eq(schema.issuedPromotions.clientId, ctx.user.id),
              input?.type ? eq(schema.issuedPromotions.type, input.type) : undefined
            ),
            with: {
              template: true,
            },
            orderBy: desc(schema.issuedPromotions.createdAt),
          });

          return promotions.map(p => ({
            id: p.id,
            type: p.type,
            name: p.template?.name || 'Promotion',
            description: p.template?.description,
            valueType: p.valueType,
            value: p.originalValue,
            remainingValue: p.remainingValue,
            templateDesign: p.template?.templateDesign || 'classic',
            primaryColor: p.template?.primaryColor,
            gradientFrom: p.template?.gradientFrom,
            gradientTo: p.template?.gradientTo,
            customText: p.template?.customText,
            logoUrl: p.template?.logoUrl,
            backgroundImageUrl: p.template?.backgroundImageUrl,
            backgroundScale: p.template?.backgroundScale ? parseFloat(p.template?.backgroundScale) : 1,
            backgroundPositionX: p.template?.backgroundPositionX,
            backgroundPositionY: p.template?.backgroundPositionY,
            status: p.status,
            code: p.code,
            expiresAt: p.expiresAt,
            // Clients don't need to see logic fields
          }));
        }
      } catch (error) {
        console.error('[promotions.getPromotions] Error:', error);
        throw error;
      }
    }),

  /**
   * Issue a promotion to a specific client
   */
  issuePromotion: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      clientId: z.string(),
      expiresInDays: z.number().min(1).max(365).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (ctx.user.role !== 'artist' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only artists can issue promotions" });
        }

        const db = await getDb();
        if (!db) {
          console.error('[promotions.issuePromotion] Database connection failed');
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        }

        // Get template
        const template = await db.query.promotionTemplates.findFirst({
          where: and(
            eq(schema.promotionTemplates.id, input.templateId),
            eq(schema.promotionTemplates.artistId, ctx.user.id)
          ),
        });

        if (!template) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        }

        // Generate unique code
        const code = randomBytes(4).toString('hex').toUpperCase();

        // Calculate expiry
        let expiresAt: string | null = null;

        // Priority: Input override > Template default > No expiry
        const daysValid = input.expiresInDays || template.validityDuration;

        if (daysValid) {
          const date = new Date();
          date.setDate(date.getDate() + daysValid);
          expiresAt = date.toISOString().slice(0, 19).replace('T', ' ');
        }

        await db.insert(schema.issuedPromotions).values({
          templateId: input.templateId,
          artistId: ctx.user.id,
          clientId: input.clientId,
          code,
          type: template.type,
          valueType: template.valueType,
          originalValue: template.value,
          remainingValue: template.value,
          isAutoApply: 0,
          status: 'active',
          expiresAt,
        });

        // Add to notification outbox
        await db.insert(schema.notificationOutbox).values({
          eventType: 'push_message',
          payloadJson: JSON.stringify({
            targetUserId: input.clientId,
            title: 'You received a new promotion!',
            body: `You have received a ${template.name} voucher!`,
            data: {
              url: '/promotions',
              promotionId: input.templateId,
              code
            }
          }),
          status: 'pending',
        });

        console.log(`[promotions.issuePromotion] Issued promotion ${code} to client ${input.clientId}`);
        return { success: true, code };
      } catch (error) {
        console.error('[promotions.issuePromotion] Error:', error);
        throw error;
      }
    }),

  /**
   * Create auto-apply rule for new clients
   */
  createAutoApply: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (ctx.user.role !== 'artist' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only artists can create auto-apply rules" });
        }

        const db = await getDb();
        if (!db) {
          console.error('[promotions.createAutoApply] Database connection failed');
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        }

        // Get template
        const template = await db.query.promotionTemplates.findFirst({
          where: and(
            eq(schema.promotionTemplates.id, input.templateId),
            eq(schema.promotionTemplates.artistId, ctx.user.id)
          ),
        });

        if (!template) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        }

        // Generate unique code for auto-apply tracking
        const code = `AUTO-${randomBytes(4).toString('hex').toUpperCase()}`;

        await db.insert(schema.issuedPromotions).values({
          templateId: input.templateId,
          artistId: ctx.user.id,
          clientId: null, // null = auto-apply to all new clients
          code,
          type: template.type,
          valueType: template.valueType,
          originalValue: template.value,
          remainingValue: template.value,
          isAutoApply: 1,
          autoApplyStartDate: input.startDate,
          autoApplyEndDate: input.endDate,
          status: 'active',
        });

        console.log(`[promotions.createAutoApply] Created auto-apply rule for template ${input.templateId}`);
        return { success: true };
      } catch (error) {
        console.error('[promotions.createAutoApply] Error:', error);
        throw error;
      }
    }),

  /**
   * Get available promotions for a client to use on a booking
   */
  getAvailableForBooking: protectedProcedure
    .input(z.object({
      artistId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) {
          console.error('[promotions.getAvailableForBooking] Database connection failed');
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        }

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Get promotions issued to this client from this artist
        const promotions = await db.query.issuedPromotions.findMany({
          where: and(
            eq(schema.issuedPromotions.clientId, ctx.user.id),
            eq(schema.issuedPromotions.artistId, input.artistId),
            or(
              eq(schema.issuedPromotions.status, 'active'),
              eq(schema.issuedPromotions.status, 'partially_used')
            ),
            or(
              isNull(schema.issuedPromotions.expiresAt),
              gte(schema.issuedPromotions.expiresAt, now)
            )
          ),
          with: {
            template: true,
          },
          orderBy: desc(schema.issuedPromotions.createdAt),
        });

        return promotions.map(p => ({
          id: p.id,
          type: p.type,
          name: p.template?.name || 'Promotion',
          valueType: p.valueType,
          value: p.originalValue,
          remainingValue: p.remainingValue,
          templateDesign: p.template?.templateDesign || 'classic',
          primaryColor: p.template?.primaryColor,
          gradientFrom: p.template?.gradientFrom,
          code: p.code,
          expiresAt: p.expiresAt,
        }));
      } catch (error) {
        console.error('[promotions.getAvailableForBooking] Error:', error);
        throw error;
      }
    }),

  /**
   * Redeem a promotion on a booking
   */
  redeemPromotion: protectedProcedure
    .input(z.object({
      promotionId: z.number(),
      appointmentId: z.number(),
      originalAmount: z.number(), // in cents
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) {
          console.error('[promotions.redeemPromotion] Database connection failed');
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        }

        // Get promotion
        const promotion = await db.query.issuedPromotions.findFirst({
          where: and(
            eq(schema.issuedPromotions.id, input.promotionId),
            eq(schema.issuedPromotions.clientId, ctx.user.id),
            or(
              eq(schema.issuedPromotions.status, 'active'),
              eq(schema.issuedPromotions.status, 'partially_used')
            )
          ),
        });

        if (!promotion) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Promotion not found or not available" });
        }

        // Calculate redemption amount
        let amountRedeemed: number;
        let finalAmount: number;

        if (promotion.valueType === 'percentage') {
          // Percentage discount
          amountRedeemed = Math.round(input.originalAmount * (promotion.remainingValue / 100));
          finalAmount = input.originalAmount - amountRedeemed;
        } else {
          // Fixed amount
          amountRedeemed = Math.min(promotion.remainingValue, input.originalAmount);
          finalAmount = input.originalAmount - amountRedeemed;
        }

        // Ensure final amount is not negative
        finalAmount = Math.max(0, finalAmount);

        // Calculate new remaining value
        const newRemainingValue = promotion.valueType === 'percentage'
          ? 0 // Percentage discounts are fully used in one transaction
          : promotion.remainingValue - amountRedeemed;

        // Determine new status
        const newStatus = newRemainingValue <= 0 ? 'fully_used' : 'partially_used';

        // Create redemption record
        await db.insert(schema.promotionRedemptions).values({
          promotionId: input.promotionId,
          appointmentId: input.appointmentId,
          amountRedeemed,
          originalAmount: input.originalAmount,
          finalAmount,
        });

        // Update promotion status
        await db.update(schema.issuedPromotions)
          .set({
            remainingValue: newRemainingValue,
            status: newStatus,
            redeemedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
            redeemedOnAppointmentId: input.appointmentId,
          })
          .where(eq(schema.issuedPromotions.id, input.promotionId));

        // Update appointment price
        await db.update(schema.appointments)
          .set({
            price: finalAmount,
          })
          .where(eq(schema.appointments.id, input.appointmentId));

        console.log(`[promotions.redeemPromotion] Redeemed ${amountRedeemed} cents on appointment ${input.appointmentId}`);

        return {
          success: true,
          amountRedeemed,
          finalAmount,
          newRemainingValue,
          newStatus,
        };
      } catch (error) {
        console.error('[promotions.redeemPromotion] Error:', error);
        throw error;
      }
    }),

  /**
   * Update auto-apply settings for a template
   */
  updateAutoApply: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      isAutoApply: z.boolean(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (ctx.user.role !== 'artist' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only artists can update auto-apply settings" });
        }

        const db = await getDb();
        if (!db) {
          console.error('[promotions.updateAutoApply] Database connection failed');
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        }

        // Get template
        const template = await db.query.promotionTemplates.findFirst({
          where: and(
            eq(schema.promotionTemplates.id, input.templateId),
            eq(schema.promotionTemplates.artistId, ctx.user.id)
          ),
        });

        if (!template) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        }

        if (input.isAutoApply) {
          // Check if auto-apply rule already exists
          const existingRule = await db.query.issuedPromotions.findFirst({
            where: and(
              eq(schema.issuedPromotions.templateId, input.templateId),
              eq(schema.issuedPromotions.isAutoApply, 1),
              eq(schema.issuedPromotions.status, 'active')
            ),
          });

          if (existingRule) {
            // Update existing rule
            await db.update(schema.issuedPromotions)
              .set({
                autoApplyStartDate: input.startDate || null,
                autoApplyEndDate: input.endDate || null,
              })
              .where(eq(schema.issuedPromotions.id, existingRule.id));
          } else {
            // Create new auto-apply rule
            const code = `AUTO-${randomBytes(4).toString('hex').toUpperCase()}`;
            await db.insert(schema.issuedPromotions).values({
              templateId: input.templateId,
              artistId: ctx.user.id,
              clientId: null,
              code,
              type: template.type,
              valueType: template.valueType,
              originalValue: template.value,
              remainingValue: template.value,
              isAutoApply: 1,
              autoApplyStartDate: input.startDate || null,
              autoApplyEndDate: input.endDate || null,
              status: 'active',
            });
          }
        } else {
          // Disable auto-apply by revoking the rule
          await db.update(schema.issuedPromotions)
            .set({ status: 'revoked' })
            .where(and(
              eq(schema.issuedPromotions.templateId, input.templateId),
              eq(schema.issuedPromotions.isAutoApply, 1),
              eq(schema.issuedPromotions.status, 'active')
            ));
        }

        console.log(`[promotions.updateAutoApply] Updated auto-apply for template ${input.templateId}: ${input.isAutoApply}`);
        return { success: true };
      } catch (error) {
        console.error('[promotions.updateAutoApply] Error:', error);
        throw error;
      }
    }),

  /**
   * Delete a promotion template
   */
  deleteTemplate: protectedProcedure
    .input(z.object({
      templateId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (ctx.user.role !== 'artist' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only artists can delete promotions" });
        }

        const db = await getDb();
        if (!db) {
          console.error('[promotions.deleteTemplate] Database connection failed');
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        }

        // Soft delete by setting isActive to 0
        await db.update(schema.promotionTemplates)
          .set({ isActive: 0 })
          .where(and(
            eq(schema.promotionTemplates.id, input.templateId),
            eq(schema.promotionTemplates.artistId, ctx.user.id)
          ));

        console.log(`[promotions.deleteTemplate] Deleted template ${input.templateId}`);
        return { success: true };
      } catch (error) {
        console.error('[promotions.deleteTemplate] Error:', error);
        throw error;
      }
    }),

  /**
   * Get all promotions issued to a specific client (Artist view)
   */
  getClientPromotions: protectedProcedure
    .input(z.object({
      clientId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        if (ctx.user.role !== 'artist' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only artists can view client promotions" });
        }

        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        }

        const promotions = await db.query.issuedPromotions.findMany({
          where: and(
            eq(schema.issuedPromotions.clientId, input.clientId),
            eq(schema.issuedPromotions.artistId, ctx.user.id)
          ),
          with: {
            template: true,
          },
          orderBy: desc(schema.issuedPromotions.createdAt),
        });

        return promotions.map(p => ({
          id: p.id,
          type: p.type,
          name: p.template?.name || 'Promotion',
          valueType: p.valueType,
          originalValue: p.originalValue,
          remainingValue: p.remainingValue,
          originalAmount: p.originalValue, // Alias for consistency if needed
          code: p.code,
          status: p.status,
          expiresAt: p.expiresAt,
          issuedAt: p.createdAt,
          redeemedAt: p.redeemedAt,
        }));
      } catch (error) {
        console.error('[promotions.getClientPromotions] Error:', error);
        throw error;
      }
    }),

  /**
   * Update an issued promotion (e.g. change expiry)
   */
  updateIssuedPromotion: protectedProcedure
    .input(z.object({
      id: z.number(),
      expiresAt: z.string().nullable(), // ISO date string or null
      status: statusEnum.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (ctx.user.role !== 'artist' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only artists can update issued promotions" });
        }

        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        }

        // Verify ownership
        const existing = await db.query.issuedPromotions.findFirst({
          where: and(
            eq(schema.issuedPromotions.id, input.id),
            eq(schema.issuedPromotions.artistId, ctx.user.id)
          )
        });

        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Promotion not found" });
        }

        await db.update(schema.issuedPromotions)
          .set({
            expiresAt: input.expiresAt,
            status: input.status || existing.status,
            updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
          })
          .where(eq(schema.issuedPromotions.id, input.id));

        console.log(`[promotions.updateIssuedPromotion] Updated promotion ${input.id}`);
        return { success: true };
      } catch (error) {
        console.error('[promotions.updateIssuedPromotion] Error:', error);
        throw error;
      }
    }),
});

/**
 * Helper to check and apply 'New Client' promotions
 * Should be called when a client makes their first booking
 */
export async function checkAndApplyNewClient(artistId: string, clientId: string) {
  try {
    const db = await getDb();
    if (!db) return;

    // 1. Get all active 'new_client' templates for this artist
    const templates = await db.query.promotionTemplates.findMany({
      where: and(
        eq(schema.promotionTemplates.artistId, artistId),
        eq(schema.promotionTemplates.isActive, 1),
        eq(schema.promotionTemplates.autoApplyTrigger, 'new_client')
      )
    });

    if (templates.length === 0) return;

    console.log(`[checkAndApplyNewClient] Found ${templates.length} templates for artist ${artistId}`);

    for (const template of templates) {
      // 2. Check if client already has this promotion (to prevent duplicates)
      const existing = await db.query.issuedPromotions.findFirst({
        where: and(
          eq(schema.issuedPromotions.templateId, template.id),
          eq(schema.issuedPromotions.clientId, clientId)
        )
      });

      if (existing) {
        continue;
      }

      // 3. Issue the promotion
      const code = randomBytes(4).toString('hex').toUpperCase();
      let expiresAt: string | null = null;

      if (template.validityDuration) {
        const date = new Date();
        date.setDate(date.getDate() + template.validityDuration);
        expiresAt = date.toISOString().slice(0, 19).replace('T', ' ');
      }

      await db.insert(schema.issuedPromotions).values({
        templateId: template.id,
        artistId: artistId,
        clientId: clientId,
        code,
        type: template.type,
        valueType: template.valueType,
        originalValue: template.value,
        remainingValue: template.value,
        isAutoApply: 1,
        status: 'active',
        expiresAt,
      });

      console.log(`[checkAndApplyNewClient] Issued auto-promotion ${code} to ${clientId}`);
    }
  } catch (error) {
    console.error('[checkAndApplyNewClient] Error:', error);
  }
}
