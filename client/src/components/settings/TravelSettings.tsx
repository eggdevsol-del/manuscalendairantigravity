import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Input, Label, Card, CardContent } from "@/components/ui";
import { ChevronLeft, Plus, Trash, Plane, MapPin, CalendarDays, Loader2, Navigation } from "lucide-react";
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

    const handleSave = async (updatedTrips: Trip[], promptRouting = true) => {
        try {
            await upsert.mutateAsync({ travelDates: JSON.stringify(updatedTrips) });
            toast.success("Travel calendar updated globally");
            refetch();
            if (promptRouting && onNavigateToClients) {
                toast("Notify your clients in this region?", {
                    action: {
                        label: "Blast Segment",
                        onClick: () => onNavigateToClients()
                    },
                    duration: 8000
                });
            }
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
        handleSave(updated, true);
    };

    const removeTrip = (id: string) => {
        const updated = trips.filter(t => t.id !== id);
        setTrips(updated);
        handleSave(updated, false);
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
                        <Card className="border-primary/20 bg-primary/5 animate-in slide-in-from-top-2 duration-200">
                            <CardContent className="pt-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Destination Search</Label>
                                        <div className="relative">
                                            <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
                                            <GooglePlacesInput
                                                className="pl-9 h-9"
                                                placeholder="e.g. London, UK"
                                                onPlaceSelected={(place) => {
                                                    // Extract country and specific location from Google Places Payload
                                                    let extractedCountry = "";
                                                    let extractedLocation = place.name || "";

                                                    if (place.address_components) {
                                                        const countryComponent = place.address_components.find(
                                                            (c: any) => c.types.includes("country")
                                                        );
                                                        if (countryComponent) {
                                                            extractedCountry = countryComponent.long_name;
                                                        }

                                                        // Ensure location string doesn't duplicate country
                                                        if (!extractedLocation && place.formatted_address) {
                                                            extractedLocation = place.formatted_address.replace(`, ${extractedCountry}`, '');
                                                        }
                                                    }

                                                    setNewTrip({
                                                        ...newTrip,
                                                        location: extractedLocation,
                                                        country: extractedCountry || place.formatted_address
                                                    });
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Verified Details</Label>
                                        <div className="flex gap-2">
                                            <Input className="h-9 flex-1 text-xs" placeholder="City/Region" readOnly value={newTrip.location} />
                                            <Input className="h-9 flex-1 text-xs" placeholder="Country" readOnly value={newTrip.country} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Arrival Date</Label>
                                        <div className="relative">
                                            <CalendarDays className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            <Input className="pl-9 h-9 text-sm" type="date" value={newTrip.startDate} onChange={e => setNewTrip({ ...newTrip, startDate: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Departure Date</Label>
                                        <div className="relative">
                                            <CalendarDays className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            <Input className="pl-9 h-9 text-sm" type="date" value={newTrip.endDate} onChange={e => setNewTrip({ ...newTrip, endDate: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Button className="flex-1" onClick={addTrip} disabled={upsert.isPending}>
                                        {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Leg"}
                                    </Button>
                                    <Button variant="outline" className="flex-1" onClick={() => setIsAdding(false)}>
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
                            <div key={trip.id} className="bg-white/5 border border-white/5 p-4 rounded-[4px] flex items-center justify-between hover:bg-white/10 transition-colors">
                                <div className="flex flex-col">
                                    <h5 className="font-semibold text-base flex items-center">
                                        <MapPin className="w-4 h-4 mr-2 text-primary" />
                                        {trip.location}, {trip.country}
                                    </h5>
                                    <span className="text-sm text-muted-foreground mt-1 ml-6 font-mono">
                                        {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                                    </span>
                                </div>
                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-destructive/20 hover:text-destructive shrink-0" onClick={() => removeTrip(trip.id)}>
                                    <Trash className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
}
