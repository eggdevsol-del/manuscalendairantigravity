import { lookup as dnsLookup } from "node:dns";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";

export interface ExternalEvent {
    start: Date;
    end: Date;
    summary: string;
}

function parseIcsDate(d: string): Date {
    let clean = d.trim().replace("Z", "");
    
    // Strip parameters like TZID=...: or VALUE=DATE:
    if (clean.includes(":")) {
        clean = clean.split(":").pop() || clean;
    }

    if (clean.length === 8) {
        // All day event: YYYYMMDD
        return new Date(
            `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}T00:00:00.000Z`
        );
    }
    // Standard UTC: YYYYMMDDTHHMMSS
    const isoStr = clean.replace(
        /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/,
        "$1-$2-$3T$4:$5:$6.000Z"
    );
    return new Date(isoStr);
}

const GENERIC_ERROR = "Invalid or unreachable calendar URL.";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;

// Addresses a calendar feed may never be fetched from: this server's own
// network, cloud metadata endpoints and other non-public ranges.
const blocked = new BlockList();
for (const [net, prefix] of [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["224.0.0.0", 3],
] as const) {
    blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
    ["::", 127], // unspecified and loopback
    ["64:ff9b::", 96], // NAT64
    ["fc00::", 7], // unique local
    ["fe80::", 10], // link-local
    ["ff00::", 8], // multicast
    // Tunnels that carry an IPv4 address inside, which could be a private one.
    ["2002::", 16], // 6to4
    ["2001::", 32], // Teredo
] as const) {
    blocked.addSubnet(net, prefix, "ipv6");
}

export function isBlockedAddress(address: string): boolean {
    const family = isIP(address);
    if (family === 4) return blocked.check(address, "ipv4");
    if (family !== 6) return true;
    // IPv4 written as IPv6 (::ffff:a.b.c.d or ::ffff:hhhh:hhhh) is judged as IPv4.
    const mapped = address.toLowerCase().match(/^::ffff:(.+)$/);
    if (mapped) {
        if (isIP(mapped[1]) === 4) return blocked.check(mapped[1], "ipv4");
        const parts = mapped[1].split(":").map(p => parseInt(p, 16));
        if (parts.length !== 2 || parts.some(Number.isNaN)) return true;
        const v4 = `${parts[0] >> 8}.${parts[0] & 255}.${parts[1] >> 8}.${parts[1] & 255}`;
        return blocked.check(v4, "ipv4");
    }
    return blocked.check(address, "ipv6");
}

type Lookup = typeof dnsLookup;

// Used as the socket's own resolver, so the address that was checked is the
// address that is connected to (a second DNS answer cannot swap it).
function publicOnlyLookup(resolve: Lookup): Lookup {
    return ((hostname: string, options: any, callback: any) => {
        const cb = typeof options === "function" ? options : callback;
        const opts = typeof options === "function" ? {} : options || {};
        (resolve as any)(
            hostname,
            { ...opts, all: true },
            (err: Error | null, addresses: { address: string; family: number }[]) => {
                if (err) return cb(err);
                if (!addresses?.length || addresses.some(a => isBlockedAddress(a.address))) {
                    return cb(new Error("Address not allowed"));
                }
                if (opts.all) return cb(null, addresses);
                cb(null, addresses[0].address, addresses[0].family);
            }
        );
    }) as Lookup;
}

