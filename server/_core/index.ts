import "dotenv/config";
import fs from "fs";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import path from "path";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { verifyAndFixDatabase } from "../verify-and-fix-db";
// storage.ts no longer used — /api/files/* now redirects to R2
import { startOutboxWorker } from "../workers/outboxProcessor";
import { registerPublicFunnelRoutes } from "./publicFunnelRoutes";
import { handleStripeWebhook } from "../services/stripe";
import "../services/notificationOrchestrator";

// ── Rate Limiters ──────────────────────────────────────────────
// General API limiter: 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000, // Increased to allow chat polling (which polls every 3 seconds)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  validate: { trustProxy: false },
});

// Strict limiter for public funnel submit: 10 per 15 minutes per IP
const funnelSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions, please try again later." },
  validate: { trustProxy: false },
});

// Upload limiter: 20 per minute per IP
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many uploads, please try again later." },
  validate: { trustProxy: false },
});

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Initialize database tables if they don't exist
  try {
    // Skip automatic migrations in production to prevent Railway health check timeouts
    if (process.env.NODE_ENV !== "production") {
      await verifyAndFixDatabase();
    }
  } catch (error) {
    console.error("[Server] Database initialization failed:", error);
    // Continue anyway - the app might work in read-only mode or with existing tables
  }

  // Start background workers
  try {
    startOutboxWorker();
  } catch (e) {
    console.error("[Server] Failed to start outbox worker:", e);
  }

  const app = express();
  app.set("trust proxy", true); // Railway runs behind a reverse proxy
  const server = createServer(app);

  // Read package.json version once at startup — used for X-App-Version header
  // and the /api/version endpoint below.
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8")
  );

  const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps often have no origin header)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "http://localhost",
        "https://localhost",
        "capacitor://localhost",
        "http://artist-booking-app-production.up.railway.app",
        "https://artist-booking-app-production.up.railway.app",
        "https://tattoi.app",
        "https://www.tattoi.app",
        "https://artist.tattoi.app",
        "https://merchant.tattoi.app",
        "https://app.tattoi.app",
        "https://vidabiz.butterfly-effect.dev"
      ];

      // Allow exact matches or any localhost port
      if (
        allowedOrigins.includes(origin) ||
        origin.startsWith("http://localhost:")
      ) {
        callback(null, true);
      } else {
        // Log unauthorized origins for debugging in server logs
        callback(null, false);
      }
    },
    credentials: true,
  };

  // 1. Move CORS to the very top to handle preflight requests first
  app.use(cors(corsOptions));

  // Handle preflight for all routes with the exact same options
  app.options("*", cors(corsOptions));

  // Content Security Policy headers
  app.use((_req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.onesignal.com https://accounts.google.com https://apis.google.com https://js.stripe.com https://connect.stripe.com https://b.stripecdn.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com https://b.stripecdn.com",
        "font-src 'self' https://fonts.gstatic.com https://b.stripecdn.com",
        "img-src 'self' data: blob: https: http:",
        "connect-src 'self' https: wss: https://api.stripe.com https://connect.stripe.com https://b.stripecdn.com",
        "frame-src 'self' https://js.stripe.com https://connect.stripe.com https://connect-js.stripe.com https://b.stripecdn.com https://accounts.google.com",
        "worker-src 'self' blob:",
      ].join("; ")
    );
    // Cross-Origin-Opener-Policy: allow Stripe auth popups (defensive — Custom
    // accounts with disable_stripe_user_authentication should not trigger popups,
    // but this protects against edge cases and future SDK updates)
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
    // Allow third-party iframes (Stripe Connect) to access storage in PWA standalone mode
    res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
    next();
  });

  // Inject current server version on every response.
  // Clients read this header on every tRPC call to detect deployments instantly,
  // without waiting for the 30-second version-poll interval.
  const SERVER_VERSION = packageJson.version;
  app.use((_req, res, next) => {
    res.setHeader("X-App-Version", SERVER_VERSION);
    next();
  });

  // MUST BE BEFORE express.json() to capture raw payload for signature verification
  app.post(
    ["/api/webhooks/stripe", "/api/stripe/webhook"],
    express.raw({ type: "application/json" }),
    handleStripeWebhook
  );

  // 2. Configure body parsers (25mb to support iPhone camera photos as base64)
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Ensure upload directory exists
  const uploadDir = path.join(process.cwd(), "server", "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Serve static uploads
  app.use("/uploads", express.static(uploadDir));

  // Public funnel API routes (no auth required)
  // Apply strict rate limit to funnel submit endpoint
  app.use("/api/public/funnel/submit", funnelSubmitLimiter);
  registerPublicFunnelRoutes(app);

  // Version endpoint for cache-busting (returns current server version)
  // This is used by the client to detect version mismatches and force updates.
  // Note: X-App-Version header is also injected on every response by the middleware above.
  app.get("/api/version", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.json({
      version: packageJson.version,
      timestamp: Date.now(),
    });
  });

  // Google OAuth Client ID endpoint (served from backend so it's not baked into the frontend bundle)
  app.get("/api/google-client-id", (_req, res) => {
    res.json({ clientId: process.env.GOOGLE_CLIENT_ID || "" });
  });

  // File serving endpoint — redirects to R2 CDN (migrated from MySQL base64)
  app.get("/api/files/*", (req, res) => {
    const key = (req.params as any)[0];
    const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "") || "";
    if (!r2PublicUrl) {
      return res.status(500).json({ error: "R2_PUBLIC_URL not configured" });
    }
    res.redirect(301, `${r2PublicUrl}/${key}`);
  });

  // ── Instagram video proxy ──────────────────────────────────────
  // Streams Instagram videos through our server to avoid CORS issues.
  // The client uses /api/ig-video/{portfolioId} as the <video src>.
  app.get("/api/ig-video/:id", async (req, res) => {
    try {
      const { getDb } = await import("../db");
      const schema = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) return res.status(500).json({ error: "DB unavailable" });

      const portfolioId = parseInt(req.params.id, 10);
      if (isNaN(portfolioId)) return res.status(400).json({ error: "Invalid ID" });

      const item = await db.query.portfolios.findFirst({
        where: eq(schema.portfolios.id, portfolioId),
        columns: { cdnUrl: true, mediaType: true, externalMediaId: true },
      });

      if (!item || item.mediaType !== "video" || !item.cdnUrl) {
        return res.status(404).json({ error: "Video not found" });
      }

      // Fetch video from the stored URL (embed-safe proxy or CDN)
      const videoResponse = await fetch(item.cdnUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; TattoiApp/1.0)",
        },
      });

      if (!videoResponse.ok) {
        console.error(`[Video Proxy] Failed to fetch video: ${videoResponse.status} from ${item.cdnUrl.slice(0, 80)}`);
        return res.status(502).json({ error: "Failed to fetch video from source" });
      }

      // Stream video to client with proper headers
      const contentType = videoResponse.headers.get("content-type") || "video/mp4";
      const contentLength = videoResponse.headers.get("content-length");

      res.setHeader("Content-Type", contentType);
      if (contentLength) res.setHeader("Content-Length", contentLength);
      res.setHeader("Cache-Control", "public, max-age=3600"); // Cache 1 hour
      res.setHeader("Accept-Ranges", "bytes");

      // Pipe the response body to the client
      const reader = videoResponse.body?.getReader();
      if (!reader) return res.status(502).json({ error: "No response body" });

      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          if (!res.write(value)) {
            await new Promise(resolve => res.once("drain", resolve));
          }
        }
      };
      pump().catch(() => res.end());

    } catch (err) {
      console.error("[Video Proxy] Error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Internal error" });
    }
  });

  // ── Admin: Seed real artists (temporary) ───────────────────────
  // POST /api/admin/seed-artists?key=RAPIDAPI_KEY
  // Triggers the real artist seeder on the server.
  // Protected by requiring the RAPIDAPI_KEY as a query param.
  app.post("/api/admin/seed-artists", async (req, res) => {
    const key = req.query.key as string;
    if (!key || key !== process.env.RAPIDAPI_KEY) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Don't block the request — run in background
    res.json({ status: "started", message: "Seeding real artists in background. Check server logs for progress." });

    // Dynamic import to avoid loading at startup
    try {
      const { nanoid } = await import("nanoid");
      const { getDb } = await import("../db");
      const dbSchema = await import("../../drizzle/schema");
      const { eq, inArray } = await import("drizzle-orm");
      const { processInstagramImport } = await import("../services/instagramImportWorker");

      const db = await getDb();
      if (!db) { console.error("[Seed] No DB"); return; }

      const REAL_ARTISTS = [
        { name: "Jake Jones", businessName: "Jake Jones Tattoo", instagram: "jakejonestattoo", keywords: "realism, portrait, black and grey", bio: "Black & grey realism specialist.", suburb: "Lutwyche", address: "550 Lutwyche Rd, Lutwyche QLD 4030", lat: "-27.4234", lng: "153.0306" },
        { name: "Cherie Buttons", businessName: "Cherie Buttons Tattoo", instagram: "cheriebuttons", keywords: "illustrative, neo-traditional, colour", bio: "Illustrative and neo-traditional tattoos.", suburb: "Fortitude Valley", address: "52 Brunswick St, Fortitude Valley QLD 4006", lat: "-27.4578", lng: "153.0389" },
        { name: "Jenny Ink", businessName: "Jenny Ink Studio", instagram: "jennyink_tattoo", keywords: "fine line, botanical, feminine, script", bio: "Delicate fine line work.", suburb: "Taringa", address: "19 Swann Rd, Taringa QLD 4068", lat: "-27.4977", lng: "152.9787" },
        { name: "Jeje", businessName: "Jeje Ink", instagram: "jeje_ink", keywords: "japanese, irezumi, dragon, koi", bio: "Japanese traditional specialist.", suburb: "Morningside", address: "612 Wynnum Rd, Morningside QLD 4170", lat: "-27.4621", lng: "153.0742" },
        { name: "Graceful Tattoos", businessName: "Graceful Tattoos", instagram: "graceful_tatt", keywords: "fine line, illustrative, floral", bio: "Fine line and illustrative tattooing.", suburb: "New Farm", address: "14 Merthyr Rd, New Farm QLD 4005", lat: "-27.4683", lng: "153.0442" },
        { name: "Hailey Blossom", businessName: "Hailey Blossom Tattoo", instagram: "hailey_blossom", keywords: "fine line, pet portraits, floral", bio: "Fine line and detailed tattoos.", suburb: "Spring Hill", address: "20 Leichhardt St, Spring Hill QLD 4000", lat: "-27.4600", lng: "153.0206" },
        { name: "Cappy Ink", businessName: "Cappy Ink", instagram: "cappy_ink", keywords: "illustrative, unique, colour, custom", bio: "Unique custom designs.", suburb: "Mt Gravatt", address: "1714 Logan Rd, Mt Gravatt QLD 4122", lat: "-27.5399", lng: "153.0796" },
        { name: "Steve", businessName: "Fable Tattoo", instagram: "tattoos.by.steve", keywords: "colour, pop culture, anime, gaming", bio: "Colour specialist at Fable Tattoo.", suburb: "West End", address: "88 Vulture St, West End QLD 4101", lat: "-27.4795", lng: "153.0118" },
        { name: "Westside Tattoo", businessName: "Westside Tattoo Brisbane", instagram: "westside_tattoo_brisbane", keywords: "japanese, traditional, portraiture", bio: "Long-standing Brisbane studio.", suburb: "West End", address: "195 Boundary St, West End QLD 4101", lat: "-27.4782", lng: "153.0098" },
        { name: "Valley Ink", businessName: "Valley Ink", instagram: "valleyink", keywords: "custom, thin line, dot work", bio: "Custom tattoo studio in the Valley.", suburb: "Fortitude Valley", address: "315 Brunswick St, Fortitude Valley QLD 4006", lat: "-27.4542", lng: "153.0380" },
        { name: "Tailor Made Tattoo", businessName: "Tailor Made Tattoo", instagram: "tailormadetattoo", keywords: "custom, realism, colour, walk-in", bio: "Custom tattoo studio in Woolloongabba.", suburb: "Woolloongabba", address: "71 Logan Rd, Woolloongabba QLD 4102", lat: "-27.4895", lng: "153.0329" },
        { name: "CB Ink", businessName: "CB Ink Tattoo", instagram: "cbinktattoo", keywords: "realism, portrait, diverse styles", bio: "Large Brisbane studio with 25+ artists.", suburb: "Lutwyche", address: "543 Lutwyche Rd, Lutwyche QLD 4030", lat: "-27.4230", lng: "153.0310" },
        { name: "Chalice Tattoo", businessName: "Chalice Tattoo Company", instagram: "chalicetattooco", keywords: "blackwork, dark art, occult, gothic", bio: "Blackwork and gothic tattooing.", suburb: "Paddington", address: "210 Given Tce, Paddington QLD 4064", lat: "-27.4597", lng: "152.9989" },
        { name: "Save Point Tattoo", businessName: "Save Point Tattoo", instagram: "savepointtattoo", keywords: "anime, gaming, neo-japanese, colour", bio: "Anime and gaming tattoo specialists.", suburb: "Greenslopes", address: "162 Logan Rd, Greenslopes QLD 4120", lat: "-27.5035", lng: "153.0466" },
        { name: "Ink Embassy", businessName: "Ink Embassy", instagram: "inkembassy", keywords: "colour, custom, vibrant, realism", bio: "Vibrant colour work in Bulimba.", suburb: "Bulimba", address: "43 Oxford St, Bulimba QLD 4171", lat: "-27.4617", lng: "153.0622" },
      ];

      const MESSAGES = [
        "Hey! Thanks for checking out my work. What are you thinking for your next piece?",
        "Welcome! I'm excited to potentially work with you. What style are you after?",
        "Hi there! Stoked you found me. Drop me your ideas!",
        "Thanks for connecting! What were you thinking?",
        "Hey! Tell me about your vision!",
      ];

      // Find client
      const [client] = await db.select({ id: dbSchema.users.id }).from(dbSchema.users).where(eq(dbSchema.users.role, "client")).limit(1);
      if (!client) { console.error("[Seed] No client"); return; }

      // Delete existing mock artists (keep pmasontattoo)
      const allArtists = await db.select({ id: dbSchema.users.id, email: dbSchema.users.email }).from(dbSchema.users).where(eq(dbSchema.users.role, "artist"));
      const deleteIds = allArtists.filter(a => a.email !== "bookings@pmasontattoo.com").map(a => a.id);
      if (deleteIds.length > 0) {
        for (const id of deleteIds) {
          await db.delete(dbSchema.portfolios).where(eq(dbSchema.portfolios.artistId, id));
        }
        await db.delete(dbSchema.users).where(inArray(dbSchema.users.id, deleteIds));
        console.log(`[Seed] Deleted ${deleteIds.length} mock artists`);
      }

      // Create each artist and import
      for (let i = 0; i < REAL_ARTISTS.length; i++) {
        const a = REAL_ARTISTS[i];
        const artistId = nanoid();
        const slug = a.instagram.replace(/[^a-z0-9]/gi, "").toLowerCase();

        try {
          await db.insert(dbSchema.users).values({ id: artistId, name: a.name, email: `${a.instagram}@demo.tattoi.app`, role: "artist", bio: a.bio, city: a.suburb, hasCompletedOnboarding: 1 });
          await db.insert(dbSchema.artistSettings).values({ userId: artistId, businessName: a.businessName, displayName: a.name, businessAddress: a.address, businessCountry: "AU", keywords: a.keywords, publicSlug: slug, funnelEnabled: 1, workSchedule: JSON.stringify({}), services: JSON.stringify([]), lat: a.lat, lng: a.lng });

          // Conversation
          const [conv] = await db.insert(dbSchema.conversations).values({ artistId, clientId: client.id }).$returningId();
          await db.insert(dbSchema.messages).values({ conversationId: conv.id, senderId: artistId, content: MESSAGES[i % MESSAGES.length], messageType: "text" });

          // Import first 20 posts
          const [imp] = await db.insert(dbSchema.instagramImports).values({ artistId, instagramUsername: a.instagram, status: "in_progress" });
          console.log(`[Seed] ${i+1}/${REAL_ARTISTS.length} Importing @${a.instagram}...`);
          await processInstagramImport(db, imp.insertId, artistId, a.instagram, 20);
          console.log(`[Seed] ✅ ${a.name} done`);
        } catch (err: any) {
          console.error(`[Seed] ❌ ${a.name} failed: ${err.message}`);
        }

        // Rate limit delay
        if (i < REAL_ARTISTS.length - 1) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      console.log("[Seed] 🎉 All artists seeded!");
    } catch (err) {
      console.error("[Seed] Fatal error:", err);
    }
  });
  // ── Map image proxy ───────────────────────────────────────────
  // Direct Express route that streams Google Maps Static images as PNG.
  // Avoids base64/tRPC overhead and keeps the API key server-side.
  app.get("/api/map-image", async (req, res) => {
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error("[Map Image] GOOGLE_MAPS_API_KEY not set");
        return res.status(503).end();
      }

      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const width = parseInt(req.query.w as string) || 600;
      const height = parseInt(req.query.h as string) || 200;
      const zoom = parseInt(req.query.z as string) || 11;

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "lat and lng are required" });
      }

      // Satellite / day-mode — no custom styles needed (ignored on satellite)
      const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&scale=2&maptype=satellite&key=${apiKey}`;

      console.log("[Map Image] Fetching map for", lat, lng);
      const googleRes = await fetch(url);

      if (!googleRes.ok) {
        console.error("[Map Image] Google returned", googleRes.status, await googleRes.text());
        return res.status(502).end();
      }

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=604800"); // 7-day cache

      const arrayBuffer = await googleRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err) {
      console.error("[Map Image] Error:", err);
      res.status(500).end();
    }
  });

  // tRPC API — rate limited and upload-specific limiter
  app.use("/api/trpc/upload", uploadLimiter);
  app.use("/api/trpc", apiLimiter);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: ({ path, error }) => {
        console.error(`[tRPC Error] Path: ${path}`);
        console.error(`[tRPC Error] Code: ${error.code}`);
        console.error(`[tRPC Error] Message: ${error.message}`);
      },
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // In production (Railway), use the PORT environment variable directly
  // In development, find an available port
  const preferredPort = parseInt(process.env.PORT || "3000");
  let port = preferredPort;

  if (process.env.NODE_ENV === "development") {
    port = await findAvailablePort(preferredPort);
  }

  server.listen(port, "0.0.0.0", () => {
    console.info(`Server running on http://0.0.0.0:${port}/`);

    // Start scheduled tasks (balance reminders, etc.)
    import("../services/scheduler").then(({ startScheduledTasks }) => {
      startScheduledTasks();
    }).catch((err) => {
      console.error("[Scheduler] Failed to start scheduled tasks:", err);
    });

    // One-time: Seed portfolio images for mock artists (idempotent)
    import("../startup/seedPortfolios").then(({ seedPortfolioImages }) => {
      seedPortfolioImages().catch((err) => {
        console.error("[Seed] Portfolio seeding failed:", err);
      });
    }).catch(() => {
      // Module not found or import error — silently skip
    });
  });
}

startServer().catch(console.error);
// Trigger restart for DB migration v1.0.304
