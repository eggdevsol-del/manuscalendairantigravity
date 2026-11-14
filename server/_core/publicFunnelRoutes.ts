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
import {
  calendarDateInTimeZone,
  isAdult,
  parseDateOfBirth,
  UNDERAGE_MESSAGE,
} from "../../shared/age";

const CONSENT_MESSAGE =
  "Please agree to the Terms of Service and Privacy Policy to send your request.";

// Helper to format date for MySQL
function formatDateForMySQL(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
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

    console.log(
      `[PublicFunnel] GET /api/public/artist/${slug} - Request started`
    );

    try {
      if (!slug) {
        console.log(
          `[PublicFunnel] GET /api/public/artist/${slug} - Error: Slug is required`
        );
        return res.status(400).json({ error: "Slug is required" });
      }

      console.log(
        `[PublicFunnel] GET /api/public/artist/${slug} - Connecting to database...`
      );
      const db = await getDb();
      if (!db) {
        console.error(
          `[PublicFunnel] GET /api/public/artist/${slug} - Error: Database connection failed`
        );
        return res.status(500).json({ error: "Database connection failed" });
      }
      console.log(
        `[PublicFunnel] GET /api/public/artist/${slug} - Database connected`
      );

      // Find artist settings by slug
      console.log(
        `[PublicFunnel] GET /api/public/artist/${slug} - Querying artistSettings for slug: ${slug.toLowerCase()}`
      );
      const settings = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.publicSlug, slug.toLowerCase()),
      });

      if (!settings) {
        console.log(
          `[PublicFunnel] GET /api/public/artist/${slug} - Error: No artistSettings found for slug`
        );
        return res.status(404).json({ error: "Artist not found" });
      }
      console.log(
        `[PublicFunnel] GET /api/public/artist/${slug} - Found artistSettings: id=${settings.id}, userId=${settings.userId}, funnelEnabled=${settings.funnelEnabled}`
      );

      if (!settings.funnelEnabled) {
        console.log(
          `[PublicFunnel] GET /api/public/artist/${slug} - Error: Funnel is disabled for this artist`
        );
        return res.status(404).json({ error: "Booking link is disabled" });
      }

      // Get artist user info
      console.log(
        `[PublicFunnel] GET /api/public/artist/${slug} - Querying user for userId: ${settings.userId}`
      );
      const artist = await db.query.users.findFirst({
        where: eq(schema.users.id, settings.userId),
      });

      if (!artist) {
        console.error(
          `[PublicFunnel] GET /api/public/artist/${slug} - Error: User not found for userId: ${settings.userId}`
        );
        return res.status(404).json({ error: "Artist not found" });
      }
      console.log(
        `[PublicFunnel] GET /api/public/artist/${slug} - Found user: id=${artist.id}, name=${artist.name || "Artist"}`
      );

      // Parse JSON fields with defaults
      let styleOptions: string[];
      let placementOptions: string[];
      let budgetRanges: { label: string; min: number; max: number | null }[];

      try {
        styleOptions = settings.styleOptions
          ? JSON.parse(settings.styleOptions)
          : [
              "realism",
              "traditional",
              "neo-traditional",
              "japanese",
              "blackwork",
              "dotwork",
              "watercolor",
              "geometric",
              "minimalist",
              "other",
            ];
      } catch (parseError) {
        console.error(
          `[PublicFunnel] GET /api/public/artist/${slug} - Error parsing styleOptions:`,
          parseError
        );
        styleOptions = [
          "realism",
          "traditional",
          "neo-traditional",
          "japanese",
          "blackwork",
          "dotwork",
          "watercolor",
          "geometric",
          "minimalist",
          "other",
        ];
      }

      try {
        placementOptions = settings.placementOptions
          ? JSON.parse(settings.placementOptions)
          : [
              "full-sleeve",
              "half-sleeve",
              "forearm",
              "upper-arm",
              "back-piece",
              "chest",
              "ribs",
              "thigh",
              "calf",
              "hand",
              "neck",
              "other",
            ];
      } catch (parseError) {
        console.error(
          `[PublicFunnel] GET /api/public/artist/${slug} - Error parsing placementOptions:`,
          parseError
        );
        placementOptions = [
          "full-sleeve",
          "half-sleeve",
          "forearm",
          "upper-arm",
          "back-piece",
          "chest",
          "ribs",
          "thigh",
          "calf",
          "hand",
          "neck",
          "other",
        ];
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
        console.error(
          `[PublicFunnel] GET /api/public/artist/${slug} - Error parsing budgetRanges:`,
          parseError
        );
        budgetRanges = [
          { label: "Under $500", min: 0, max: 500 },
          { label: "$500-$1,000", min: 500, max: 1000 },
          { label: "$1,000-$2,500", min: 1000, max: 2500 },
          { label: "$2,500-$5,000", min: 2500, max: 5000 },
          { label: "$5,000-$10,000", min: 5000, max: 10000 },
          { label: "$10,000+", min: 10000, max: null },
        ];
      }

      let services: any[] = [];
      try {
        if (settings.services) {
          services = JSON.parse(settings.services);
        }

        // Ensure there's always something to show, using PROJECT_TYPES as fallback
        if (!services || services.length === 0) {
          services = [
            {
              id: "full-sleeve",
              name: "Full Sleeve",
              price: 0,
              duration: 0,
              sittings: 1,
            },
            {
              id: "half-sleeve",
              name: "Half Sleeve",
              price: 0,
              duration: 0,
              sittings: 1,
            },
            {
              id: "back-piece",
              name: "Back Piece",
              price: 0,
              duration: 0,
              sittings: 1,
            },
            {
              id: "chest-piece",
              name: "Chest Piece",
              price: 0,
              duration: 0,
              sittings: 1,
            },
            {
              id: "cover-up",
              name: "Cover Up",
              price: 0,
              duration: 0,
              sittings: 1,
            },
            {
              id: "small-piece",
              name: "Small Piece",
              price: 0,
              duration: 0,
              sittings: 1,
            },
            {
              id: "touch-up",
              name: "Touch Up",
              price: 0,
              duration: 0,
              sittings: 1,
            },
            {
              id: "custom",
              name: "Custom Project",
              price: 0,
              duration: 0,
              sittings: 1,
            },
          ];
        }
      } catch (parseError) {
        console.error(
          `[PublicFunnel] GET /api/public/artist/${slug} - Error parsing services:`,
          parseError
        );
        services = [
          {
            id: "full-sleeve",
            name: "Full Sleeve",
            price: 0,
            duration: 0,
            sittings: 1,
          },
          {
            id: "half-sleeve",
            name: "Half Sleeve",
            price: 0,
            duration: 0,
            sittings: 1,
          },
          {
            id: "back-piece",
            name: "Back Piece",
            price: 0,
            duration: 0,
            sittings: 1,
          },
          {
            id: "chest-piece",
            name: "Chest Piece",
            price: 0,
            duration: 0,
            sittings: 1,
          },
          {
            id: "cover-up",
            name: "Cover Up",
            price: 0,
            duration: 0,
            sittings: 1,
          },
          {
            id: "small-piece",
            name: "Small Piece",
            price: 0,
            duration: 0,
            sittings: 1,
          },
          {
            id: "touch-up",
            name: "Touch Up",
            price: 0,
            duration: 0,
            sittings: 1,
          },
          {
            id: "custom",
            name: "Custom Project",
            price: 0,
            duration: 0,
            sittings: 1,
          },
        ];
      }

      const response = {
        id: artist.id,
        slug: settings.publicSlug,
        displayName:
          settings.displayName ||
          (artist as any).displayName ||
          (artist as any).username ||
          artist.name ||
          "Artist",
        tagline: settings.funnelWelcomeMessage || null,
        theme: settings.funnelTheme || "light",
        bannerUrl: settings.funnelBannerUrl || null,
        profileImageUrl:
          (artist as any).profileImage || (artist as any).avatar || null,
        coverImageUrl: null,
        styleOptions,
        placementOptions,
        budgetRanges,
        services,
        enabledSteps: [
          "intent",
          "contact",
          "style",
          "bodyPlacement",
          "budget",
          "availability",
        ],
      };

      const duration = Date.now() - startTime;
      console.log(
        `[PublicFunnel] GET /api/public/artist/${slug} - Success (${duration}ms)`
      );

      res.json(response);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `[PublicFunnel] GET /api/public/artist/${slug} - Unhandled error (${duration}ms):`,
        error
      );
      console.error(
        `[PublicFunnel] Error stack:`,
        error instanceof Error ? error.stack : "No stack trace"
      );
      res.status(500).json({ error: "Failed to fetch artist" });
    }
  });

  /**
   * POST /api/public/funnel/submit
   * Submit funnel data and create lead
   *
   * Unauthenticated: the caller has not proved they own the email they typed.
   * So this never reads, creates, changes or links a users row (the lead keeps
   * the typed details and stays unlinked until the person signs in), never
   * edits a lead from an earlier submission, and never logs or returns
   * personal details.
   */
  app.post("/api/public/funnel/submit", async (req, res) => {
    let loggedArtistId = "unknown";
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const {
        sessionId,
        intent,
        contact,
        style,
        bodyPlacement,
        budget,
        availability,
      } = body;
      const artistId: unknown = body.artistId;

      if (
        typeof artistId !== "string" ||
        !artistId ||
        artistId.length > 64 ||
        typeof sessionId !== "string" ||
        !sessionId ||
        sessionId.length > 64
      ) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      if (body.acceptedTerms !== true) {
        return res.status(400).json({ error: CONSENT_MESSAGE });
      }
      const born = parseDateOfBirth(contact?.birthdate);
      if (!born) {
        return res.status(400).json({ error: UNDERAGE_MESSAGE });
      }
      const text = (value: unknown, max: number) =>
        typeof value === "string" && value.trim()
          ? value.trim().slice(0, max)
          : null;
      const email = text(contact?.email, 320)?.toLowerCase() ?? null;
      const firstName = text(contact?.firstName, 100);
      const lastName = text(contact?.lastName, 100);
      const clientName =
        firstName && lastName
          ? `${firstName} ${lastName}`
          : (text(contact?.name, 255) ?? "");
      const phone = text(contact?.phone, 20);
      const birthdate = `${born.year}-${String(born.month).padStart(2, "0")}-${String(born.day).padStart(2, "0")}`;

      const db = await getDb();
      if (!db) {
        console.error(
          `[PublicFunnel] POST /api/public/funnel/submit - Database connection failed`
        );
        return res.status(500).json({ error: "Database connection failed" });
      }

      // Requests can only be sent to a real artist, checked before any write.
      const artist = await db.query.users.findFirst({
        where: eq(schema.users.id, artistId),
      });
      if (!artist || !["artist", "admin"].includes(artist.role)) {
        return res.status(400).json({
          error: "This artist is not available for booking requests.",
        });
      }
      loggedArtistId = artist.id;
      const settings = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.userId, artist.id),
      });
      if (!isAdult(birthdate, calendarDateInTimeZone(settings?.timeZone))) {
        return res.status(400).json({ error: UNDERAGE_MESSAGE });
      }

      const now = new Date();
      const nowFormatted = formatDateForMySQL(now);

      // Create or update funnel session
      const existingSession = await db.query.funnelSessions.findFirst({
        where: eq(schema.funnelSessions.id, sessionId),
      });

      const stepData = JSON.stringify({
        intent,
        contact,
        style,
        bodyPlacement,
        budget,
        availability,
      });

      if (existingSession) {
        // A session id belongs to the artist it was started for.
        if (existingSession.artistId !== artistId) {
          return res.status(400).json({ error: "Missing required fields" });
        }
        await db
          .update(schema.funnelSessions)
          .set({
            stepData,
            currentStep: "success",
            completed: 1,
            completedAt: nowFormatted,
            lastActivityAt: nowFormatted,
          })
          .where(eq(schema.funnelSessions.id, sessionId));
      } else {
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

      // Create lead if contact info provided
      let leadId: number | null = null;

      if (clientName && email) {
        // Combine reference images and body placement images
        const allReferenceImages = [...(style?.referenceImages || [])];
        const bodyPlacementImagesArray = bodyPlacement?.placementImages || [];

        // Only a resend of this same session may update a lead. Matching on
        // the typed email alone would let a stranger replace someone's request.
        const existingLead = await db.query.leads.findFirst({
          where: and(
            eq(schema.leads.artistId, artistId),
            eq(schema.leads.clientEmail, email),
            eq(schema.leads.funnelSessionId, sessionId)
          ),
        });

        // Build lead data with expanded contact fields
        const leadData = {
          clientName,
          clientEmail: email,
          clientPhone: phone,
          clientFirstName: firstName,
          clientLastName: lastName,
          clientBirthdate: birthdate,
          projectType: intent?.projectType || null,
          projectDescription: intent?.projectDescription || null,
          stylePreferences: style?.stylePreferences
            ? JSON.stringify(style.stylePreferences)
            : null,
          referenceImages:
            allReferenceImages.length > 0
              ? JSON.stringify(allReferenceImages)
              : null,
          bodyPlacementImages:
            bodyPlacementImagesArray.length > 0
              ? JSON.stringify(bodyPlacementImagesArray)
              : null,
          placement: budget?.placement || null,
          estimatedSize: budget?.estimatedSize || null,
          budgetMin: budget?.budgetMin || null,
          budgetMax: budget?.budgetMax || null,
          budgetLabel: budget?.budgetLabel || null,
          preferredTimeframe: availability?.preferredTimeframe || null,
          preferredMonths: availability?.preferredMonths
            ? JSON.stringify(availability.preferredMonths)
            : null,
          urgency: availability?.urgency || "flexible",
          funnelSessionId: sessionId,
          updatedAt: nowFormatted,
          lastActivityAt: nowFormatted,
        };

        if (existingLead) {
          await db
            .update(schema.leads)
            .set(leadData)
            .where(eq(schema.leads.id, existingLead.id));

          leadId = existingLead.id;
        } else {
          const [newLead] = await db.insert(schema.leads).values({
            artistId,
            source: "funnel",
            status: "new",
            ...leadData,
            createdAt: nowFormatted,
          });

          leadId = newLead.insertId;
        }

        // Update funnel session with lead ID
        if (leadId) {
          await db
            .update(schema.funnelSessions)
            .set({ leadId })
            .where(eq(schema.funnelSessions.id, sessionId));
        }
      }

      console.log(
        `[PublicFunnel] POST /api/public/funnel/submit - Saved artistId=${loggedArtistId} leadId=${leadId}`
      );

      // Same shape whether or not the email already had an account.
      res.json({ success: true, leadId });
    } catch (error) {
      // Database errors can carry the submitted values, so only the error
      // class and code are logged.
      console.error(
        `[PublicFunnel] POST /api/public/funnel/submit - Failed artistId=${loggedArtistId} error=${error instanceof Error ? error.name : "unknown"} code=${String((error as { code?: unknown } | null)?.code ?? "none")}`
      );
      res.status(500).json({ error: "Failed to submit funnel" });
    }
  });

  console.log("[PublicFunnel] Public funnel routes registered successfully");
}
