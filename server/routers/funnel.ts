/**
 * Funnel Router
 * 
 * Handles public funnel endpoints and lead management.
 * Some endpoints are public (no auth required), others require authentication.
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { db } from "../../drizzle/db";
import { 
  leads, 
  funnelSubmissions, 
  artistSettings, 
  users,
  consultations,
  conversations,
  messages
} from "../../drizzle/schema";
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
      const existing = await db.query.artistSettings.findFirst({
        where: eq(artistSettings.publicSlug, input.slug.toLowerCase()),
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
      // Find artist settings by slug
      const settings = await db.query.artistSettings.findFirst({
        where: eq(artistSettings.publicSlug, input.slug.toLowerCase()),
      });

      if (!settings || !settings.funnelEnabled) {
        return null;
      }

      // Get artist user info
      const artist = await db.query.users.findFirst({
        where: eq(users.id, settings.userId),
      });

      if (!artist) {
        return null;
      }

      return {
        id: artist.id,
        displayName: artist.displayName || artist.username || 'Artist',
        profileImage: artist.profileImage,
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
      const now = new Date();
      const nowFormatted = formatDateForMySQL(now);

      // Get artist by slug
      const settings = await db.query.artistSettings.findFirst({
        where: eq(artistSettings.publicSlug, input.artistSlug.toLowerCase()),
      });

      if (!settings) {
        throw new Error('Artist not found');
      }

      const artistId = settings.userId;

      // Check for existing funnel submission by session
      let existingSubmission = await db.query.funnelSubmissions.findFirst({
        where: eq(funnelSubmissions.sessionId, input.sessionId),
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
        budgetMin: input.stepData.budget?.budgetMin,
        budgetMax: input.stepData.budget?.budgetMax,
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
        await db.update(funnelSubmissions)
          .set({
            stepData: JSON.stringify(input.stepData),
            currentStep: input.currentStep,
            status: input.isComplete ? 'completed' : 'in_progress',
            completedAt: input.isComplete ? nowFormatted : null,
            updatedAt: nowFormatted,
          })
          .where(eq(funnelSubmissions.id, existingSubmission.id));
      } else {
        // Create new submission
        const [newSubmission] = await db.insert(funnelSubmissions).values({
          artistId,
          sessionId: input.sessionId,
          stepData: JSON.stringify(input.stepData),
          currentStep: input.currentStep,
          status: input.isComplete ? 'completed' : 'in_progress',
          startedAt: nowFormatted,
          completedAt: input.isComplete ? nowFormatted : null,
          createdAt: nowFormatted,
          updatedAt: nowFormatted,
        });
        existingSubmission = { id: newSubmission.insertId } as any;
      }

      // If complete, create or update lead
      let leadId: number | null = null;

      if (input.isComplete && flatData.name && flatData.email) {
        // Check if lead already exists for this email + artist
        const existingLead = await db.query.leads.findFirst({
          where: and(
            eq(leads.artistId, artistId),
            eq(leads.email, flatData.email.toLowerCase())
          ),
        });

        if (existingLead) {
          // Update existing lead
          await db.update(leads)
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
              funnelSubmissionId: existingSubmission!.id,
              updatedAt: nowFormatted,
            })
            .where(eq(leads.id, existingLead.id));
          
          leadId = existingLead.id;
        } else {
          // Create new lead
          const [newLead] = await db.insert(leads).values({
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
            funnelSubmissionId: existingSubmission!.id,
            createdAt: nowFormatted,
            updatedAt: nowFormatted,
          });
          
          leadId = newLead.insertId;

          // Also create a consultation record for backward compatibility
          const [newConsultation] = await db.insert(consultations).values({
            artistId,
            clientId: null, // No client account yet
            leadId,
            subject: flatData.projectType 
              ? `${flatData.projectType.replace(/-/g, ' ')} - ${flatData.name}`
              : `New consultation - ${flatData.name}`,
            description: flatData.projectDescription || '',
            status: 'pending',
            createdAt: nowFormatted,
            updatedAt: nowFormatted,
          });

          // Create a conversation for the consultation
          const [newConversation] = await db.insert(conversations).values({
            artistId,
            clientId: null,
            leadId,
            consultationId: newConsultation.insertId,
            lastMessageAt: nowFormatted,
            createdAt: nowFormatted,
            updatedAt: nowFormatted,
          });

          // Update consultation with conversation ID
          await db.update(consultations)
            .set({ conversationId: newConversation.insertId })
            .where(eq(consultations.id, newConsultation.insertId));

          // Create initial system message with lead summary
          const summaryMessage = `📋 **New Consultation Request**\n\n` +
            `**Name:** ${flatData.name}\n` +
            `**Email:** ${flatData.email}\n` +
            (flatData.phone ? `**Phone:** ${flatData.phone}\n` : '') +
            `\n**Project:** ${flatData.projectType?.replace(/-/g, ' ') || 'Not specified'}\n` +
            (flatData.projectDescription ? `**Description:** ${flatData.projectDescription}\n` : '') +
            (flatData.stylePreferences?.length ? `**Styles:** ${flatData.stylePreferences.join(', ')}\n` : '') +
            (flatData.placement ? `**Placement:** ${flatData.placement.replace(/-/g, ' ')}\n` : '') +
            (flatData.estimatedSize ? `**Size:** ${flatData.estimatedSize}\n` : '') +
            (flatData.budgetLabel ? `**Budget:** ${flatData.budgetLabel}\n` : '') +
            (flatData.preferredTimeframe ? `**Timeframe:** ${flatData.preferredTimeframe.replace(/-/g, ' ')}\n` : '') +
            (flatData.urgency ? `**Urgency:** ${flatData.urgency}\n` : '') +
            `\n**Tags:** ${derivedTags.join(' | ')}`;

          await db.insert(messages).values({
            conversationId: newConversation.insertId,
            senderId: artistId, // System message attributed to artist
            senderType: 'system',
            content: summaryMessage,
            createdAt: nowFormatted,
          });
        }
      }

      return {
        success: true,
        submissionId: existingSubmission?.id,
        leadId,
        derivedTags,
        priorityScore,
        priorityTier,
      };
    }),

  /**
   * Get leads for the authenticated artist
   * PROTECTED - requires auth
   */
  getLeads: protectedProcedure
    .input(z.object({
      status: z.enum(['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost', 'archived']).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const artistId = ctx.user.id;
      const status = input?.status;
      const limit = input?.limit || 50;
      const offset = input?.offset || 0;

      const conditions = [eq(leads.artistId, artistId)];
      if (status) {
        conditions.push(eq(leads.status, status));
      }

      const leadsList = await db.query.leads.findMany({
        where: and(...conditions),
        orderBy: [desc(leads.priorityScore), desc(leads.createdAt)],
        limit,
        offset,
      });

      return leadsList.map(lead => ({
        ...lead,
        derivedTags: lead.derivedTags ? JSON.parse(lead.derivedTags) : [],
        stylePreferences: lead.stylePreferences ? JSON.parse(lead.stylePreferences) : [],
        referenceImages: lead.referenceImages ? JSON.parse(lead.referenceImages) : [],
        preferredMonths: lead.preferredMonths ? JSON.parse(lead.preferredMonths) : [],
      }));
    }),

  /**
   * Update lead status
   * PROTECTED - requires auth
   */
  updateLeadStatus: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      status: z.enum(['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost', 'archived']),
    }))
    .mutation(async ({ ctx, input }) => {
      const artistId = ctx.user.id;
      const now = formatDateForMySQL(new Date());

      // Verify ownership
      const lead = await db.query.leads.findFirst({
        where: and(
          eq(leads.id, input.leadId),
          eq(leads.artistId, artistId)
        ),
      });

      if (!lead) {
        throw new Error('Lead not found');
      }

      await db.update(leads)
        .set({
          status: input.status,
          updatedAt: now,
          ...(input.status === 'contacted' && !lead.firstContactAt ? { firstContactAt: now } : {}),
          ...(input.status === 'won' ? { convertedAt: now } : {}),
        })
        .where(eq(leads.id, input.leadId));

      return { success: true };
    }),
});

export type FunnelRouter = typeof funnelRouter;
