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
  estimateLeadValue,
} from "../services/tagDerivationEngine";

// Helper to format date for MySQL
function formatDateForMySQL(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
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
   * PUBLIC - no auth required (uses HMAC-signed token)
   */
  getDepositInfo: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const { verifyDepositToken } = await import(
        "../services/depositToken"
      );
      const result = verifyDepositToken(input.token);
      if (!result.valid) {
        return null;
      }

      const db = await getDb();
      if (!db) return null;

      // Get lead with deposit info
      const lead = await db.query.leads.findFirst({
        where: eq(schema.leads.id, result.leadId),
      });

      if (!lead || !lead.depositAmount) {
        return null;
      }

      // Already paid?
      if (lead.depositVerifiedAt) {
        return null;
      }

      // Get artist info
      const artistSettingsRow = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.userId, lead.artistId),
      });

      const artist = await db.query.users.findFirst({
        where: eq(schema.users.id, lead.artistId),
      });

      // Get payment method settings
      const paymentSettings = await db
        .select()
        .from(schema.paymentMethodSettings)
        .where(eq(schema.paymentMethodSettings.artistId, lead.artistId))
        .limit(1);

      const pms = paymentSettings[0];

      return {
        proposalId: lead.id,
        artistName:
          artistSettingsRow?.businessName ||
          artistSettingsRow?.displayName ||
          artist?.name ||
          "Artist",
        artistImage: artist?.avatar || undefined,
        businessCountry: artistSettingsRow?.businessCountry || "AU",
        clientName: lead.clientName || "Client",
        clientEmail: lead.clientEmail || "",
        projectType: lead.projectType || undefined,
        selectedDate: lead.acceptedDate || "TBC",
        selectedTime: "TBC",
        depositAmount: lead.depositAmount,
        status: lead.status,
        paymentMethods: {
          stripe: pms?.stripeEnabled === 1,
          paypal: pms?.paypalEnabled === 1,
          bank: pms?.bankEnabled === 1,
          cash: pms?.cashEnabled === 1,
        },
        bankDetails:
          pms?.bankEnabled === 1 && artistSettingsRow
            ? {
              bankName: "Artist Bank", // Placeholder — could add to artistSettings
              accountName:
                artistSettingsRow.businessName ||
                artist?.name ||
                "Account Holder",
              bsb: artistSettingsRow.bsb || "",
              accountNumber: artistSettingsRow.accountNumber || "",
            }
            : undefined,
      };
    }),

  /**
   * Create a Stripe Checkout Session for deposit payment
   * PUBLIC - no auth required (uses HMAC-signed token)
   */
  createDepositCheckout: publicProcedure
    .input(z.object({
      token: z.string(),
      messageId: z.number().optional()
    }))
    .mutation(async ({ input }) => {
      const { verifyDepositToken } = await import(
        "../services/depositToken"
      );
      const result = verifyDepositToken(input.token);
      if (!result.valid) {
        throw new Error("Invalid or expired deposit link");
      }

      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const lead = await db.query.leads.findFirst({
        where: eq(schema.leads.id, result.leadId),
      });

      if (!lead || !lead.depositAmount) {
        throw new Error("Deposit information not found");
      }

      if (lead.depositVerifiedAt) {
        throw new Error("Deposit has already been paid");
      }

      // Get artist name for checkout description
      const artistSettingsRow = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.userId, lead.artistId),
      });
      const artist = await db.query.users.findFirst({
        where: eq(schema.users.id, lead.artistId),
      });

      const { createDepositCheckoutSession } = await import(
        "../services/stripe"
      );

      const url = await createDepositCheckoutSession({
        leadId: lead.id,
        depositAmount: lead.depositAmount,
        clientEmail: lead.clientEmail || "",
        artistName:
          artistSettingsRow?.businessName ||
          artistSettingsRow?.displayName ||
          artist?.name ||
          "Artist",
        depositToken: input.token,
        messageId: input.messageId,
      });

      return { url };
    }),

  /**
   * Confirm deposit payment (for non-Stripe methods: bank/cash)
   * PUBLIC - no auth required (uses HMAC-signed token)
   */
  confirmDeposit: publicProcedure
    .input(
      z.object({
        token: z.string(),
        paymentMethod: z.enum(["stripe", "paypal", "bank", "cash"]),
        proofUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { verifyDepositToken } = await import(
        "../services/depositToken"
      );
      const result = verifyDepositToken(input.token);
      if (!result.valid) {
        throw new Error("Invalid or expired deposit link");
      }

      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const now = formatDateForMySQL(new Date());

      if (input.paymentMethod === "bank") {
        // Bank transfer: mark as pending (artist verifies manually)
        await db
          .update(schema.leads)
          .set({
            depositMethod: "bank_transfer" as any,
            depositClaimedAt: now,
            depositProof: input.proofUrl || null,
            status: "deposit_pending" as any,
            updatedAt: now,
          })
          .where(eq(schema.leads.id, result.leadId));
      } else if (input.paymentMethod === "cash") {
        // Cash: mark as pending (artist confirms in person)
        await db
          .update(schema.leads)
          .set({
            depositMethod: "cash" as any,
            depositClaimedAt: now,
            status: "deposit_pending" as any,
            updatedAt: now,
          })
          .where(eq(schema.leads.id, result.leadId));
      }

      return { success: true };
    }),

  /**
   * Generate a secure deposit link for a lead
   * PROTECTED - only artists can generate deposit links
   */
  generateDepositLink: protectedProcedure
    .input(
      z.object({
        leadId: z.number(),
        depositAmount: z.number().min(100), // Minimum $1.00 in cents
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // Verify lead belongs to this artist
      const lead = await db.query.leads.findFirst({
        where: and(
          eq(schema.leads.id, input.leadId),
          eq(schema.leads.artistId, ctx.user.id)
        ),
      });

      if (!lead) {
        throw new Error("Lead not found");
      }

      // Update deposit amount on lead
      const now = formatDateForMySQL(new Date());
      await db
        .update(schema.leads)
        .set({
          depositAmount: input.depositAmount,
          depositRequestedAt: now,
          status: "deposit_requested" as any,
          updatedAt: now,
        })
        .where(eq(schema.leads.id, input.leadId));

      // Generate secure token
      const { createDepositToken } = await import(
        "../services/depositToken"
      );
      const token = createDepositToken(input.leadId);

      const baseUrl = process.env.VITE_APP_URL || "http://localhost:3000";
      const depositUrl = `${baseUrl}/deposit/${token}`;

      return { url: depositUrl, token };
    }),

  /**
   * Get deposit link for the current client
   * PROTECTED - clients can get their own deposit link
   */
  getClientDepositLink: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        messageId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // Get the conversation
      const conversation = await db.query.conversations.findFirst({
        where: eq(schema.conversations.id, input.conversationId),
      });

      if (!conversation) throw new Error("Conversation not found");

      // Verify the caller is the client of this conversation
      if (conversation.clientId !== ctx.user.id) {
        throw new Error("Not authorized");
      }

      // Get the lead from the conversation
      let lead = undefined;

      if (conversation.leadId) {
        const existingLead = await db.query.leads.findFirst({
          where: eq(schema.leads.id, conversation.leadId),
        });
        if (existingLead) {
          lead = existingLead;
        }
      }

      // If no lead exists for this conversation, create one on the fly
      if (!lead) {
        const clientUser = await db.query.users.findFirst({
          where: eq(schema.users.id, conversation.clientId!),
        });

        if (!clientUser) throw new Error("Client user not found");

        const [insertResult] = await db.insert(schema.leads).values({
          artistId: conversation.artistId,
          clientId: clientUser.id,
          clientName: clientUser.name || "Unknown Client",
          clientEmail: clientUser.email || `client-${clientUser.id}@calendair`,
          clientFirstName: clientUser.name?.split(" ")[0],
          clientLastName: clientUser.name?.split(" ").slice(1).join(" "),
          source: "direct_message",
          status: "deposit_requested",
          conversationId: conversation.id,
        });

        const newLeadId = insertResult.insertId;

        // Update the conversation to link the new lead
        await db
          .update(schema.conversations)
          .set({ leadId: newLeadId })
          .where(eq(schema.conversations.id, conversation.id));

        const getNewLead = await db.query.leads.findFirst({
          where: eq(schema.leads.id, newLeadId),
        });

        if (!getNewLead) throw new Error("Failed to create lead");
        lead = getNewLead;
      }

      // If deposit amount isn't set, get it from artist settings
      if (!lead.depositAmount) {
        const artistSettingsRow = await db.query.artistSettings.findFirst({
          where: eq(schema.artistSettings.userId, lead.artistId),
        });
        if (artistSettingsRow?.depositAmount) {
          const now = formatDateForMySQL(new Date());
          await db
            .update(schema.leads)
            .set({
              depositAmount: (artistSettingsRow.depositAmount as number) * 100,
              depositRequestedAt: now,
              updatedAt: now,
            })
            .where(eq(schema.leads.id, lead.id));
        }
      }

      // Generate token
      const { createDepositToken } = await import(
        "../services/depositToken"
      );
      const token = createDepositToken(lead.id);
      const baseUrl = process.env.VITE_APP_URL || "http://localhost:3000";

      let depositUrl = `${baseUrl}/deposit/${token}`;
      if (input.messageId) {
        depositUrl += `?messageId=${input.messageId}`;
      }

      return { url: depositUrl };
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
        displayName: settings.businessName || settings.displayName || artist.name || "Artist",
        profileImage: artist.avatar || null,
        slug: settings.publicSlug,
        funnelTheme: settings.funnelTheme || "light",
        funnelBannerUrl: settings.funnelBannerUrl || null,
        styleOptions: settings.styleOptions
          ? JSON.parse(settings.styleOptions)
          : [],
        placementOptions: settings.placementOptions
          ? JSON.parse(settings.placementOptions)
          : [],
        budgetRanges: settings.budgetRanges
          ? JSON.parse(settings.budgetRanges)
          : [],
      };
    }),

  /**
   * Submit funnel data (create or update lead)
   * PUBLIC - no auth required
   */
  submitFunnel: publicProcedure
    .input(
      z.object({
        artistSlug: z.string(),
        sessionId: z.string(),
        stepData: z.object({
          intent: z
            .object({
              projectType: z.string().optional(),
              projectDescription: z.string().optional(),
            })
            .optional(),
          contact: z
            .object({
              name: z.string(),
              email: z.string().email(),
              phone: z.string().optional(),
            })
            .optional(),
          style: z
            .object({
              stylePreferences: z.array(z.string()).optional(),
              referenceImages: z.array(z.string()).optional(),
            })
            .optional(),
          budget: z
            .object({
              placement: z.string().optional(),
              estimatedSize: z.string().optional(),
              budgetMin: z.number().optional(),
              budgetMax: z.number().nullable().optional(),
              budgetLabel: z.string().optional(),
            })
            .optional(),
          availability: z
            .object({
              preferredTimeframe: z.string().optional(),
              preferredMonths: z.array(z.string()).optional(),
              urgency: z.enum(["flexible", "moderate", "urgent"]).optional(),
            })
            .optional(),
        }),
        currentStep: z.number(),
        isComplete: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const now = new Date();
      const nowFormatted = formatDateForMySQL(now);

      // Get artist by slug
      const settings = await db.query.artistSettings.findFirst({
        where: eq(
          schema.artistSettings.publicSlug,
          input.artistSlug.toLowerCase()
        ),
      });

      if (!settings) {
        throw new Error("Artist not found");
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
      const priorityScore = calculatePriorityScore({
        ...flatData,
        createdAt: now,
      });
      const priorityTier = getPriorityTier(priorityScore);
      const estimatedValue = estimateLeadValue(flatData);

      if (existingSubmission) {
        // Update existing submission
        await db
          .update(schema.funnelSessions)
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
            eq(schema.leads.clientEmail, flatData.email.toLowerCase())
          ),
        });

        if (existingLead) {
          // Update existing lead
          await db
            .update(schema.leads)
            .set({
              clientName: flatData.name,
              clientPhone: flatData.phone || null,
              projectType: flatData.projectType || null,
              projectDescription: flatData.projectDescription || null,
              stylePreferences: flatData.stylePreferences
                ? JSON.stringify(flatData.stylePreferences)
                : null,
              referenceImages: flatData.referenceImages
                ? JSON.stringify(flatData.referenceImages)
                : null,
              placement: flatData.placement || null,
              estimatedSize: flatData.estimatedSize || null,
              budgetMin: flatData.budgetMin || null,
              budgetMax: flatData.budgetMax || null,
              preferredTimeframe: flatData.preferredTimeframe || null,
              preferredMonths: flatData.preferredMonths
                ? JSON.stringify(flatData.preferredMonths)
                : null,
              urgency: flatData.urgency || "flexible",
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
            source: "funnel",
            sourceDetails: `/start/${input.artistSlug}`,
            status: "new",
            clientName: flatData.name,
            clientEmail: flatData.email.toLowerCase(),
            clientPhone: flatData.phone || null,
            projectType: flatData.projectType || null,
            projectDescription: flatData.projectDescription || null,
            stylePreferences: flatData.stylePreferences
              ? JSON.stringify(flatData.stylePreferences)
              : null,
            referenceImages: flatData.referenceImages
              ? JSON.stringify(flatData.referenceImages)
              : null,
            placement: flatData.placement || null,
            estimatedSize: flatData.estimatedSize || null,
            budgetMin: flatData.budgetMin || null,
            budgetMax: flatData.budgetMax || null,
            preferredTimeframe: flatData.preferredTimeframe || null,
            preferredMonths: flatData.preferredMonths
              ? JSON.stringify(flatData.preferredMonths)
              : null,
            urgency: flatData.urgency || "flexible",
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
            clientId: null,
            leadId,
            subject: flatData.projectType || "New Consultation",
            description: flatData.projectDescription || "",
            status: "pending",
            createdAt: nowFormatted,
            updatedAt: nowFormatted,
          });

          // Create a conversation for the lead
          const [conversation] = await db.insert(schema.conversations).values({
            artistId,
            clientId: null,
            leadId,
            pinnedConsultationId: consultation.insertId,
            createdAt: nowFormatted,
          });

          // Create initial message with funnel summary
          const summaryMessage = `New consultation request via booking link:

**Project:** ${flatData.projectType || "Not specified"}
**Description:** ${flatData.projectDescription || "Not provided"}
**Placement:** ${flatData.placement || "Not specified"}
**Size:** ${flatData.estimatedSize || "Not specified"}
**Budget:** ${flatData.budgetLabel || "Not specified"}
**Timeframe:** ${flatData.preferredTimeframe || "Flexible"}
**Urgency:** ${flatData.urgency || "Flexible"}

**Contact:**
- Name: ${flatData.name}
- Email: ${flatData.email}
- Phone: ${flatData.phone || "Not provided"}`;

          await db.insert(schema.messages).values({
            conversationId: conversation.insertId,
            senderId: artistId, // Use artistId as a workaround if field is not null
            messageType: "system",
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
    .input(
      z.object({
        status: z
          .enum([
            "new",
            "contacted",
            "qualified",
            "proposal_sent",
            "converted",
            "lost",
            "archived",
          ])
          .optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { leads: [], total: 0 };

      const { user } = ctx;

      let query = db.query.leads.findMany({
        where: input.status
          ? and(
            eq(schema.leads.artistId, user.id),
            eq(schema.leads.status, input.status as any)
          )
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
          derivedTags: lead.derivedTags
            ? JSON.parse(lead.derivedTags as string)
            : [],
          stylePreferences: lead.stylePreferences
            ? JSON.parse(lead.stylePreferences as string)
            : [],
          referenceImages: lead.referenceImages
            ? JSON.parse(lead.referenceImages as string)
            : [],
          preferredMonths: lead.preferredMonths
            ? JSON.parse(lead.preferredMonths as string)
            : [],
          bodyPlacementImages: lead.bodyPlacementImages
            ? JSON.parse(lead.bodyPlacementImages as string)
            : [],
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
    .input(
      z.object({
        leadId: z.number(),
        status: z.enum([
          "new",
          "contacted",
          "qualified",
          "proposal_sent",
          "converted",
          "lost",
          "archived",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

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
        throw new Error("Lead not found");
      }

      // Update status
      await db
        .update(schema.leads)
        .set({
          status: input.status as any,
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
    .input(
      z.object({
        publicSlug: z.string().min(3).max(50).optional(),
        funnelEnabled: z.boolean().optional(),
        funnelTheme: z.string().max(10).optional(),
        funnelBannerUrl: z.string().nullable().optional(),
        styleOptions: z.array(z.string()).optional(),
        placementOptions: z.array(z.string()).optional(),
        budgetRanges: z
          .array(
            z.object({
              label: z.string(),
              min: z.number(),
              max: z.number().nullable(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const { user } = ctx;
      const now = formatDateForMySQL(new Date());

      // Check if slug is taken (if changing)
      if (input.publicSlug) {
        const existing = await db.query.artistSettings.findFirst({
          where: and(
            eq(schema.artistSettings.publicSlug, input.publicSlug.toLowerCase())
            // Exclude current user
          ),
        });

        if (existing && existing.userId !== user.id) {
          throw new Error("This URL is already taken");
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
      if (input.funnelTheme !== undefined) {
        updateData.funnelTheme = input.funnelTheme;
      }
      if (input.funnelBannerUrl !== undefined) {
        updateData.funnelBannerUrl = input.funnelBannerUrl;
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
        await db
          .update(schema.artistSettings)
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
          funnelTheme: updateData.funnelTheme || "light",
          funnelBannerUrl: updateData.funnelBannerUrl || null,
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
  getFunnelSettings: protectedProcedure.query(async ({ ctx }) => {
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
        funnelTheme: "light",
        funnelBannerUrl: null,
        styleOptions: [],
        placementOptions: [],
        budgetRanges: [],
      };
    }

    return {
      publicSlug: settings.publicSlug,
      funnelEnabled: settings.funnelEnabled,
      funnelTheme: settings.funnelTheme || "light",
      funnelBannerUrl: settings.funnelBannerUrl || null,
      styleOptions: settings.styleOptions
        ? JSON.parse(settings.styleOptions)
        : [],
      placementOptions: settings.placementOptions
        ? JSON.parse(settings.placementOptions)
        : [],
      budgetRanges: settings.budgetRanges
        ? JSON.parse(settings.budgetRanges)
        : [],
    };
  }),
});
