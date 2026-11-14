// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";

// index.ts starts the server on import, so its wiring is checked at source level.
const source = readFileSync(
  resolve(process.cwd(), "server/_core/index.ts"),
  "utf8"
);

describe("server entry point", () => {
  it("has no key-in-query admin routes or embedded artist seed data", () => {
    expect(source).not.toMatch(/\/api\/admin\//);
    expect(source).not.toContain("RAPIDAPI_KEY");
    expect(source).not.toContain("REAL_ARTISTS");
    expect(source).not.toMatch(/req\.query\.key/);
  });

  it("does not seed portfolio images on boot", () => {
    expect(source).not.toContain("seedPortfolios");
    expect(source).not.toContain("picsum.photos");
    expect(
      existsSync(resolve(process.cwd(), "server/startup/seedPortfolios.ts"))
    ).toBe(false);
  });

  it("allows only Tattoi, env-driven and localhost CORS origins", () => {
    const list = source.match(/const allowedOrigins = \[([\s\S]*?)\];/)?.[1];
    expect(list).toBeTruthy();
    const origins = [...list!.matchAll(/"([^"]+)"/g)].map(m => m[1]);
    expect(origins).toContain("https://tattoi.app");
    for (const origin of origins) {
      const { protocol, hostname } = new URL(origin);
      if (hostname === "localhost") continue;
      expect(protocol).toBe("https:");
      expect(hostname).toMatch(
        /(^|\.)tattoi\.app$|^artist-booking-app-production\.up\.railway\.app$/
      );
    }
  });

  it("mounts the auth and upload limiters by procedure name, with a bounded proxy trust", () => {
    expect(source).toContain("trpcProcedureLimiter(authLimiter)");
    expect(source).toContain("trpcProcedureLimiter(uploadLimiter)");
    expect(source).not.toContain('"/api/trpc/upload"');
    expect(source).toContain('app.set("trust proxy", trustProxySetting())');
  });
});

describe("app router", () => {
  it("no longer exposes the invitations router", () => {
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures.filter(p => p.startsWith("invitations."))).toEqual([]);
    expect(procedures).toContain("studios.respondToInvite");
  });

  it("still has every procedure the auth limiter names", async () => {
    const { AUTH_LIMITED_PROCEDURES } = await import("./rateLimiters");
    const procedures = Object.keys(appRouter._def.procedures);
    for (const name of AUTH_LIMITED_PROCEDURES)
      expect(procedures).toContain(name);
  });
});
