import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    User,
    Phone,
    DollarSign,
    Calendar,
    Clock,
    Loader2,
    CheckCircle2,
    AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";
import { trpc } from "@/lib/trpc";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface EditBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: any;
    client?: any; // To get the client's current phone/name
    onSuccess: () => void;
}

type TabKey = "contact" | "cost" | "reschedule";

export function EditBookingModal({
    isOpen,
    onClose,
    appointment,
    client,
    onSuccess,
}: EditBookingModalProps) {
    const [activeTab, setActiveTab] = useState<TabKey>("contact");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Tab 1: Contact
    const [name, setName] = useState(client?.name || appointment?.clientName || "");
    const [phone, setPhone] = useState(client?.phone || "");

    // Tab 2: Service & Cost
    const { data: artistSettings } = trpc.artistSettings.getPublicByArtistId.useQuery(
        { artistId: appointment?.artistId || "" },
        { enabled: !!appointment?.artistId }
    );
    const effectiveServices = artistSettings?.services
        ? (typeof artistSettings.services === "string" ? JSON.parse(artistSettings.services) : artistSettings.services)
        : [];

    const [serviceName, setServiceName] = useState<string>(appointment?.serviceName || "");
    const [newServiceName, setNewServiceName] = useState("");
    const [newServiceDuration, setNewServiceDuration] = useState("60");
    const [price, setPrice] = useState<string>(
        appointment?.price !== undefined && appointment?.price !== null
            ? String(appointment.price)
            : ""
    );
    const [applyToAll, setApplyToAll] = useState(false);

    // Tab 3: Reschedule
    // Parse existing local/UTC appropriately. Assuming appointment.startTime is local string from DB.
    const initialDateStr = appointment?.startTime
        ? format(new Date(appointment.startTime), "yyyy-MM-dd")
        : "";
    const initialTimeStr = appointment?.startTime
        ? format(new Date(appointment.startTime), "HH:mm")
        : "";

    const [dateStr, setDateStr] = useState(initialDateStr);
    const [timeStr, setTimeStr] = useState(initialTimeStr);

    const utils = trpc.useUtils();

    // Mutations
    const updateProfileMutation = trpc.clientProfile.updateClientProfile.useMutation();
    const updateApptMutation = trpc.appointments.update.useMutation();
    const batchUpdatePricesMutation = trpc.appointments.batchUpdateClientPrices.useMutation();
    const saveArtistSettings = trpc.artistSettings.upsert.useMutation();

    if (!isOpen || !appointment) return null;

    const card = tokens.card;

    const handleSaveContact = async () => {
        if (!client?.id) {
            toast.error("Cannot update contact: No global client profile linked.");
            return;
        }
        setIsSubmitting(true);
        try {
            await updateProfileMutation.mutateAsync({
                clientId: client.id,
                name: name,
                phone: phone,
            });
            toast.success("Contact details updated");
            utils.appointments.invalidate();
            onSuccess();
        } catch (e: any) {
            toast.error(e.message || "Failed to update contact");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveCost = async () => {
        setIsSubmitting(true);
        try {
            const parsedPrice = parseFloat(price);
            if (isNaN(parsedPrice)) throw new Error("Invalid price");

            let finalServiceName = serviceName;

            // Handle New Service Creation inline
            if (serviceName === "__NEW__") {
                if (!newServiceName.trim()) throw new Error("Please provide a name for the new service");

                const durationNum = parseInt(newServiceDuration) || 60;

                // Construct new service object
                const newServiceEntry = {
                    id: crypto.randomUUID(),
                    name: newServiceName.trim(),
                    duration: durationNum,
                    price: parsedPrice,
                    color: "#9333ea"
                };

                // Append to existing services
                const updatedServices = [...effectiveServices, newServiceEntry];

                // Strip nulls from artistSettings to satisfy Zod .optional() rules
                const sanitizedSettings = Object.fromEntries(
                    Object.entries(artistSettings || {}).filter(([_, v]) => v !== null)
                );

                await saveArtistSettings.mutateAsync({
                    ...(sanitizedSettings as any),
                    services: JSON.stringify(updatedServices),
                    workSchedule: sanitizedSettings.workSchedule ? JSON.stringify(sanitizedSettings.workSchedule) : "{}"
                });

                finalServiceName = newServiceEntry.name;
                toast.success("New service created and saved globally.");
                utils.artistSettings.invalidate();
            }

            // ALWAYS update the specific appointment regardless of applyToAll
            await updateApptMutation.mutateAsync({
                id: appointment.id,
                price: parsedPrice,
                serviceName: finalServiceName !== "" ? finalServiceName : undefined
            });

            // OPTIONALLY cascade to future ones
            if (applyToAll && appointment.clientId) {
                await batchUpdatePricesMutation.mutateAsync({
                    clientId: appointment.clientId,
                    artistId: appointment.artistId,
                    price: parsedPrice,
                    serviceName: finalServiceName !== "" ? finalServiceName : undefined
                });
                toast.success("Service/Price updated for this and all upcoming bookings");
            } else {
                toast.success("Service/Price updated");
            }

            utils.appointments.invalidate();
            onSuccess();
        } catch (e: any) {
            toast.error(e.message || "Failed to update cost");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveReschedule = async () => {
        if (!dateStr || !timeStr) {
            toast.error("Please select a valid date and time");
            return;
        }
        setIsSubmitting(true);
        try {
            // Reconstruct start time
            const newStartTimeStr = `${dateStr}T${timeStr}`;

            // Calculate original duration to inherit the end time shift
            const oldStart = new Date(appointment.startTime).getTime();
            const oldEnd = appointment.endTime ? new Date(appointment.endTime).getTime() : oldStart + (60 * 60 * 1000);
            const durationMs = oldEnd - oldStart;

            const newStartObj = new Date(newStartTimeStr);
            const newEndObj = new Date(newStartObj.getTime() + durationMs);

            // We pass the local ISO strings, backend parses and handles overlapping UTC checks
            await updateApptMutation.mutateAsync({
                id: appointment.id,
                startTime: format(newStartObj, "yyyy-MM-dd HH:mm:ss"), // sending roughly similar to what the importer sends
                endTime: format(newEndObj, "yyyy-MM-dd HH:mm:ss"),
            });

            toast.success("Booking rescheduled");
            utils.appointments.invalidate();
            onSuccess();
        } catch (e: any) {
            toast.error(e.message || "Failed to reschedule booking. Check for conflicts.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderContactTab = () => (
        <div className="space-y-4 pt-2">
            <div className="space-y-3">
                <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">Name</span>
                    <div className={cn(card.base, card.bg, "flex items-center gap-2 px-3 py-2.5 rounded-[4px] border-white/5")}>
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-transparent border-none outline-none text-[11px] text-foreground w-full font-medium"
                            placeholder="Client Name"
                        />
                    </div>
                </label>

                <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">Phone Number</span>
                    <div className={cn(card.base, card.bg, "flex items-center gap-2 px-3 py-2.5 rounded-[4px] border-white/5")}>
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="bg-transparent border-none outline-none text-[11px] text-foreground w-full font-medium"
                            placeholder="+1 234 567 8900"
                        />
                    </div>
                </label>

                <div className="flex items-start gap-2 px-3 py-2 bg-zinc-500/10 rounded-[4px]">
                    <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-[9px] text-muted-foreground leading-tight">
                        Email addresses are strictly read-only to prevent broken logins and authentication mismatches.
                    </p>
                </div>
            </div>

            <button
                onClick={handleSaveContact}
                disabled={isSubmitting || !name}
                className="w-full py-3 rounded-[4px] bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center pt-4" // pt-4 to push it down visually
            >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Details"}
            </button>
        </div>
    );

    const renderCostTab = () => (
        <div className="space-y-4 pt-2">
            <div className="space-y-3">
                <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">Service</span>
                    <div className={cn(card.base, card.bg, "flex items-center gap-2 px-3 py-2.5 rounded-[4px] border-white/5")}>
                        <select
                            value={serviceName}
                            onChange={(e) => {
                                setServiceName(e.target.value);
                                if (e.target.value === "__NEW__") {
                                    setPrice("");
                                } else {
                                    const mappedService = effectiveServices.find((s: any) => s.name === e.target.value);
                                    if (mappedService) setPrice(String(mappedService.price));
                                }
                            }}
                            className="bg-transparent border-none outline-none text-[11px] text-foreground w-full font-medium"
                        >
                            <option value="">-- No Service Mapped --</option>
                            {effectiveServices.map((s: any) => (
                                <option key={s.id} value={s.name}>
                                    {s.name} ({s.duration}m)
                                </option>
                            ))}
                            <option value="__NEW__">+ Create New Service</option>
                        </select>
                    </div>
                </label>

                <AnimatePresence>
                    {serviceName === "__NEW__" && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-3 overflow-hidden"
                        >
                            <div className="grid grid-cols-2 gap-3">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">New Name</span>
                                    <input
                                        type="text"
                                        value={newServiceName}
                                        onChange={(e) => setNewServiceName(e.target.value)}
                                        className={cn(card.base, card.bg, "px-3 py-2.5 rounded-[4px] border-white/5 text-[11px] text-foreground font-medium")}
                                        placeholder="e.g. Touch Up"
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">Duration (m)</span>
                                    <input
                                        type="number"
                                        value={newServiceDuration}
                                        onChange={(e) => setNewServiceDuration(e.target.value)}
                                        className={cn(card.base, card.bg, "px-3 py-2.5 rounded-[4px] border-white/5 text-[11px] text-foreground font-medium")}
                                        placeholder="60"
                                    />
                                </label>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <label className="flex flex-col gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">Price per Session</span>
                    <div className={cn(card.base, card.bg, "flex items-center gap-2 px-3 py-2.5 rounded-[4px] border-white/5 focus-within:border-primary/50 transition-colors")}>
                        <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            className="bg-transparent border-none outline-none text-[11px] text-foreground w-full font-medium"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                        />
                    </div>
                </label>

                <label className={cn(
                    card.base,
                    "flex items-center gap-3 p-3 rounded-[4px] cursor-pointer active:scale-[0.98] transition-all border border-transparent mt-2",
                    applyToAll ? "bg-primary/10 border-primary/20" : card.bg
                )}>
                    <div className={cn(
                        "w-4 h-4 rounded-[2px] border flex items-center justify-center transition-colors shrink-0",
                        applyToAll ? "bg-primary border-primary text-primary-foreground" : "border-white/20 bg-black/20"
                    )}>
                        {applyToAll && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-foreground">Apply to all upcoming</p>
                        <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                            Update the service and cost for this and any future bookings for this client.
                        </p>
                    </div>
                </label>
            </div>

            <button
                onClick={handleSaveCost}
                disabled={isSubmitting || price === "" || (serviceName === "__NEW__" && !newServiceName)}
                className="w-full py-3 rounded-[4px] bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
            >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Updates"}
            </button>
        </div>
    );

    const renderRescheduleTab = () => (
        <div className="space-y-4 pt-2">
            <div className="space-y-3">
                <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">New Date</span>
                    <div className={cn(card.base, card.bg, "flex items-center gap-2 px-3 py-2.5 rounded-[4px] border-white/5")}>
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            type="date"
                            value={dateStr}
                            onChange={(e) => setDateStr(e.target.value)}
                            className="bg-transparent border-none outline-none text-[11px] text-foreground w-full font-medium"
                            style={{ colorScheme: "dark" }}
                        />
                    </div>
                </label>

                <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">Start Time</span>
                    <div className={cn(card.base, card.bg, "flex items-center gap-2 px-3 py-2.5 rounded-[4px] border-white/5")}>
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            type="time"
                            value={timeStr}
                            onChange={(e) => setTimeStr(e.target.value)}
                            className="bg-transparent border-none outline-none text-[11px] text-foreground w-full font-medium"
                            style={{ colorScheme: "dark" }}
                        />
                    </div>
                </label>
            </div>

            <button
                onClick={handleSaveReschedule}
                disabled={isSubmitting || !dateStr || !timeStr}
                className="w-full py-3 rounded-[4px] bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
            >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Reschedule"}
            </button>
        </div>
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[990]"
                    />
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/50 rounded-t-2xl z-[991] max-h-[90vh] flex flex-col pt-3 pb-8 px-4"
                    >
                        {/* Minimal Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/70">
                                    Editing Project
                                </p>
                                <h2 className="text-sm font-bold text-foreground">
                                    {appointment.title || "Booking"}
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Tab Navigation */}
                        <div className="flex gap-2 mb-4 p-1 bg-white/5 rounded-[4px]">
                            {(["contact", "cost", "reschedule"] as TabKey[]).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={cn(
                                        "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-[2px] transition-all",
                                        activeTab === tab
                                            ? "bg-white/10 text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                    )}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto no-scrollbar pb-env-safe">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    {activeTab === "contact" && renderContactTab()}
                                    {activeTab === "cost" && renderCostTab()}
                                    {activeTab === "reschedule" && renderRescheduleTab()}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
