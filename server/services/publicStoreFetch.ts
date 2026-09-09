import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const)
  blocked.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
for (const [address, prefix] of [
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
] as const)
  blocked.addSubnet(address, prefix, "ipv6");
export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  return (
    family === 6 &&
    globalV6.check(address, "ipv6") &&
    !blocked.check(address, "ipv6")
  );
}
export function parseStoreUrl(input: string): URL {
  const url = new URL(
    /^https?:\/\//i.test(input.trim())
      ? input.trim()
      : `https://${input.trim()}`
  );
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["443", "80"].includes(url.port))
  )
    throw new Error("Use a public HTTP or HTTPS storefront URL.");
  const hostname = url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (
    (!hostname.includes(".") && !isIP(hostname)) ||
    /(^|\.)(localhost|local|internal|invalid|test|onion)$/.test(hostname)
  )
    throw new Error("Use a public storefront hostname.");
  if (isIP(hostname) && !isPublicAddress(hostname))
    throw new Error("Private network addresses are not allowed.");
  return url;
}
/** Resolve and pin a public IP for every request/redirect, bounding time and response size. */
export async function publicStoreFetch(
  input: string,
  init: { headers?: Record<string, string>; signal?: AbortSignal } = {}
): Promise<Response> {
  let url = parseStoreUrl(input);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await Promise.race([
          lookup(hostname, { all: true }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("Store address lookup timed out.")),
              8000
            );
          }),
        ]).finally(() => clearTimeout(timer));
    if (
      !addresses.length ||
      addresses.some(item => !isPublicAddress(item.address))
    )
      throw new Error("Private network addresses are not allowed.");
    const pinned = addresses[0];
    const response = await new Promise<Response>((resolve, reject) => {
      const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
        url,
        {
          agent: false,
          headers: { ...init.headers, "Accept-Encoding": "identity" },
          signal: init.signal || AbortSignal.timeout(10000),
          // Pin the checked address; never perform a second DNS resolution in the socket.
          lookup: (_hostname, options, callback) => {
            if (typeof options === "object" && options.all)
              (callback as any)(null, [pinned]);
            else (callback as any)(null, pinned.address, pinned.family);
          },
        },
        incoming => {
          const chunks: Buffer[] = [];
          let size = 0;
          incoming.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 5 * 1024 * 1024) {
              incoming.destroy(new Error("Store response exceeds 5 MB."));
              return;
            }
            chunks.push(chunk);
          });
          incoming.on("error", reject);
          incoming.on("end", () => {
            const headers = new Headers();
            for (const [key, value] of Object.entries(incoming.headers))
              if (value !== undefined)
                headers.set(
                  key,
                  Array.isArray(value) ? value.join(",") : value
                );
            const status = incoming.statusCode || 502;
            resolve(
              new Response(
                [204, 205, 304].includes(status) ? null : Buffer.concat(chunks),
                { status, headers }
              )
            );
          });
        }
      );
      request.on("error", () =>
        reject(new Error("Could not connect to the public storefront."))
      );
      request.end();
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    url = parseStoreUrl(new URL(location, url).href);
  }
  throw new Error("Too many storefront redirects.");
}
