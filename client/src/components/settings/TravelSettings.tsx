import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Input, Label, Card, CardContent } from "@/components/ui";
import { ChevronLeft, Plus, Trash, Plane, MapPin, CalendarDays, Loader2, Navigation, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/ssot";
import { GooglePlacesInput } from "@/components/ui/GooglePlacesInput";
import { cn } from "@/lib/utils";

interface Trip {
    id: string;
    location: string;
    country: string;
    startDate: string;
    endDate: string;
    lat?: number;
    lng?: number;
}

/** Individual trip card with map background */
function TripCard({ trip, onRemove }: { trip: Trip; onRemove: () => void }) {
    const [mapLoaded, setMapLoaded] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [matchCount, setMatchCount] = useState<number | null>(null);

    // For trips without lat/lng, geocode from city name
    const geocodeQuery = trpc.places.geocode.useQuery(
        { address: `${trip.location}, ${trip.country}` },
        {
            enabled: !trip.lat && !trip.lng,
            staleTime: Infinity,
            refetchOnWindowFocus: false,
        }
    );

    const lat = trip.lat ?? geocodeQuery.data?.lat;
    const lng = trip.lng ?? geocodeQuery.data?.lng;

    // Build the direct image URL — bypasses tRPC entirely
    const mapSrc = lat && lng
        ? `/api/map-image?lat=${lat}&lng=${lng}&w=600&h=300&z=11`
        : null;

    // Lazy query for client location matching
    const matchQuery = trpc.artistSettings.matchClientsByLocation.useQuery(
        { city: trip.location, country: trip.country },
        { enabled: scanning, staleTime: 0, refetchOnWindowFocus: false }
    );

    useEffect(() => {
        if (matchQuery.data && scanning) {
            setScanning(false);
            setMatchCount(matchQuery.data.total);
            if (matchQuery.data.total > 0) {
                toast.success(
                    `Found ${matchQuery.data.total} client${matchQuery.data.total > 1 ? 's' : ''} near ${trip.location}!`,
                    { description: matchQuery.data.clients.map((c: any) => c.name || c.email).join(', ') }
                );
            } else {
                toast.info(`No clients found near ${trip.location}`);
            }
        }
    }, [matchQuery.data, scanning]);

    const handleNotify = () => {
        setScanning(true);
        setMatchCount(null);
    };

    return (
        <div className="relative rounded-lg overflow-hidden border border-white/10 hover:border-white/20 transition-colors">
            {/* Full satellite map background — 100% opacity */}
            {mapSrc && (
                <img
                    src={mapSrc}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-700"
                    style={{ opacity: mapLoaded ? 1 : 0 }}
                    draggable={false}
                    onLoad={() => setMapLoaded(true)}
                />
            )}

            {/* Gradient overlay — keeps text readable on the right */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: "linear-gradient(to right, rgba(10,10,25,0.25) 0%, rgba(10,10,25,0.6) 40%, rgba(10,10,25,0.85) 100%)",
                }}
            />

            {/* Bottom vignette for button area */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: "linear-gradient(to top, rgba(10,10,25,0.7) 0%, transparent 40%)",
                }}
            />

            {/* Card content */}
            <div className="relative z-10 p-4 flex flex-col gap-3">
                {/* Top row: location + delete */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <h5 className="font-semibold text-base flex items-center text-white drop-shadow-md">
                            <MapPin className="w-4 h-4 mr-2 text-primary" />
                            {trip.location}, {trip.country}
                        </h5>
                        <span className="text-sm text-white/70 mt-1 ml-6 font-mono drop-shadow-sm">
                            {new Date(trip.startDate).toLocaleDateString()} – {new Date(trip.endDate).toLocaleDateString()}
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white/60 hover:bg-destructive/20 hover:text-destructive shrink-0"
                        onClick={onRemove}
                    >
                        <Trash className="w-4 h-4" />
                    </Button>
                </div>

                {/* Per-card Notify Clients */}
                <Button
                    onClick={handleNotify}
                    disabled={scanning || matchQuery.isLoading}
                    className="w-full h-10 text-sm font-semibold bg-gradient-to-r from-primary/90 to-accent/80 hover:from-primary hover:to-accent backdrop-blur-sm"
                >
                    {scanning || matchQuery.isLoading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning Clients...</>
                    ) : matchCount !== null ? (
                        <><Users className="w-4 h-4 mr-2" /> {matchCount} Client{matchCount !== 1 ? 's' : ''} Found — Notify</>
                    ) : (
                        <><Send className="w-4 h-4 mr-2" /> Notify Clients</>
                    )}
                </Button>
            </div>
        </div>
    );
}

