import type { Request, RequestHandler } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * Railway's edge proxy is the single hop in front of the app and appends the
 * real client address to X-Forwarded-For. Trusting exactly that hop makes
 * req.ip the address Railway saw; trusting every hop ("true") would take the
 * left-most entry, which the caller writes themselves.
 * Set TRUST_PROXY_HOPS if another proxy (for example a CDN) is put in front.
 */
export function trustProxySetting(env: NodeJS.ProcessEnv = process.env) {
  // An empty value (TRUST_PROXY_HOPS= in a dashboard) means unset, not 0:
  // 0 would make req.ip the proxy's address and put every user in one bucket.
  const raw = env.TRUST_PROXY_HOPS?.trim();
  if (!raw) return 1;
  const hops = Number(raw);
  return Number.isInteger(hops) && hops >= 0 ? hops : 1;
}

/**
 * Procedure names in a tRPC request, read the same way the tRPC express
 * adapter reads them: the last path segment, URL-decoded, comma-separated
 * for a batch (/api/trpc/auth.login,auth.me?batch=1).
 */
export function trpcProcedureNames(path: string): string[] {
  const segment = path.slice(path.lastIndexOf("/") + 1);
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // tRPC rejects a malformed path; nothing to limit.
  }
  return decoded.split(",").filter(Boolean);
}

type ProcedureLimiter = {
  matches: (procedure: string) => boolean;
  limiter: RequestHandler;
};

const LIMITED_PROCEDURE = "rateLimitedProcedure";

function clientKey(req: Request) {
  return ipKeyGenerator(req.ip || req.socket?.remoteAddress || "unknown");
}

/**
 * Answers 429 in the shape the tRPC client (httpBatchLink + superjson) can
 * read, one error per call in the request, so the person sees the message
 * instead of "Unable to transform response from server".
 */
export function trpcTooManyRequests(message: string): RequestHandler {
  return (req, res) => {
    const errorFor = (path: string) => ({
      error: {
        json: {
          message,
          code: -32029,
          data: { code: "TOO_MANY_REQUESTS", httpStatus: 429, path },
        },
      },
    });
    const names = trpcProcedureNames(req.path);
    res
      .status(429)
      .json(
        req.query.batch !== undefined
          ? names.map(errorFor)
          : errorFor(names[0] ?? "")
      );
  };
}

// Public procedures that take a password, a sign-in or reset token, or send
// an email: the ones worth guessing at or hammering.
export const AUTH_LIMITED_PROCEDURES = [
  "auth.login",
  "auth.register",
  "auth.requestPasswordReset",
  "auth.requestMagicLink",
  "auth.checkEmailExists",
  "auth.verifyMagicLink",
  "auth.resetPassword",
  "auth.setPasswordForFunnelClient",
  "auth.googleLogin",
  "auth.claimLead",
  "merchantAuth.register",
  "merchantAuth.claimStorefront",
  "masterDev.login",
];

// A batch is counted once per matching call (see trpcProcedureLimiter), which
// express-rate-limit would otherwise report as a double count.
const validate = { trustProxy: false, singleCount: false };

export function createAuthLimiter(): ProcedureLimiter {
  return {
    matches: procedure => AUTH_LIMITED_PROCEDURES.includes(procedure),
    // 10 per 15 minutes per IP, counted separately for each procedure
    limiter: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req, res) =>
        `${clientKey(req)}:${res.locals[LIMITED_PROCEDURE]}`,
      handler: trpcTooManyRequests(
        "Too many attempts, please try again in a few minutes."
      ),
      validate,
    }),
  };
}

export function createUploadLimiter(): ProcedureLimiter {
  return {
    matches: procedure => procedure.startsWith("upload."),
    // 20 per minute per IP
    limiter: rateLimit({
      windowMs: 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: req => clientKey(req),
      handler: trpcTooManyRequests(
        "Too many uploads, please try again in a minute."
      ),
      validate,
    }),
  };
}

export const authLimiter = createAuthLimiter();
export const uploadLimiter = createUploadLimiter();

/**
 * Mount on the tRPC base path; applies the limiter only to requests that call
 * a matching procedure. Every matching call in a batch is counted, so batching
 * cannot multiply the allowance; if any one is over, the whole request is 429.
 */
export function trpcProcedureLimiter({
  matches,
  limiter,
}: ProcedureLimiter): RequestHandler {
  return (req, res, next) => {
    const limited = trpcProcedureNames(req.path).filter(matches);
    const count = (i: number): void => {
      if (i === limited.length) return next();
      res.locals[LIMITED_PROCEDURE] = limited[i];
      limiter(req, res, err => (err ? next(err) : count(i + 1)));
    };
    count(0);
  };
}
