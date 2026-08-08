/**
 * instagramProvider.ts — RapidAPI Instagram Scraper 2025 adapter
 * 
 * Abstracted provider interface so the underlying API can be swapped
 * from RapidAPI → Meta Graph API without changing consuming code.
 */

const RAPIDAPI_HOST = "instagram-scraper-20251.p.rapidapi.com";
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";

// ── Types ──────────────────────────────────────────

export interface InstagramMedia {
  mediaId: string;
  mediaType: "image" | "video" | "carousel";
  imageUrl: string;          // Best-quality image URL (CORS-safe)
  videoUrl?: string;         // Video URL for reels (CORS-safe)
  thumbnailUrl?: string;     // Thumbnail for videos
  permalink: string;         // Instagram post URL
  caption: string;
  publishedAt: Date;
  children?: InstagramMediaChild[]; // Carousel slides
}

export interface InstagramMediaChild {
  mediaId: string;
  mediaType: "image" | "video";
  imageUrl: string;
  videoUrl?: string;
}

export interface InstagramUserInfo {
  userId: string;
  username: string;
  fullName: string;
  biography: string;
  followerCount: number;
  mediaCount: number;
  profilePicUrl: string;
  isPrivate: boolean;
}

export interface FetchMediaResult {
  media: InstagramMedia[];
  nextCursor: string | null;
  totalEstimate?: number;
}

// ── Provider Interface ─────────────────────────────

export interface InstagramProvider {
  getUserInfo(username: string): Promise<InstagramUserInfo>;
  fetchUserMedia(username: string, cursor?: string): Promise<FetchMediaResult>;
}

// ── RapidAPI Implementation ────────────────────────

async function rapidApiRequest(endpoint: string, params: Record<string, string>) {
  const url = new URL(`https://${RAPIDAPI_HOST}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": RAPIDAPI_HOST,
      "x-rapidapi-key": RAPIDAPI_KEY,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RapidAPI error ${response.status}: ${text}`);
  }

  return response.json();
}

function parseMediaType(item: any): "image" | "video" | "carousel" {
  // media_type: 1 = image, 2 = video, 8 = carousel
  if (item.media_type === 8 || item.product_type === "carousel_container") return "carousel";
  if (item.media_type === 2 || item.product_type === "clips") return "video";
  return "image";
}

function getBestImageUrl(item: any): string {
  const versions = item.image_versions?.items || [];
  if (versions.length === 0) return "";
  // Pick the largest version
  const sorted = [...versions].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
  return sorted[0]?.url || "";
}

function getBestVideoUrl(item: any): string | undefined {
  const versions = item.video_versions || [];
  if (versions.length === 0) return undefined;
  // Pick highest quality
  const sorted = [...versions].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
  return sorted[0]?.url;
}

function parseItem(item: any): InstagramMedia {
  const mediaType = parseMediaType(item);
  const code = item.code || "";
  const permalink = `https://www.instagram.com/p/${code}/`;

  let children: InstagramMediaChild[] | undefined;
  if (mediaType === "carousel" && item.carousel_media) {
    children = item.carousel_media.map((child: any) => ({
      mediaId: String(child.id || ""),
      mediaType: child.video_versions?.length ? "video" as const : "image" as const,
      imageUrl: getBestImageUrl(child),
      videoUrl: getBestVideoUrl(child),
    }));
  }

  return {
    mediaId: String(item.id || ""),
    mediaType,
    imageUrl: getBestImageUrl(item),
    videoUrl: getBestVideoUrl(item),
    thumbnailUrl: mediaType === "video" ? getBestImageUrl(item) : undefined,
    permalink,
    caption: item.caption?.text || "",
    publishedAt: new Date((item.taken_at || 0) * 1000),
    children,
  };
}

export class RapidApiInstagramProvider implements InstagramProvider {
  async getUserInfo(username: string): Promise<InstagramUserInfo> {
    const data = await rapidApiRequest("/userinfo/", {
      username_or_id: username,
      url_embed_safe: "true",
    });

    const d = data.data || data;
    return {
      userId: String(d.id || d.pk || ""),
      username: d.username || username,
      fullName: d.full_name || "",
      biography: d.biography || "",
      followerCount: d.follower_count || 0,
      mediaCount: d.media_count || 0,
      profilePicUrl: d.profile_pic_url || d.hd_profile_pic_url_info?.url || "",
      isPrivate: !!d.is_private,
    };
  }

  async fetchUserMedia(username: string, cursor?: string): Promise<FetchMediaResult> {
    const params: Record<string, string> = {
      username_or_id_or_url: username,
      url_embed_safe: "true",
    };
    if (cursor) {
      params.pagination_token = cursor;
    }

    const data = await rapidApiRequest("/userposts/", params);
    const d = data.data || data;
    const items = d.items || [];
    const nextCursor = d.pagination_token || null;

    const media = items.map(parseItem);

    return {
      media,
      nextCursor,
      totalEstimate: d.count,
    };
  }
}

// ── Singleton export ───────────────────────────────

let provider: InstagramProvider | null = null;

export function getInstagramProvider(): InstagramProvider {
  if (!provider) {
    if (!RAPIDAPI_KEY) {
      console.warn("[Instagram] RAPIDAPI_KEY not set — provider will fail");
    }
    provider = new RapidApiInstagramProvider();
  }
  return provider;
}
