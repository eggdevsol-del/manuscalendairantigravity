import "dotenv/config";
import fs from "fs";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import path from "path";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { verifyAndFixDatabase } from "../verify-and-fix-db";
import { storageGetData } from "../storage";
import { startOutboxWorker } from "../workers/outboxProcessor";
import { registerPublicFunnelRoutes } from "./publicFunnelRoutes";


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
    await verifyAndFixDatabase();
  } catch (error) {
    console.error('[Server] Database initialization failed:', error);
    // Continue anyway - the app might work in read-only mode or with existing tables
  }

  // Start background workers
  try {
    startOutboxWorker();
  } catch (e) {
    console.error('[Server] Failed to start outbox worker:', e);
  }

  const app = express();
  const server = createServer(app);

  // 1. Move CORS to the very top to handle preflight requests first
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps often have no origin header)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "http://localhost",
        "https://localhost",
        "capacitor://localhost",
        "https://artist-booking-app-production.up.railway.app"
      ];

      // Allow exact matches or any localhost port
      if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        // Log unauthorized origins for debugging in server logs
        console.log(`[CORS] Blocked origin: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true,
  }));

  // Handle preflight for all routes
  app.options('*', cors());

  // 2. Configure body parsers
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Ensure upload directory exists
  const uploadDir = path.join(process.cwd(), "server", "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('[Server] Created uploads directory at:', uploadDir);
  }

  // Serve static uploads
  app.use("/uploads", express.static(uploadDir));

  // Public funnel API routes (no auth required)
  registerPublicFunnelRoutes(app);

  // Version endpoint for cache-busting (returns current server version)
  // This is used by the client to detect version mismatches and force updates
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
  app.get('/api/version', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({
      version: packageJson.version,
      timestamp: Date.now()
    });
  });

  // File serving endpoint - handle full paths with subdirectories
  app.get("/api/files/*", async (req, res) => {
    try {
      // Get the full path after /api/files/
      const key = (req.params as any)[0];
      console.log(`[File Serving] Request for key: ${key}`);
      const file = await storageGetData(key);

      if (!file) {
        console.warn(`[File Serving] File not found for key: ${key}`);
        return res.status(404).json({ error: "File not found" });
      }

      console.log(`[File Serving] Serving file: ${key} (${file.mimeType}, ${file.data.length} bytes)`);
      res.setHeader("Content-Type", file.mimeType);
      res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
      res.send(file.data);
    } catch (error) {
      console.error("[File Serving] Error:", error);
      res.status(500).json({ error: "Failed to retrieve file" });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: ({ path, error }) => {
        console.error(`[tRPC Error] Path: ${path}`);
        console.error(`[tRPC Error] Code: ${error.code}`);
        console.error(`[tRPC Error] Message: ${error.message}`);
        console.error(`[tRPC Error] Stack:`, error.stack);
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
    if (port !== preferredPort) {
      console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
    }
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}

startServer().catch(console.error);
// Trigger restart for DB migration v1.0.304
