/**
 * geocode.ts
 * Server-side geocoding using OpenStreetMap Nominatim (free, no API key).
 *
 * Used to auto-populate lat/lng when an artist saves their businessAddress.
 * Rate limit: Nominatim asks for max 1 req/sec and a valid User-Agent.
 */

/**
 * Geocode a free-text address string to { lat, lng }.
 * Returns null if the address cannot be resolved.
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: string; lng: string } | null> {
  if (!address || address.trim().length < 5) return null;

  try {
    const encoded = encodeURIComponent(address.trim());
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&addressdetails=0`;

    const res = await fetch(url, {
      headers: {
        // Nominatim requires a descriptive User-Agent identifying your app
        "User-Agent": "CalendAIr/1.0 (contact@calendair.app)",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(8000), // 8s timeout
    });

    if (!res.ok) {
      console.warn(`[Geocode] Nominatim returned ${res.status} for: ${address}`);
      return null;
    }

    const data = (await res.json()) as Array<{ lat: string; lon: string }>;

    if (!data.length) {
      console.warn(`[Geocode] No results for address: ${address}`);
      return null;
    }

    const { lat, lon } = data[0];
    console.log(`[Geocode] ✅ ${address} → ${lat}, ${lon}`);
    return { lat, lng: lon };
  } catch (err: any) {
    console.warn(`[Geocode] Failed to geocode address "${address}":`, err?.message ?? err);
    return null;
  }
}
