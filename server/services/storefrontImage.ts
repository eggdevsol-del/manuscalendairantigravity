import { publicStoreFetch } from "./publicStoreFetch";

/** Prefer the homepage's featured image, then a marked hero/banner image. */
export function extractStorefrontImage(html: string, baseUrl: string): string | null {
  const tags = html.match(/<(?:meta|img)\b[^>]*>/gi) || [];
  const parsed = tags.map(tag => {
    const attrs: Record<string, string> = {};
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
      attrs[match[1].toLowerCase()] = match[2] ?? match[3];
    return attrs;
  });
  const candidates = [
    ...parsed.filter(a => a.property?.toLowerCase() === "og:image").map(a => a.content),
    ...parsed.filter(a => a.name?.toLowerCase() === "twitter:image").map(a => a.content),
    ...parsed.filter(a => /hero|banner|slideshow/i.test(`${a.class || ""} ${a.id || ""} ${a.alt || ""}`)).map(a => a["data-src"] || a.src),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate.replace(/&amp;/g, "&"), baseUrl);
      if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return url.href;
    } catch { /* Try the next image. */ }
  }
  return null;
}
export async function fetchStorefrontImage(baseUrl: string) {
  try {
    const response = await publicStoreFetch(baseUrl, { signal: AbortSignal.timeout(8000), headers: { Accept: "text/html" } });
    if (!response.ok) return null;
    return extractStorefrontImage(await response.text(), baseUrl);
  } catch { return null; }
}
