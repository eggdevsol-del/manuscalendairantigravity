// @vitest-environment node
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { afterEach, describe, expect, it } from "vitest";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import {
  AUTH_LIMITED_PROCEDURES,
  createAuthLimiter,
  createUploadLimiter,
  trpcProcedureLimiter,
  trpcProcedureNames,
  trustProxySetting,
} from "./rateLimiters";

let server: Server | undefined;
afterEach(() => server?.close());

async function start() {
  const app = express();
  app.set("trust proxy", trustProxySetting({}));
  app.use("/api/trpc", trpcProcedureLimiter(createAuthLimiter()));
  app.use("/api/trpc", trpcProcedureLimiter(createUploadLimiter()));
  app.use("/api/trpc", (_req, res) => res.json({ ok: true }));
  server = app.listen(0);
  await new Promise(resolve => server!.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return (path: string, forwardedFor = "203.0.113.5") =>
    fetch(base + path, {
      method: "POST",
      headers: { "x-forwarded-for": forwardedFor },
    }).then(r => r.status);
}

async function repeat(times: number, call: () => Promise<number>) {
  const statuses: number[] = [];
  for (let i = 0; i < times; i++) statuses.push(await call());
  return statuses;
}

describe("trpcProcedureNames", () => {
  it("reads single, batched and encoded procedure paths as tRPC does", () => {
    expect(trpcProcedureNames("/auth.login")).toEqual(["auth.login"]);
    expect(trpcProcedureNames("/auth.me,upload.getUploadUrl")).toEqual([
      "auth.me",
      "upload.getUploadUrl",
    ]);
    expect(trpcProcedureNames("/auth%2Elogin%2Cauth.me")).toEqual([
      "auth.login",
      "auth.me",
    ]);
    expect(trpcProcedureNames("/anything/auth.login")).toEqual(["auth.login"]);
  });
});

describe("auth rate limit", () => {
  it.each(AUTH_LIMITED_PROCEDURES)(
    "allows 10 calls to %s, then 429",
    async p => {
      const call = await start();
      const statuses = await repeat(11, () => call(`/api/trpc/${p}`));
      expect(statuses).toEqual([...Array(10).fill(200), 429]);
    }
  );

  it("counts a call hidden in a batch, an encoded path or an extra path segment", async () => {
    const call = await start();
    const variants = [
      "/api/trpc/auth.me,auth.login?batch=1",
      "/api/trpc/auth%2Elogin",
      "/api/trpc/x/auth.login",
    ];
    const statuses = await repeat(11, () =>
      call(variants[Math.floor(Math.random() * variants.length)])
    );
    expect(statuses[9]).toBe(200);
    expect(statuses[10]).toBe(429);
  });

  it("counts every limited call in a batch, so batching cannot multiply the allowance", async () => {
    const call = await start();
    const batch = (n: number) =>
      `/api/trpc/${Array(n).fill("auth.login").join(",")}?batch=1`;
    expect(await call(batch(11))).toBe(429);
    expect(await call(batch(6), "198.51.100.8")).toBe(200);
    expect(await call(batch(5), "198.51.100.8")).toBe(429);
  });

  it("lets different auth calls share a batch, each on its own count", async () => {
    const call = await start();
    const statuses = await repeat(10, () =>
      call("/api/trpc/auth.checkEmailExists,auth.login?batch=1")
    );
    expect(statuses).toEqual(Array(10).fill(200));
    expect(await call("/api/trpc/auth.login")).toBe(429);
  });

  it("does not limit other procedures or other callers", async () => {
    const call = await start();
    await repeat(11, () => call("/api/trpc/auth.login"));
    expect(await call("/api/trpc/auth.me")).toBe(200);
    expect(await call("/api/trpc/auth.loginHistory")).toBe(200);
    expect(await call("/api/trpc/auth.login", "198.51.100.7")).toBe(200);
  });

  it("cannot be escaped by sending a made-up X-Forwarded-For entry", async () => {
    const call = await start();
    let n = 0;
    const statuses = await repeat(11, () =>
      call("/api/trpc/auth.login", `10.0.0.${n++}, 203.0.113.5`)
    );
    expect(statuses[10]).toBe(429);
  });
});

describe("upload rate limit", () => {
  it("applies to tRPC upload procedures, alone or batched", async () => {
    const call = await start();
    let n = 0;
    const statuses = await repeat(21, () =>
      call(
        n++ % 2
          ? "/api/trpc/upload.getUploadUrl"
          : "/api/trpc/auth.me,upload.uploadImage?batch=1"
      )
    );
    expect(statuses[19]).toBe(200);
    expect(statuses[20]).toBe(429);
    expect(await call("/api/trpc/uploads.other")).toBe(200);
  });

  it("counts every upload in a batch", async () => {
    const call = await start();
    const batch = (n: number) =>
      `/api/trpc/${Array(n).fill("upload.getUploadUrl").join(",")}?batch=1`;
    expect(await call(batch(21))).toBe(429);
    expect(await call(batch(20), "198.51.100.9")).toBe(200);
    expect(await call("/api/trpc/upload.uploadImage", "198.51.100.9")).toBe(
      429
    );
  });
});

describe("429 response", () => {
  it("is a tRPC error the real client can read, single or batched", async () => {
    const call = await start();
    await repeat(10, () => call("/api/trpc/auth.login"));
    const url = `http://127.0.0.1:${(server!.address() as AddressInfo).port}/api/trpc`;
    const headers = { "x-forwarded-for": "203.0.113.5" };
    const message = "Too many attempts, please try again in a few minutes.";

    const single = await fetch(`${url}/auth.login`, {
      method: "POST",
      headers,
    });
    expect(single.status).toBe(429);
    expect(await single.json()).toEqual({
      error: {
        json: {
          message,
          code: -32029,
          data: {
            code: "TOO_MANY_REQUESTS",
            httpStatus: 429,
            path: "auth.login",
          },
        },
      },
    });

    const client = createTRPCClient<any>({
      links: [httpBatchLink({ url, transformer: superjson, headers })],
    }) as any;
    // Two mutations sent in one tick travel as one batch of two.
    const results = await Promise.allSettled([
      client.auth.logout.mutate(),
      client.auth.login.mutate({ email: "a@example.com", password: "x" }),
    ]);
    for (const result of results) {
      expect(result.status).toBe("rejected");
      const error = (result as PromiseRejectedResult).reason;
      expect(error).toBeInstanceOf(TRPCClientError);
      expect(error.message).toBe(message);
      expect(error.data.code).toBe("TOO_MANY_REQUESTS");
    }
  });
});

describe("trustProxySetting", () => {
  it("trusts one hop by default and honours TRUST_PROXY_HOPS", () => {
    expect(trustProxySetting({})).toBe(1);
    expect(trustProxySetting({ TRUST_PROXY_HOPS: "2" })).toBe(2);
    expect(trustProxySetting({ TRUST_PROXY_HOPS: "0" })).toBe(0);
    expect(trustProxySetting({ TRUST_PROXY_HOPS: "true" })).toBe(1);
  });

  it("treats an empty or blank TRUST_PROXY_HOPS as unset", () => {
    expect(trustProxySetting({ TRUST_PROXY_HOPS: "" })).toBe(1);
    expect(trustProxySetting({ TRUST_PROXY_HOPS: "  " })).toBe(1);
  });
});
