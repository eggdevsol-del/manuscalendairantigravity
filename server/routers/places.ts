import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

/**
 * Server-side proxy for Google Places Autocomplete.
 * The API key NEVER leaves the backend — the frontend only receives results.
 */
export const placesRouter = router({
    autocomplete: protectedProcedure
        .input(
            z.object({
                query: z.string().min(1).max(256),
                types: z.string().optional().default("(cities)"),
            })
        )
        .query(async ({ input }) => {
            const apiKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!apiKey) {
                console.error("[Places Proxy] GOOGLE_MAPS_API_KEY is not set in the server environment.");
                return { predictions: [] };
            }

            const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
            url.searchParams.set("input", input.query);
            url.searchParams.set("types", input.types);
            url.searchParams.set("key", apiKey);

            const res = await fetch(url.toString());
            const data = await res.json();

            if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
                console.error("[Places Proxy] Google API error:", data.status, data.error_message);
                return { predictions: [] };
            }

            return {
                predictions: (data.predictions || []).map((p: any) => ({
                    placeId: p.place_id,
                    description: p.description,
                    mainText: p.structured_formatting?.main_text || "",
                    secondaryText: p.structured_formatting?.secondary_text || "",
                    types: p.types || [],
                })),
            };
        }),

    getPlaceDetails: protectedProcedure
        .input(z.object({ placeId: z.string() }))
        .query(async ({ input }) => {
            const apiKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!apiKey) {
                return { result: null };
            }

            const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
            url.searchParams.set("place_id", input.placeId);
            url.searchParams.set("fields", "name,address_components,formatted_address,geometry");
            url.searchParams.set("key", apiKey);

            const res = await fetch(url.toString());
            const data = await res.json();

            if (data.status !== "OK") {
                console.error("[Places Proxy] Details error:", data.status);
                return { result: null };
            }

            const r = data.result;
            const countryComponent = r.address_components?.find((c: any) =>
                c.types.includes("country")
            );
            const cityComponent = r.address_components?.find((c: any) =>
                c.types.includes("locality") || c.types.includes("administrative_area_level_1")
            );

            return {
                result: {
                    name: r.name,
                    formattedAddress: r.formatted_address,
                    country: countryComponent?.long_name || "",
                    city: cityComponent?.long_name || r.name || "",
                    lat: r.geometry?.location?.lat,
                    lng: r.geometry?.location?.lng,
                },
            };
        }),
});
