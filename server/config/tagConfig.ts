/**
 * tagConfig — Smart hashtag extraction config
 * ─────────────────────────────────────────────
 * Used during Instagram import to extract meaningful style & location
 * tags from captions, filtering out generic/spam hashtags.
 */

// ── Style tags allowlist ──────────────────────────────────────────────
// Normalized (lowercase, no spaces). Matched against hashtags.
export const STYLE_TAGS = new Set([
  // Core styles
  "realism", "portrait", "blackandgrey", "blackandgray", "fineline",
  "traditional", "neotraditional", "neotrad", "japanese", "irezumi",
  "illustrative", "watercolor", "watercolour", "dotwork", "geometric",
  "tribal", "chicano", "lettering", "script", "calligraphy",
  "biomechanical", "biomech", "surrealism", "surreal",
  "botanical", "floral", "mandala", "minimalist", "minimalism",
  "anime", "newschool", "oldschool", "blackwork",
  "trashpolka", "ornamental", "abstract", "linework", "whipshading",
  "handpoke", "stickandpoke", "coverup", "sleeve", "halfsleeve",
  "colour", "color", "feminine", "darkart", "gothic", "skulls",
  "petportrait", "petportraits", "wildlife", "hyperrealism", "photorealism",
  "sacredgeometry", "polynesian", "maori", "celtic", "custom",
  // Subject matter
  "dragon", "koi", "hannya", "skull", "rose", "peony", "snake",
  "butterfly", "eagle", "wolf", "lion", "tiger", "phoenix",
  "samurai", "geisha", "demon", "angel", "cross", "dagger",
  "anchor", "compass", "clock", "eye", "heart", "moon", "sun",
  // Technique / descriptors
  "dainty", "delicate", "bold", "vibrant", "detailed", "intricate",
  "freehand", "custom", "unique", "artistic", "creative",
  "realistic", "lifelike", "painterly", "sketchy", "engraving",
  "etching", "woodcut", "stipple", "stippling",
  // Pop culture
  "popculture", "gaming", "gamer", "nerd", "geek",
  // Body placement (useful for filtering)
  "sleepetattoo", "backtattoo", "chesttattoo", "armtattoo",
  "legtattoo", "handtattoo", "necktattoo", "fingertattoo",
]);

// ── Spam / generic blocklist ──────────────────────────────────────────
// These are never included even if they pass other checks.
export const SPAM_TAGS = new Set([
  // Generic tattoo tags
  "tattoo", "tattoos", "tattooartist", "tattooed", "tattooing",
  "tattooer", "tattooist", "tattoodesign", "tattooideas",
  "tattoolife", "tattoolove", "tattooart", "tattoosofinstagram",
  "tattooflash", "tattoostyle", "tattooshop", "tattoostudio",
  "tattoomodel", "tattoocommunity", "tattooworld", "tattooculture",
  "tattoooftheday", "tattoodaily", "tattoosociety",
  // Generic social / engagement bait
  "ink", "inked", "inkedup", "inkedgirls", "inkedboys", "inkedlife",
  "bodyart", "skin", "art", "artist", "artwork", "drawing",
  "follow", "like", "instagood", "photooftheday", "love",
  "beautiful", "picoftheday", "happy", "instadaily", "fashion",
  "style", "beauty", "photography", "photo", "instagram",
  "explore", "explorepage", "fyp", "viral", "trending",
  // Generic profession
  "tattooapprentice", "apprentice", "apprenticetattoo",
]);

/**
 * Normalize a hashtag for matching:
 * - lowercase
 * - strip common suffixes like "tattoo", "tattoos", "tattooist" for location detection
 */
function normalize(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Check if a tag looks like a location (city/suburb) with "tattoo" suffix.
 * e.g. "brisbanetattoo" → "brisbane", "melbournetattoos" → "melbourne"
 */
function extractLocationFromTattooTag(tag: string): string | null {
  const normalized = normalize(tag);
  const suffixes = ["tattoos", "tattooist", "tattooartist", "tattooer", "tattooing", "tattoo"];
  for (const suffix of suffixes) {
    if (normalized.endsWith(suffix) && normalized.length > suffix.length + 2) {
      const location = normalized.slice(0, -suffix.length);
      // Must be at least 3 chars to be a plausible location
      if (location.length >= 3 && !SPAM_TAGS.has(location) && !STYLE_TAGS.has(location)) {
        return location;
      }
    }
  }
  return null;
}

export interface ExtractedTags {
  styleTags: string[];
  locationTags: string[];
}

/**
 * Extract meaningful tags from an Instagram caption.
 * Returns deduplicated style and location tags.
 */
export function extractSmartTags(caption: string | null | undefined): ExtractedTags {
  if (!caption) return { styleTags: [], locationTags: [] };

  // 1. Extract all #hashtags
  const hashtagMatches = caption.match(/#([a-zA-Z0-9_]+)/g);
  if (!hashtagMatches) return { styleTags: [], locationTags: [] };

  const hashtags = hashtagMatches.map(h => h.slice(1)); // remove #

  const styleTags = new Set<string>();
  const locationTags = new Set<string>();

  for (const tag of hashtags) {
    const normalized = normalize(tag);

    // Skip spam/generic
    if (SPAM_TAGS.has(normalized)) continue;

    // Check style allowlist
    if (STYLE_TAGS.has(normalized)) {
      styleTags.add(normalized);
      continue;
    }

    // Check for location+tattoo pattern (e.g. #brisbanetattoo → brisbane)
    const locationFromTattoo = extractLocationFromTattooTag(tag);
    if (locationFromTattoo) {
      locationTags.add(locationFromTattoo);
      continue;
    }

    // Remaining non-spam, non-style tags → treat as potential location/context
    // Only include if it's reasonable length and not just numbers
    if (normalized.length >= 3 && normalized.length <= 30 && /[a-z]/.test(normalized)) {
      locationTags.add(normalized);
    }
  }

  return {
    styleTags: Array.from(styleTags).slice(0, 10),   // cap at 10
    locationTags: Array.from(locationTags).slice(0, 5), // cap at 5
  };
}
