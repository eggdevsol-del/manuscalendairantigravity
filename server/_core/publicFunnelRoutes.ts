/**
 * Public Funnel API Routes
 * 
 * These routes are public (no authentication required) and handle
 * the consultation funnel for prospective clients.
 */

import { Express } from "express";
import { getDb } from "../db";
import * as schema from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Helper to format date for MySQL
function formatDateForMySQL(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function registerPublicFunnelRoutes(app: Express) {
  console.log("[PublicFunnel] Registering public funnel routes...");

  /**
   * GET /api/public/artist/:slug
   * Get artist profile for public funnel display
   */
  app.get("/api/public/artist/:slug", async (req, res) => {
    const startTime = Date.now();
    const { slug } = req.params;
    
    console.log(`[PublicFunnel] GET /api/public/artist/${slug} - Request started`);
    
    try {
      if (!slug) {
        console.log(`[PublicFunnel] GET /api/public/artist/${slug} - Error: Slug is required`);
        return res.status(400).json({ error: "Slug is required" });
      }

      console.log(`[PublicFunnel] GET /api/public/artist/${slug} - Connecting to database...`);
      const db = await getDb();
      if (!db) {
        console.error(`[PublicFunnel] GET /api/public/artist/${slug} - Error: Database connection failed`);
        return res.status(500).json({ error: "Database connection failed" });
      }
      console.log(`[PublicFunnel] GET /api/public/artist/${slug} - Database connected`);

      // Find artist settings by slug
      console.log(`[PublicFunnel] GET /api/public/artist/${slug} - Querying artistSettings for slug: ${slug.toLowerCase()}`);
      const settings = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.publicSlug, slug.toLowerCase()),
      });

      if (!settings) {
        console.log(`[PublicFunnel] GET /api/public/artist/${slug} - Error: No artistSettings found for slug`);
        return res.status(404).json({ error: "Artist not found" });
      }
      console.log(`[PublicFunnel] GET /api/public/artist/${slug} - Found artistSettings: id=${settings.id}, userId=${settings.userId}, funnelEnabled=${settings.funnelEnabled}`);

      if (!settings.funnelEnabled) {
        console.log(`[PublicFunnel] GET /api/public/artist/${slug} - Error: Funnel is disabled for this artist`);
        return res.status(404).json({ error: "Booking link is disabled" });
      }

      // Get artist user info
      console.log(`[PublicFunnel] GET /api/public/artist/${slug} - Querying user for userId: ${settings.userId}`);
      const artist = await db.query.users.findFirst({
        where: eq(schema.users.id, settings.userId),
      });

      if (!artist) {
        console.error(`[PublicFunnel] GET /api/public/artist/${slug} - Error: User not found for userId: ${settings.userId}`);
        return res.status(404).json({ error: "Artist not found" });
      }
      console.log(`[PublicFunnel] GET /api/public/artist/${slug} - Found user: id=${artist.id}, name=${artist.name || artist.displayName || artist.username}`);

      // Parse JSON fields with defaults
      let styleOptions: string[];
      let placementOptions: string[];
      let budgetRanges: { label: string; min: number; max: number | null }[];

      try {
        styleOptions = settings.styleOptions 
          ? JSON.parse(settings.styleOptions) 
          : ["realism", "traditional", "neo-traditional", "japanese", "blackwork", "dotwork", "watercolor", "geometric", "minimalist", "other"];
      } catch (parseError) {
        console.error(`[PublicFunnel] GET /api/public/artist/${slug} - Error parsing styleOptions:`, parseError);
        styleOptions = ["realism", "traditional", "neo-traditional", "japanese", "blackwork", "dotwork", "watercolor", "geometric", "minimalist", "other"];
      }

      try {
        placementOptions = settings.placementOptions 
          ? JSON.parse(settings.placementOptions) 
          : ["full-sleeve", "half-sleeve", "forearm", "upper-arm", "back-piece", "chest", "ribs", "thigh", "calf", "hand", "neck", "other"];
      } catch (parseError) {
        console.error(`[PublicFunnel] GET /api/public/artist/${slug} - Error parsing placementOptions:`, parseError);
        placementOptions = ["full-sleeve", "half-sleeve", "forearm", "upper-arm", "back-piece", "chest", "ribs", "thigh", "calf", "hand", "neck", "other"];
      }

      try {
        budgetRanges = settings.budgetRanges 
          ? JSON.parse(settings.budgetRanges) 
          : [
              { label: "Under $500", min: 0, max: 500 },
              { label: "$500-$1,000", min: 500, max: 1000 },
              { label: "$1,000-$2,500", min: 1000, max: 2500 },
              { label: "$2,500-$5,000", min: 2500, max: 5000 },
              { label: "$5,000-$10,000", min: 5000, max: 10000 },
              { label: "$10,000+", min: 10000, max: null },
            ];
      } catch (parseError) {
        console.error(`[PublicFunnel] GET /api/public/artist/${slug} - Error parsing budgetRanges:`, parseError);
        budgetRanges = [
          { label: "Under $500", min: 0, max: 500 },
          { label: "$500-$1,000", min: 500, max: 1000 },
          { label: "$1,000-$2,500", min: 1000, max: 2500 },
          { label: "$2,500-$5,000", min: 2500, max: 5000 },
          { label: "$5,000-$10,000", min: 5000, max: 10000 },
          { label: "$10,000+", min: 10000, max: null },
        ];
      }

      const response = {
        id: artist.id,
        slug: settings.publicSlug,
        displayName: artist.displayName || artist.username || artist.name || "Artist",
        tagline: settings.funnelWelcomeMessage || null,
        profileImageUrl: artist.profileImage || artist.avatar || null,
        coverImageUrl: null,
        styleOptions,
        placementOptions,
        budgetRanges,
        enabledSteps: ["intent", "contact", "style", "budget", "availability"],
      };

      const duration = Date.now() - startTime;
      console.log(`[PublicFunnel] GET /api/public/artist/${slug} - Success (${duration}ms)`);
      
      res.json(response);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[PublicFunnel] GET /api/public/artist/${slug} - Unhandled error (${duration}ms):`, error);
      console.error(`[PublicFunnel] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ error: "Failed to fetch artist" });
    }
  });

  /**
   * POST /api/public/funnel/submit
   * Submit funnel data and create lead
   */
  app.post("/api/public/funnel/submit", async (req, res) => {
    const startTime = Date.now();
    
    console.log(`[PublicFunnel] POST /api/public/funnel/submit - Request started`);
    console.log(`[PublicFunnel] POST /api/public/funnel/submit - Body:`, JSON.stringify(req.body, null, 2));
    
    try {
      const { artistId, sessionId, intent, contact, style, budget, availability } = req.body;

      if (!artistId || !sessionId) {
        console.log(`[PublicFunnel] POST /api/public/funnel/submit - Error: Missing required fields (artistId=${artistId}, sessionId=${sessionId})`);
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log(`[PublicFunnel] POST /api/public/funnel/submit - Connecting to database...`);
      const db = await getDb();
      if (!db) {
        console.error(`[PublicFunnel] POST /api/public/funnel/submit - Error: Database connection failed`);
        return res.status(500).json({ error: "Database connection failed" });
      }
      console.log(`[PublicFunnel] POST /api/public/funnel/submit - Database connected`);

      const now = new Date();
      const nowFormatted = formatDateForMySQL(now);

      // Create or update funnel session
      console.log(`[PublicFunnel] POST /api/public/funnel/submit - Checking for existing session: ${sessionId}`);
      const existingSession = await db.query.funnelSessions.findFirst({
        where: eq(schema.funnelSessions.id, sessionId),
      });

      const stepData = JSON.stringify({ intent, contact, style, budget, availability });

      if (existingSession) {
        console.log(`[PublicFunnel] POST /api/public/funnel/submit - Updating existing session`);
        await db.update(schema.funnelSessions)
          .set({
            stepData,
            currentStep: "success",
            completed: 1,
            completedAt: nowFormatted,
            lastActivityAt: nowFormatted,
          })
          .where(eq(schema.funnelSessions.id, sessionId));
      } else {
        console.log(`[PublicFunnel] POST /api/public/funnel/submit - Creating new session`);
        await db.insert(schema.funnelSessions).values({
          id: sessionId,
          artistId,
          stepData,
          currentStep: "success",
          completed: 1,
          startedAt: nowFormatted,
          completedAt: nowFormatted,
          createdAt: nowFormatted,
        });
      }
      console.log(`[PublicFunnel] POST /api/public/funnel/submit - Session saved`);

      // Create lead if contact info provided
      let leadId: number | null = null;

      if (contact?.name && contact?.email) {
        console.log(`[PublicFunnel] POST /api/public/funnel/submit - Creating/updating lead for: ${contact.email}`);
        
        // Check for existing lead
        const existingLead = await db.query.leads.findFirst({
          where: and(
            eq(schema.leads.artistId, artistId),
            eq(schema.leads.clientEmail, contact.email.toLowerCase())
          ),
        });

        if (existingLead) {
          console.log(`[PublicFunnel] POST /api/public/funnel/submit - Updating existing lead: ${existingLead.id}`);
          await db.update(schema.leads)
            .set({
              clientName: contact.name,
              clientPhone: contact.phone || null,
              projectType: intent?.projectType || null,
              projectDescription: intent?.projectDescription || null,
              stylePreferences: style?.stylePreferences ? JSON.stringify(style.stylePreferences) : null,
              referenceImages: style?.referenceImages ? JSON.stringify(style.referenceImages) : null,
              placement: budget?.placement || null,
              estimatedSize: budget?.estimatedSize || null,
              budgetMin: budget?.budgetMin || null,
              budgetMax: budget?.budgetMax || null,
              budgetLabel: budget?.budgetLabel || null,
              preferredTimeframe: availability?.preferredTimeframe || null,
              preferredMonths: availability?.preferredMonths ? JSON.stringify(availability.preferredMonths) : null,
              urgency: availability?.urgency || "flexible",
              funnelSessionId: sessionId,
              updatedAt: nowFormatted,
              lastActivityAt: nowFormatted,
            })
            .where(eq(schema.leads.id, existingLead.id));
          
          leadId = existingLead.id;
        } else {
          console.log(`[PublicFunnel] POST /api/public/funnel/submit - Creating new lead`);
          const [newLead] = await db.insert(schema.leads).values({
            artistId,
            source: "funnel",
            status: "new",
            clientName: contact.name,
            clientEmail: contact.email.toLowerCase(),
            clientPhone: contact.phone || null,
            projectType: intent?.projectType || null,
            projectDescription: intent?.projectDescription || null,
            stylePreferences: style?.stylePreferences ? JSON.stringify(style.stylePreferences) : null,
            referenceImages: style?.referenceImages ? JSON.stringify(style.referenceImages) : null,
            placement: budget?.placement || null,
            estimatedSize: budget?.estimatedSize || null,
            budgetMin: budget?.budgetMin || null,
            budgetMax: budget?.budgetMax || null,
            budgetLabel: budget?.budgetLabel || null,
            preferredTimeframe: availability?.preferredTimeframe || null,
            preferredMonths: availability?.preferredMonths ? JSON.stringify(availability.preferredMonths) : null,
            urgency: availability?.urgency || "flexible",
            funnelSessionId: sessionId,
            createdAt: nowFormatted,
            updatedAt: nowFormatted,
          });

          leadId = newLead.insertId;
          console.log(`[PublicFunnel] POST /api/public/funnel/submit - Created new lead: ${leadId}`);
        }

        // Update funnel session with lead ID
        if (leadId) {
          console.log(`[PublicFunnel] POST /api/public/funnel/submit - Linking session to lead: ${leadId}`);
          await db.update(schema.funnelSessions)
            .set({ leadId })
            .where(eq(schema.funnelSessions.id, sessionId));
        }
      } else {
        console.log(`[PublicFunnel] POST /api/public/funnel/submit - No contact info provided, skipping lead creation`);
      }

      const duration = Date.now() - startTime;
      console.log(`[PublicFunnel] POST /api/public/funnel/submit - Success (${duration}ms), leadId=${leadId}`);
      
      res.json({ success: true, leadId });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[PublicFunnel] POST /api/public/funnel/submit - Unhandled error (${duration}ms):`, error);
      console.error(`[PublicFunnel] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ error: "Failed to submit funnel" });
    }
  });

  console.log("[PublicFunnel] Public funnel routes registered successfully");
}