/** Parses and checks a calendar address before anything is fetched. Throws if it is not a public https URL. */
export function checkCalendarUrl(raw: string): URL {
    // Calendar apps hand out webcal:// links, which are https feeds.
    const url = new URL(raw.trim().replace(/^webcal:\/\//i, "https://"));
    if (url.protocol !== "https:") throw new Error("Only https is allowed");
    if (url.username || url.password) throw new Error("Credentials are not allowed");
    // Other ports would let this be used to probe services on public hosts.
    if (url.port && url.port !== "443") throw new Error("Port not allowed");
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (!host || host === "localhost" || host.endsWith(".localhost")) {
        throw new Error("Host not allowed");
    }
    // Literal addresses skip DNS, so they are checked here.
    if (isIP(host) && isBlockedAddress(host)) throw new Error("Address not allowed");
    return url;
}

function fetchOnce(url: URL, resolve: Lookup, deadline: number) {
    return new Promise<{ redirect?: string; text?: string }>((finish, reject) => {
        // The socket timeout below only covers idle time. This one bounds the
        // whole request and closes the socket, so a slow drip cannot outlive it.
        const overall = setTimeout(
            () => req.destroy(new Error("Timed out")),
            Math.max(1, deadline - Date.now())
        );
        const done = (value: { redirect?: string; text?: string }) => {
            clearTimeout(overall);
            finish(value);
        };
        const fail = (error: Error) => {
            clearTimeout(overall);
            reject(error);
        };
        const req = request(
            url,
            {
                method: "GET",
                lookup: publicOnlyLookup(resolve),
                headers: { accept: "text/calendar, text/plain;q=0.9, */*;q=0.1" },
                // No shared agent: a pooled socket would skip the lookup check.
                agent: false,
            },
            res => {
                const status = res.statusCode || 0;
                if (status >= 300 && status < 400 && res.headers.location) {
                    res.resume();
                    return done({ redirect: res.headers.location });
                }
                if (status < 200 || status >= 300) {
                    res.resume();
                    return fail(new Error(`Status ${status}`));
                }
                if (Number(res.headers["content-length"] || 0) > MAX_BYTES) {
                    req.destroy();
                    return fail(new Error("Response too large"));
                }
                const chunks: Buffer[] = [];
                let size = 0;
                res.on("data", (chunk: Buffer) => {
                    size += chunk.length;
                    if (size > MAX_BYTES) {
                        req.destroy();
                        return fail(new Error("Response too large"));
                    }
                    chunks.push(chunk);
                });
                res.on("end", () => done({ text: Buffer.concat(chunks).toString("utf8") }));
                res.on("error", fail);
            }
        );
        req.setTimeout(Math.max(1, deadline - Date.now()), () => {
            req.destroy(new Error("Timed out"));
        });
        req.on("error", fail);
        req.end();
    });
}

/** Fetches a calendar feed from a public https address only, with a time and size limit. */
export async function fetchCalendarText(raw: string, resolve: Lookup = dnsLookup): Promise<string> {
    const deadline = Date.now() + FETCH_TIMEOUT_MS;
    let url = checkCalendarUrl(raw);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const result = await fetchOnce(url, resolve, deadline);
        if (result.text !== undefined) return result.text;
        // Each redirect target gets the same checks as the first address.
        url = checkCalendarUrl(new URL(result.redirect!, url).toString());
    }
    throw new Error("Too many redirects");
}

export function parseIcsText(text: string): ExternalEvent[] {
    const events: ExternalEvent[] = [];
    const vevents = text.split("BEGIN:VEVENT");
    vevents.shift(); // Remove the master header strings before first VEVENT

    for (const block of vevents) {
        const endBlock = block.split("END:VEVENT")[0];

        const dtstartMatch = endBlock.match(/DTSTART(?:;[^:]*)?:(.*)\r?\n/);
        const dtendMatch = endBlock.match(/DTEND(?:;[^:]*)?:(.*)\r?\n/);
        const summaryMatch = endBlock.match(/SUMMARY(?:;[^:]*)?:(.*)\r?\n/);

        if (dtstartMatch) {
            try {
                const start = parseIcsDate(dtstartMatch[1]);
                const end = dtendMatch ? parseIcsDate(dtendMatch[1]) : start;

                if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                    throw new Error(`Invalid Date format parsed from ${dtstartMatch[1]}`);
                }

                events.push({
                    start,
                    end,
                    summary: summaryMatch ? summaryMatch[1].trim() : "Busy",
                });
            } catch (e) {
                console.warn("Skipping unparseable date format in calendar sync.", dtstartMatch[1]);
            }
        }
    }

    return events;
}

export async function parseExternalCalendar(url: string): Promise<ExternalEvent[]> {
    try {
        return parseIcsText(await fetchCalendarText(url));
    } catch (error: any) {
        // The reason stays in the server log; callers get one message that
        // says nothing about what this server can or cannot reach.
        console.error("[iCal Parser] Calendar feed rejected or unreadable:", error?.message);
        throw new Error(GENERIC_ERROR);
    }
}