export function TravelSettings({ onBack, onNavigateToClients }: { onBack: () => void, onNavigateToClients?: () => void }) {
    const { data: settings, isLoading, refetch } = trpc.artistSettings.get.useQuery();
    const upsert = trpc.artistSettings.upsert.useMutation();

    const [trips, setTrips] = useState<Trip[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newTrip, setNewTrip] = useState<Trip>({ id: "", location: "", country: "", startDate: "", endDate: "" });

    useEffect(() => {
        if (settings?.travelDates) {
            try {
                setTrips(JSON.parse(settings.travelDates));
            } catch (e) {
                setTrips([]);
            }
        }
    }, [settings?.travelDates]);

    const handleSave = async (updatedTrips: Trip[]) => {
        try {
            await upsert.mutateAsync({ travelDates: JSON.stringify(updatedTrips) });
            toast.success("Travel calendar updated globally");
            refetch();
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const addTrip = () => {
        if (!newTrip.location || !newTrip.country || !newTrip.startDate || !newTrip.endDate) {
            return toast.error("All trip parameters are required.");
        }
        const nt = { ...newTrip, id: Math.random().toString(36).substr(2, 9) };
        const updated = [...trips, nt].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        setTrips(updated);
        setIsAdding(false);
        setNewTrip({ id: "", location: "", country: "", startDate: "", endDate: "" });
        handleSave(updated);
    };

    const removeTrip = (id: string) => {
        const updated = trips.filter(t => t.id !== id);
        setTrips(updated);
        handleSave(updated);
    };

    if (isLoading) return <LoadingState fullScreen message="Loading travel manifest..." />;

    return (
        <div className="w-full h-full flex flex-col overflow-hidden relative">
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-white/5">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                </button>
                <h2 className="text-xl font-semibold text-foreground flex items-center">
                    <Plane className="w-5 h-5 mr-3 text-primary" />
                    Travel Dates
                </h2>
            </div>

            <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
                <div className="pb-[180px] max-w-lg mx-auto space-y-6 px-4 pt-6">

                    <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-[4px] p-6 text-center border border-white/5">
                        <Plane className="w-8 h-8 text-primary mx-auto mb-3 opacity-90" />
                        <h3 className="text-lg font-bold text-foreground mb-1">Artist on the Move</h3>
                        <p className="text-sm text-muted-foreground">Block out your international or inter-state travels, alert local clients actively, and manage waitlists effectively.</p>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Upcoming Itinerary</h4>
                        {!isAdding && (
                            <Button size="sm" onClick={() => setIsAdding(true)} className="h-8">
                                <Plus className="w-4 h-4 mr-2" /> Schedule Trip
                            </Button>
                        )}
                    </div>

                    {isAdding && (
                        <Card className="border-primary/20 bg-primary/5 animate-in slide-in-from-top-2 duration-200 overflow-visible">
                            <CardContent className="pt-6 space-y-5">

                                {/* Step 1: Destination */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">1</span>
                                        Where are you going?
                                    </Label>
                                    <div className="relative">
                                        <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
                                        <GooglePlacesInput
                                            className="pl-9 h-10"
                                            placeholder="Search a city, e.g. London, Tokyo, Auckland..."
                                            onPlaceSelected={(place) => {
                                                let extractedCountry = "";
                                                let extractedLocation = place.name || "";

                                                if (place.address_components) {
                                                    const countryComponent = place.address_components.find(
                                                        (c: any) => c.types.includes("country")
                                                    );
                                                    if (countryComponent) {
                                                        extractedCountry = countryComponent.long_name;
                                                    }
                                                    if (!extractedLocation && place.formatted_address) {
                                                        extractedLocation = place.formatted_address.replace(`, ${extractedCountry}`, '');
                                                    }
                                                }

                                                setNewTrip({
                                                    ...newTrip,
                                                    location: extractedLocation,
                                                    country: extractedCountry || place.formatted_address,
                                                    lat: place.lat,
                                                    lng: place.lng,
                                                });
                                            }}
                                        />
                                    </div>

                                    {/* Confirmed destination pill */}
                                    {newTrip.location && newTrip.country && (
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-[4px] bg-primary/10 border border-primary/20 text-sm">
                                            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                                            <span className="font-medium text-foreground">{newTrip.location}</span>
                                            <span className="text-muted-foreground">•</span>
                                            <span className="text-muted-foreground">{newTrip.country}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="border-t border-white/5" />

                                {/* Step 2: Travel Dates */}
                                <div className="space-y-3">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">2</span>
                                        When are you travelling?
                                    </Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] text-muted-foreground">Arriving</Label>
                                            <div className="relative">
                                                <CalendarDays className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    className="pl-9 h-10 text-sm"
                                                    type="date"
                                                    value={newTrip.startDate}
                                                    onChange={e => setNewTrip({ ...newTrip, startDate: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] text-muted-foreground">Departing</Label>
                                            <div className="relative">
                                                <CalendarDays className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    className="pl-9 h-10 text-sm"
                                                    type="date"
                                                    value={newTrip.endDate}
                                                    onChange={e => setNewTrip({ ...newTrip, endDate: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Duration pill */}
                                    {newTrip.startDate && newTrip.endDate && (
                                        <div className="text-xs text-muted-foreground text-center py-1">
                                            {(() => {
                                                const days = Math.ceil((new Date(newTrip.endDate).getTime() - new Date(newTrip.startDate).getTime()) / (1000 * 60 * 60 * 24));
                                                if (days <= 0) return <span className="text-destructive">Departure must be after arrival</span>;
                                                return <span>{days} day{days !== 1 ? 's' : ''} abroad</span>;
                                            })()}
                                        </div>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="border-t border-white/5" />

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <Button className="flex-1 h-10" onClick={addTrip} disabled={upsert.isPending}>
                                        {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                            <>
                                                <Plus className="w-4 h-4 mr-2" />
                                                Add to Itinerary
                                            </>
                                        )}
                                    </Button>
                                    <Button variant="outline" onClick={() => setIsAdding(false)} className="h-10 px-6">
                                        Cancel
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="space-y-3">
                        {trips.length === 0 && !isAdding && (
                            <div className="bg-white/5 border border-white/5 p-8 rounded-[4px] text-center text-muted-foreground text-sm flex flex-col items-center">
                                <Navigation className="w-8 h-8 opacity-20 mb-3" />
                                No travel legs scheduled.
                            </div>
                        )}
                        {trips.map(trip => (
                            <TripCard key={trip.id} trip={trip} onRemove={() => removeTrip(trip.id)} />
                        ))}
                    </div>


                </div>
            </div>
        </div>
    );
}
