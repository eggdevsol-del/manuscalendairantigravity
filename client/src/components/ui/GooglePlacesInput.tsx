import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Search, MapPin, Loader2 } from 'lucide-react';

interface PlacePrediction {
    placeId: string;
    description: string;
    mainText: string;
    secondaryText: string;
}

interface GooglePlacesInputProps {
    onPlaceSelected: (place: {
        name: string;
        formatted_address: string;
        address_components: { long_name: string; types: string[] }[];
        lat?: number;
        lng?: number;
    }) => void;
    placeholder?: string;
    className?: string;
    defaultValue?: string;
    types?: string[];
}

export const GooglePlacesInput = React.forwardRef<HTMLInputElement, GooglePlacesInputProps>(
    ({ onPlaceSelected, placeholder = "Search location...", className, defaultValue, types = ['(cities)'] }, ref) => {
        const [query, setQuery] = useState(defaultValue || "");
        const [showDropdown, setShowDropdown] = useState(false);
        const [selectedIndex, setSelectedIndex] = useState(-1);
        const debounceRef = useRef<NodeJS.Timeout | null>(null);
        const containerRef = useRef<HTMLDivElement>(null);

        // Debounced query value for the API call
        const [debouncedQuery, setDebouncedQuery] = useState("");

        const { data: autocompleteData, isFetching } = trpc.places.autocomplete.useQuery(
            { query: debouncedQuery, types: types[0] || "(cities)" },
            {
                enabled: debouncedQuery.length >= 2,
                staleTime: 30_000,
                refetchOnWindowFocus: false,
                retry: false,
            }
        );

        const predictions: PlacePrediction[] = autocompleteData?.predictions || [];

        // Handle input change with debounce
        const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            setQuery(value);
            setSelectedIndex(-1);

            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                setDebouncedQuery(value);
                if (value.length >= 2) setShowDropdown(true);
            }, 300);
        }, []);

        // Fetch place details when user selects a prediction
        const utils = trpc.useUtils();

        const handleSelect = useCallback(async (prediction: PlacePrediction) => {
            setQuery(prediction.description);
            setShowDropdown(false);

            // Fetch full place details from the backend proxy
            const details = await utils.places.getPlaceDetails.fetch({
                placeId: prediction.placeId,
            });

            if (details?.result) {
                // Build a compatible object for the existing onPlaceSelected callback
                const addressComponents: { long_name: string; types: string[] }[] = [];

                if (details.result.country) {
                    addressComponents.push({ long_name: details.result.country, types: ["country"] });
                }
                if (details.result.city) {
                    addressComponents.push({ long_name: details.result.city, types: ["locality"] });
                }

                onPlaceSelected({
                    name: details.result.name || prediction.mainText,
                    formatted_address: details.result.formattedAddress || prediction.description,
                    address_components: addressComponents,
                    lat: details.result.lat,
                    lng: details.result.lng,
                });
            }
        }, [onPlaceSelected, utils]);

        // Keyboard navigation
        const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
            if (!showDropdown || predictions.length === 0) return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, predictions.length - 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === "Enter" && selectedIndex >= 0) {
                e.preventDefault();
                handleSelect(predictions[selectedIndex]);
            } else if (e.key === "Escape") {
                setShowDropdown(false);
            }
        }, [showDropdown, predictions, selectedIndex, handleSelect]);

        // Close dropdown on outside click
        useEffect(() => {
            const handleClickOutside = (e: MouseEvent) => {
                if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                    setShowDropdown(false);
                }
            };
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }, []);

        return (
            <div ref={containerRef} className="relative w-full">
                <input
                    ref={ref}
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (predictions.length > 0 && query.length >= 2) setShowDropdown(true);
                    }}
                    placeholder={placeholder}
                    autoComplete="off"
                    className={cn(
                        "flex h-9 w-full rounded-[4px] border border-white/10 bg-white/5 px-3 py-1 text-sm shadow-sm transition-colors",
                        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
                        className
                    )}
                />

                {isFetching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    </div>
                )}

                {showDropdown && predictions.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-card border border-white/10 rounded-[4px] shadow-xl max-h-[200px] overflow-y-auto">
                        {predictions.map((p, i) => (
                            <button
                                key={p.placeId}
                                type="button"
                                className={cn(
                                    "w-full text-left px-3 py-2.5 text-sm flex items-start gap-2 transition-colors",
                                    i === selectedIndex
                                        ? "bg-primary/15 text-foreground"
                                        : "hover:bg-white/5 text-foreground"
                                )}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelect(p);
                                }}
                                onMouseEnter={() => setSelectedIndex(i)}
                            >
                                <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                                <div className="flex flex-col min-w-0">
                                    <span className="font-medium truncate">{p.mainText}</span>
                                    <span className="text-xs text-muted-foreground truncate">{p.secondaryText}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }
);

GooglePlacesInput.displayName = "GooglePlacesInput";
