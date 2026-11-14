import { registerOfferUnsubscribe } from "../services/offerDelivery";
import { appUpdatePage } from "../services/appUpdatePage";
import { databaseReady } from "../services/readiness";
import "dotenv/config";
import fs from "fs";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import {
  authLimiter,
  trpcProcedureLimiter,
  trpcTooManyRequests,
  trustProxySetting,
  uploadLimiter,
} from "./rateLimiters";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import path from "path";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getAuthSecret } from "./auth-secret";
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
  handler: trpcTooManyRequests("Too many requests, please try again later."),
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
  getAuthSecret();
  // Database migrations are explicit deployment steps, never startup side effects.

  // Start background workers
  try {
    startOutboxWorker();
  } catch (e) {
    console.error("[Server] Failed to start outbox worker:", e);
  }

  const app = express();
  // Trust only the proxy hops in front of this process, so req.ip (the rate
  // limit key) cannot be chosen by the caller through X-Forwarded-For.
  app.set("trust proxy", trustProxySetting());
  const server = createServer(app);

  // Read package.json version once at startup — used for X-App-Version header
  // and the /api/version endpoint below.
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8")
  );

  const corsOptions = {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Allow requests with no origin (mobile apps often have no origin header)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        ...(process.env.APP_URL ? [new URL(process.env.APP_URL).origin] : []),
        "http://localhost",
        "https://localhost",
        "capacitor://localhost",
        "https://artist-booking-app-production.up.railway.app",
        "https://tattoi.app",
        "https://www.tattoi.app",
        "https://artist.tattoi.app",
        "https://merchant.tattoi.app",
        "https://app.tattoi.app",
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
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.onesignal.com https://accounts.google.com https://apis.google.com https://js.stripe.com https://connect.stripe.com https://connect-js.stripe.com https://b.stripecdn.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com https://b.stripecdn.com",
        "font-src 'self' https://fonts.gstatic.com https://b.stripecdn.com",
        "img-src 'self' data: blob: https: http:",
        "media-src 'self' blob: data: https: http:",
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
  registerOfferUnsubscribe(app);

  // Version endpoint for cache-busting (returns current server version)
  // This is used by the client to detect version mismatches and force updates.
  // Note: X-App-Version header is also injected on every response by the middleware above.
  // The /api prefix bypasses older PWA navigation caches for recovery.
  app.get("/api/app-update", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(appUpdatePage);
  });
  app.get("/api/health", async (_req, res) => {
    const ready = await databaseReady();
    res.status(ready ? 200 : 503).json({status:ready?"ok":"database_not_ready",version:packageJson.version});
  });
  app.get("/api/version", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.json({
      version: packageJson.version,
      commit: process.env.RAILWAY_GIT_COMMIT_SHA || null,
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

  // ── Video proxy ─────────────────────────────────────────────────
  // Serves videos with proper Range request support (required by iOS Safari autoplay).
  // If the video is hosted on R2, redirects directly. Otherwise proxies from origin.
  app.get("/api/ig-video/:id", async (req, res) => {
    try {
      const { getDb } = await import("../db");
      const schema = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) return res.status(500).json({ error: "DB unavailable" });

      const portfolioId = parseInt(req.params.id, 10);
      if (isNaN(portfolioId))
        return res.status(400).json({ error: "Invalid ID" });

      const item = await db.query.portfolios.findFirst({
        where: eq(schema.portfolios.id, portfolioId),
        columns: { cdnUrl: true, mediaType: true, externalMediaId: true },
      });

      if (!item || item.mediaType !== "video" || !item.cdnUrl) {
        return res.status(404).json({ error: "Video not found" });
      }

      const R2_PUBLIC = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

      // If the video is already on R2, redirect directly (no proxy needed)
      if (R2_PUBLIC && item.cdnUrl.startsWith(R2_PUBLIC)) {
        res.setHeader("Cache-Control", "public, max-age=86400"); // 24h cache
        return res.redirect(302, item.cdnUrl);
      }

      // ── Proxy mode: forward Range requests for iOS Safari ──
      const upstreamHeaders: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (compatible; TattoiApp/1.0)",
      };

      // Forward Range header from client
      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        upstreamHeaders["Range"] = rangeHeader;
      }

      const videoResponse = await fetch(item.cdnUrl, {
        headers: upstreamHeaders,
      });

      if (!videoResponse.ok && videoResponse.status !== 206) {
        console.error(
          `[Video Proxy] Failed: ${videoResponse.status} from ${item.cdnUrl.slice(0, 80)}`
        );
        return res
          .status(502)
          .json({ error: "Failed to fetch video from source" });
      }

      // Forward response headers
      const contentType =
        videoResponse.headers.get("content-type") || "video/mp4";
      const contentLength = videoResponse.headers.get("content-length");
      const contentRange = videoResponse.headers.get("content-range");
      const acceptRanges = videoResponse.headers.get("accept-ranges");

      // Set appropriate status code
      const statusCode = videoResponse.status === 206 ? 206 : 200;

      res.status(statusCode);
      res.setHeader("Content-Type", contentType);
      if (contentLength) res.setHeader("Content-Length", contentLength);
      if (contentRange) res.setHeader("Content-Range", contentRange);
      res.setHeader("Accept-Ranges", acceptRanges || "bytes");
      res.setHeader("Cache-Control", "public, max-age=3600");

      // Pipe the response body to the client
      const reader = videoResponse.body?.getReader();
      if (!reader) return res.status(502).json({ error: "No response body" });

      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          }
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
        console.error(
          "[Map Image] Google returned",
          googleRes.status,
          await googleRes.text()
        );
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

  // tRPC API. Procedure names sit in the last path segment (comma-separated
  // when batched), so the per-procedure limiters match on names, not on a mount path.
  app.use("/api/trpc", trpcProcedureLimiter(authLimiter));
  app.use("/api/trpc", trpcProcedureLimiter(uploadLimiter));
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
    import("../services/scheduler")
      .then(({ startScheduledTasks }) => {
        startScheduledTasks();
      })
      .catch(err => {
        console.error("[Scheduler] Failed to start scheduled tasks:", err);
      });

    // One-time: store products imported before categories were saved get them (idempotent)
    import("../startup/backfillProductCategories")
      .then(({ backfillProductCategories }) =>
        backfillProductCategories().catch(err => {
          console.error("[Backfill] Product categories failed:", err);
        })
      )
      .catch(err => {
        console.error("[Backfill] Could not load the product category backfill:", err);
      });
  });
}

startServer().catch(console.error);
// Trigger restart for DB migration v1.0.304
