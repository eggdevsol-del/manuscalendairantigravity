/**
 * Funnel Router
 * 
 * Handles public funnel endpoints and lead management.
 * Some endpoints are public (no auth required), others require authentication.
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import * as schema from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  deriveTagLabels,
  calculatePriorityScore,
  getPriorityTier,
  estimateLeadValue
} from "../services/tagDerivationEngine";

// Helper to format date for MySQL
function formatDateForMySQL(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export const funnelRouter = router({
  /**
   * Check if a slug is available
   * PUBLIC - no auth required
   */
  checkSlugAvailability: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { available: false };

      const existing = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.publicSlug, input.slug.toLowerCase()),
      });

      return { available: !existing };
    }),

  /**
   * Get deposit info for client payment page
   * PUBLIC - no auth required (uses token)
   */
  getDepositInfo: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      // In production, this would decode a JWT or lookup a proposal by token
      // For now, return mock data structure
      return null;
    }),

  /**
   * Confirm deposit payment
   * PUBLIC - no auth required (uses token)
   */
  confirmDeposit: publicProcedure
    .input(z.object({
      token: z.string(),
      paymentMethod: z.enum(['stripe', 'paypal', 'bank', 'cash']),
      proofUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // In production, this would update the proposal/booking status
      return { success: true };
    }),

  /**
   * Get artist profile for public funnel display
   * PUBLIC - no auth required
   */
  getArtistBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Find artist settings by slug
      const settings = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.publicSlug, input.slug.toLowerCase()),
      });

      if (!settings || !settings.funnelEnabled) {
        return null;
      }

      // Get artist user info
      const artist = await db.query.users.findFirst({
        where: eq(schema.users.id, settings.userId),
      });

      if (!artist) {
        return null;
      }

      return {
        id: artist.id,
        displayName: artist.name || 'Artist',
        profileImage: artist.avatar || null,
        slug: settings.publicSlug,
        funnelWelcomeMessage: settings.funnelWelcomeMessage,
        styleOptions: settings.styleOptions ? JSON.parse(settings.styleOptions) : [],
        placementOptions: settings.placementOptions ? JSON.parse(settings.placementOptions) : [],
        budgetRanges: settings.budgetRanges ? JSON.parse(settings.budgetRanges) : [],
      };
    }),

  /**
   * Submit funnel data (create or update lead)
   * PUBLIC - no auth required
   */
  submitFunnel: publicProcedure
    .input(z.object({
      artistSlug: z.string(),
      sessionId: z.string(),
      stepData: z.object({
        intent: z.object({
          projectType: z.string().optional(),
          projectDescription: z.string().optional(),
        }).optional(),
        contact: z.object({
          name: z.string(),
          email: z.string().email(),
          phone: z.string().optional(),
        }).optional(),
        style: z.object({
          stylePreferences: z.array(z.string()).optional(),
          referenceImages: z.array(z.string()).optional(),
        }).optional(),
        budget: z.object({
          placement: z.string().optional(),
          estimatedSize: z.string().optional(),
          budgetMin: z.number().optional(),
          budgetMax: z.number().nullable().optional(),
          budgetLabel: z.string().optional(),
        }).optional(),
        availability: z.object({
          preferredTimeframe: z.string().optional(),
          preferredMonths: z.array(z.string()).optional(),
          urgency: z.enum(['flexible', 'moderate', 'urgent']).optional(),
        }).optional(),
      }),
      currentStep: z.number(),
      isComplete: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');

      const now = new Date();
      const nowFormatted = formatDateForMySQL(now);

      // Get artist by slug
      const settings = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.publicSlug, input.artistSlug.toLowerCase()),
      });

      if (!settings) {
        throw new Error('Artist not found');
      }

      const artistId = settings.userId;

      // Check for existing funnel submission by session
      let existingSubmission = await db.query.funnelSessions.findFirst({
        where: eq(schema.funnelSessions.id, input.sessionId),
      });

      // Flatten step data for storage
      const flatData = {
        projectType: input.stepData.intent?.projectType,
        projectDescription: input.stepData.intent?.projectDescription,
        name: input.stepData.contact?.name,
        email: input.stepData.contact?.email,
        phone: input.stepData.contact?.phone,
        stylePreferences: input.stepData.style?.stylePreferences,
        referenceImages: input.stepData.style?.referenceImages,
        placement: input.stepData.budget?.placement,
        estimatedSize: input.stepData.budget?.estimatedSize,
        budgetMin: input.stepData.budget?.budgetMin ?? undefined,
        budgetMax: input.stepData.budget?.budgetMax ?? undefined,
        budgetLabel: input.stepData.budget?.budgetLabel,
        preferredTimeframe: input.stepData.availability?.preferredTimeframe,
        preferredMonths: input.stepData.availability?.preferredMonths,
        urgency: input.stepData.availability?.urgency,
      };

      // Calculate derived values
      const derivedTags = deriveTagLabels(flatData);
      const priorityScore = calculatePriorityScore({ ...flatData, createdAt: now });
      const priorityTier = getPriorityTier(priorityScore);
      const estimatedValue = estimateLeadValue(flatData);

      if (existingSubmission) {
        // Update existing submission
        await db.update(schema.funnelSessions)
          .set({
            stepData: JSON.stringify(input.stepData),
            currentStep: String(input.currentStep),
            completed: input.isComplete ? 1 : 0,
            completedAt: input.isComplete ? nowFormatted : null,
            lastActivityAt: nowFormatted,
          })
          .where(eq(schema.funnelSessions.id, existingSubmission.id));
      } else {
        // Create new submission
        await db.insert(schema.funnelSessions).values({
          id: input.sessionId,
          artistId,
          stepData: JSON.stringify(input.stepData),
          currentStep: String(input.currentStep),
          completed: input.isComplete ? 1 : 0,
          startedAt: nowFormatted,
          completedAt: input.isComplete ? nowFormatted : null,
          createdAt: nowFormatted,
        });
        existingSubmission = { id: input.sessionId } as any;
      }

      // If complete, create or update lead
      let leadId: number | null = null;

      if (input.isComplete && flatData.name && flatData.email) {
        // Check if lead already exists for this email + artist
        const existingLead = await db.query.leads.findFirst({
          where: and(
            eq(schema.leads.artistId, artistId),
            eq(schema.leads.email, flatData.email.toLowerCase())
          ),
        });

        if (existingLead) {
          // Update existing lead
          await db.update(schema.leads)
            .set({
              name: flatData.name,
              phone: flatData.phone || null,
              projectType: flatData.projectType || null,
              projectDescription: flatData.projectDescription || null,
              stylePreferences: flatData.stylePreferences ? JSON.stringify(flatData.stylePreferences) : null,
              referenceImages: flatData.referenceImages ? JSON.stringify(flatData.referenceImages) : null,
              placement: flatData.placement || null,
              estimatedSize: flatData.estimatedSize || null,
              budgetMin: flatData.budgetMin || null,
              budgetMax: flatData.budgetMax || null,
              preferredTimeframe: flatData.preferredTimeframe || null,
              preferredMonths: flatData.preferredMonths ? JSON.stringify(flatData.preferredMonths) : null,
              urgency: flatData.urgency || 'flexible',
              derivedTags: JSON.stringify(derivedTags),
              priorityScore,
              priorityTier,
              estimatedValue,
              funnelSessionId: existingSubmission!.id,
              updatedAt: nowFormatted,
            })
            .where(eq(schema.leads.id, existingLead.id));

          leadId = existingLead.id;
        } else {
          // Create new lead
          const [newLead] = await db.insert(schema.leads).values({
            artistId,
            source: 'funnel',
            sourceUrl: `/start/${input.artistSlug}`,
            status: 'new',
            name: flatData.name,
            email: flatData.email.toLowerCase(),
            phone: flatData.phone || null,
            projectType: flatData.projectType || null,
            projectDescription: flatData.projectDescription || null,
            stylePreferences: flatData.stylePreferences ? JSON.stringify(flatData.stylePreferences) : null,
            referenceImages: flatData.referenceImages ? JSON.stringify(flatData.referenceImages) : null,
            placement: flatData.placement || null,
            estimatedSize: flatData.estimatedSize || null,
            budgetMin: flatData.budgetMin || null,
            budgetMax: flatData.budgetMax || null,
            preferredTimeframe: flatData.preferredTimeframe || null,
            preferredMonths: flatData.preferredMonths ? JSON.stringify(flatData.preferredMonths) : null,
            urgency: flatData.urgency || 'flexible',
            derivedTags: JSON.stringify(derivedTags),
            priorityScore,
            priorityTier,
            estimatedValue,
            funnelSessionId: existingSubmission!.id,
            createdAt: nowFormatted,
            updatedAt: nowFormatted,
          });

          leadId = newLead.insertId;

          // Create a consultation record linked to the lead
          const [consultation] = await db.insert(schema.consultations).values({
            artistId,
            clientId: null, // Will be linked when client account is created
            leadId,
            subject: flatData.projectType || 'New Consultation',
            description: flatData.projectDescription || '',
            status: 'pending',
            createdAt: nowFormatted,
            updatedAt: nowFormatted,
          });

          // Create a conversation for the lead
          const [conversation] = await db.insert(schema.conversations).values({
            artistId,
            clientId: null,
            leadId,
            consultationId: consultation.insertId,
            lastMessageAt: nowFormatted,
            createdAt: nowFormatted,
            updatedAt: nowFormatted,
          });

          // Create initial message with funnel summary
          const summaryMessage = `New consultation request via booking link:

**Project:** ${flatData.projectType || 'Not specified'}
**Description:** ${flatData.projectDescription || 'Not provided'}
**Placement:** ${flatData.placement || 'Not specified'}
**Size:** ${flatData.estimatedSize || 'Not specified'}
**Budget:** ${flatData.budgetLabel || 'Not specified'}
**Timeframe:** ${flatData.preferredTimeframe || 'Flexible'}
**Urgency:** ${flatData.urgency || 'Flexible'}

**Contact:**
- Name: ${flatData.name}
- Email: ${flatData.email}
- Phone: ${flatData.phone || 'Not provided'}`;

          await db.insert(schema.messages).values({
            conversationId: conversation.insertId,
            senderId: artistId, // Use artistId as a workaround if field is not null
            messageType: 'system',
            content: summaryMessage,
            createdAt: nowFormatted,
          });
        }
      }

      return {
        success: true,
        leadId,
        derivedTags,
        priorityScore,
        priorityTier,
      };
    }),

  /**
   * Get leads for artist dashboard
   * PROTECTED - requires authentication
   */
  getLeads: protectedProcedure
    .input(z.object({
      status: z.enum(['new', 'contacted', 'qualified', 'proposal_sent', 'converted', 'lost', 'archived']).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { leads: [], total: 0 };

      const { user } = ctx;

      let query = db.query.leads.findMany({
        where: input.status
          ? and(eq(schema.leads.artistId, user.id), eq(schema.leads.status, input.status))
          : eq(schema.leads.artistId, user.id),
        orderBy: [desc(schema.leads.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      const leadsResult = await query;

      // Parse JSON fields
      // Parse JSON fields safely and ensure all fields are included
      const parsedLeads = leadsResult.map(lead => {
        const leadObj = lead as any;
        return {
          ...leadObj,
          derivedTags: lead.derivedTags ? JSON.parse(lead.derivedTags as string) : [],
          stylePreferences: lead.stylePreferences ? JSON.parse(lead.stylePreferences as string) : [],
          referenceImages: lead.referenceImages ? JSON.parse(lead.referenceImages as string) : [],
          preferredMonths: lead.preferredMonths ? JSON.parse(lead.preferredMonths as string) : [],
          bodyPlacementImages: lead.bodyPlacementImages ? JSON.parse(lead.bodyPlacementImages as string) : [],
        };
      });

      return {
        leads: parsedLeads,
        total: parsedLeads.length,
      };
    }),

  /**
   * Update lead status
   * PROTECTED - requires authentication
   */
  updateLeadStatus: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      status: z.enum(['new', 'contacted', 'qualified', 'proposal_sent', 'converted', 'lost', 'archived']),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');

      const { user } = ctx;
      const now = formatDateForMySQL(new Date());

      // Verify lead belongs to artist
      const lead = await db.query.leads.findFirst({
        where: and(
          eq(schema.leads.id, input.leadId),
          eq(schema.leads.artistId, user.id)
        ),
      });

      if (!lead) {
        throw new Error('Lead not found');
      }

      // Update status
      await db.update(schema.leads)
        .set({
          status: input.status,
          contactedAt: input.status === 'contacted' && !lead.contactedAt ? now : lead.contactedAt,
          convertedAt: input.status === 'converted' ? now : lead.convertedAt,
          updatedAt: now,
        })
        .where(eq(schema.leads.id, input.leadId));

      return { success: true };
    }),

  /**
   * Update artist funnel settings
   * PROTECTED - requires authentication
   */
  updateFunnelSettings: protectedProcedure
    .input(z.object({
      publicSlug: z.string().min(3).max(50).optional(),
      funnelEnabled: z.boolean().optional(),
      funnelWelcomeMessage: z.string().max(500).optional(),
      styleOptions: z.array(z.string()).optional(),
      placementOptions: z.array(z.string()).optional(),
      budgetRanges: z.array(z.object({
        label: z.string(),
        min: z.number(),
        max: z.number().nullable(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');

      const { user } = ctx;
      const now = formatDateForMySQL(new Date());

      // Check if slug is taken (if changing)
      if (input.publicSlug) {
        const existing = await db.query.artistSettings.findFirst({
          where: and(
            eq(schema.artistSettings.publicSlug, input.publicSlug.toLowerCase()),
            // Exclude current user
          ),
        });

        if (existing && existing.userId !== user.id) {
          throw new Error('This URL is already taken');
        }
      }

      // Get or create artist settings
      let settings = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.userId, user.id),
      });

      const updateData: any = {
        updatedAt: now,
      };

      if (input.publicSlug !== undefined) {
        updateData.publicSlug = input.publicSlug.toLowerCase();
      }
      if (input.funnelEnabled !== undefined) {
        updateData.funnelEnabled = input.funnelEnabled;
      }
      if (input.funnelWelcomeMessage !== undefined) {
        updateData.funnelWelcomeMessage = input.funnelWelcomeMessage;
      }
      if (input.styleOptions !== undefined) {
        updateData.styleOptions = JSON.stringify(input.styleOptions);
      }
      if (input.placementOptions !== undefined) {
        updateData.placementOptions = JSON.stringify(input.placementOptions);
      }
      if (input.budgetRanges !== undefined) {
        updateData.budgetRanges = JSON.stringify(input.budgetRanges);
      }

      if (settings) {
        await db.update(schema.artistSettings)
          .set(updateData)
          .where(eq(schema.artistSettings.userId, user.id));
      } else {
        // Insert new artistSettings with required fields
        await db.insert(schema.artistSettings).values({
          userId: user.id,
          workSchedule: JSON.stringify([]), // Required field - empty default
          services: JSON.stringify([]), // Required field - empty default
          publicSlug: updateData.publicSlug || null,
          funnelEnabled: updateData.funnelEnabled ?? 0,
          funnelWelcomeMessage: updateData.funnelWelcomeMessage || null,
          styleOptions: updateData.styleOptions || null,
          placementOptions: updateData.placementOptions || null,
          budgetRanges: updateData.budgetRanges || null,
          createdAt: now,
          updatedAt: now,
        });
      }

      return { success: true };
    }),

  /**
   * Get artist funnel settings
   * PROTECTED - requires authentication
   */
  getFunnelSettings: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return null;

      const { user } = ctx;

      const settings = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.userId, user.id),
      });

      if (!settings) {
        return {
          publicSlug: null,
          funnelEnabled: false,
          funnelWelcomeMessage: null,
          styleOptions: [],
          placementOptions: [],
          budgetRanges: [],
        };
      }

      return {
        publicSlug: settings.publicSlug,
        funnelEnabled: settings.funnelEnabled,
        funnelWelcomeMessage: settings.funnelWelcomeMessage,
        styleOptions: settings.styleOptions ? JSON.parse(settings.styleOptions) : [],
        placementOptions: settings.placementOptions ? JSON.parse(settings.placementOptions) : [],
        budgetRanges: settings.budgetRanges ? JSON.parse(settings.budgetRanges) : [],
      };
    }),
});
