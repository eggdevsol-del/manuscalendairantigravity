import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/** Host-only cookies by default. Guessing a parent domain from the last two labels breaks on shared
 *  suffixes (".co.uk", ".railway.app"), which browsers refuse, so a wider domain must be configured with
 *  COOKIE_DOMAIN and only applies to hosts inside it. tattoi.app keeps its shared cookie across subdomains. */
function getCookieDomain(hostname: string): string | undefined {
  if (!hostname || LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) {
    return undefined;
  }

  const configured = process.env.COOKIE_DOMAIN?.trim();
  if (configured) {
    const bare = configured.replace(/^\./, "").toLowerCase();
    const host = hostname.toLowerCase();
    return host === bare || host.endsWith("." + bare) ? `.${bare}` : undefined;
  }

  if (hostname === "tattoi.app" || hostname.endsWith(".tattoi.app")) {
    return ".tattoi.app";
  }

  return undefined;
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const domain = getCookieDomain(req.hostname);

  return {
    domain,
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req),
  };
}
