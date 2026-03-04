import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Input, Label, Textarea, Switch } from "@/components/ui";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Camera, RefreshCw, Calendar as CalendarIcon, Wallet as WalletIcon, Settings as SettingsIcon, Link as LinkIcon, CheckCircle2 } from "lucide-react";

interface OnboardingArtistFlowProps {
    onComplete: () => Promise<void>;
}

interface DaySchedule {
    enabled: boolean;
    start: string;
    end: string;
    type?: "work" | "design" | "personal";
}

interface WorkSchedule {
    monday: DaySchedule;
    tuesday: DaySchedule;
    wednesday: DaySchedule;
    thursday: DaySchedule;
    friday: DaySchedule;
    saturday: DaySchedule;
    sunday: DaySchedule;
}

const defaultSchedule: WorkSchedule = {
    monday: { enabled: true, start: "09:00", end: "17:00", type: "work" },
    tuesday: { enabled: true, start: "09:00", end: "17:00", type: "work" },
    wednesday: { enabled: true, start: "09:00", end: "17:00", type: "work" },
    thursday: { enabled: true, start: "09:00", end: "17:00", type: "work" },
    friday: { enabled: true, start: "09:00", end: "17:00", type: "work" },
    saturday: { enabled: false, start: "09:00", end: "17:00", type: "work" },
    sunday: { enabled: false, start: "09:00", end: "17:00", type: "work" },
};

export function OnboardingArtistFlow({ onComplete }: OnboardingArtistFlowProps) {
    const { user, refresh } = useAuth();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State - Step 1: Profile
    const [name, setName] = useState(user?.name || "");
    const [bio, setBio] = useState(user?.bio || "");
    const [phone, setPhone] = useState(user?.phone || "");
    const [avatar, setAvatar] = useState(user?.avatar || "");
    const [slug, setSlug] = useState("");

    // Step 2 & 3 state placeholders ready to connect to actual Settings endpoints
    const [depositAmount, setDepositAmount] = useState<string>("50");
    const [bsb, setBsb] = useState("");
    const [acc, setAcc] = useState("");
    const [workSchedule, setWorkSchedule] = useState<WorkSchedule>(defaultSchedule);

    // Step 3 state for Calendar Sync
    const [appleCalendarUrl, setAppleCalendarUrl] = useState("");
    const [syncStatus, setSyncStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [syncMessage, setSyncMessage] = useState("");

    const updateProfileMutation = trpc.auth.updateProfile.useMutation();
    const updateSettingsMutation = trpc.artistSettings.upsert.useMutation();
    const testCalendarUrlMutation = trpc.artistSettings.testExternalCalendarUrl.useMutation();

    const handleDayToggle = (day: keyof WorkSchedule) => {
        setWorkSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], enabled: !prev[day].enabled },
        }));
    };

    const handleTimeChange = (
        day: keyof WorkSchedule,
        field: "start" | "end",
        value: string
    ) => {
        setWorkSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], [field]: value },
        }));
    };

    const handleTypeChange = (
        day: keyof WorkSchedule,
        value: "work" | "design" | "personal"
    ) => {
        setWorkSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], type: value },
        }));
    };

    const days: Array<{ key: keyof WorkSchedule; label: string }> = [
        { key: "monday", label: "Monday" },
        { key: "tuesday", label: "Tuesday" },
        { key: "wednesday", label: "Wednesday" },
        { key: "thursday", label: "Thursday" },
        { key: "friday", label: "Friday" },
        { key: "saturday", label: "Saturday" },
        { key: "sunday", label: "Sunday" },
    ];

    const handleNext = async () => {
        if (step === 1) {
            if (!name || !slug) {
                toast.error("Please provide a name and booking link slug.");
                return;
            }
            setIsSubmitting(true);
            try {
                await updateProfileMutation.mutateAsync({
                    name,
                    phone,
                    bio,
                    avatar
                });
                await updateSettingsMutation.mutateAsync({
                    publicSlug: slug,
                    workSchedule: "{}",
                    services: "[]"
                });
                setStep(2);
            } catch (e) {
                toast.error("Failed to save profile details.");
            } finally {
                setIsSubmitting(false);
            }
        } else if (step === 2) {
            setIsSubmitting(true);
            try {
                await updateSettingsMutation.mutateAsync({
                    depositAmount: Number(depositAmount),
                    bsb,
                    accountNumber: acc,
                    workSchedule: JSON.stringify(workSchedule),
                    services: "[]"
                });
                setStep(3);
            } catch (e) {
                toast.error("Failed to save bank details.");
            } finally {
                setIsSubmitting(false);
            }
        } else if (step === 3) {
            setIsSubmitting(true);
            try {
                await updateSettingsMutation.mutateAsync({
                    appleCalendarUrl,
                    workSchedule: JSON.stringify(workSchedule),
                    services: JSON.stringify([]) // Handled later
                });
                setStep(4);
            } catch (e) {
                toast.error("Failed to save schedule.");
            } finally {
                setIsSubmitting(false);
            }
        } else if (step === 4) {
            onComplete();
        }
    };

    const handleTestUrl = async () => {
        if (!appleCalendarUrl) return;
        setSyncStatus("testing");
        try {
            const res = await testCalendarUrlMutation.mutateAsync({ url: appleCalendarUrl });
            if (res.success) {
                setSyncStatus("success");
                setSyncMessage(`${res.eventCount} events synced.`);
            } else {
                setSyncStatus("error");
                setSyncMessage(res.message);
            }
        } catch (e) {
            setSyncStatus("error");
            setSyncMessage("Invalid link format");
        }
    };

    const currentStepVariant = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
    };

    return (
        <div className="flex flex-col h-full w-full max-w-sm mx-auto p-6 relative bg-card border border-white/5 rounded-3xl shadow-2xl overflow-y-auto no-scrollbar">

            {/* Progress Indicator */}
            <div className="flex items-center gap-1.5 mb-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full \${step >= i ? 'bg-primary' : 'bg-primary/20'}`} />
                ))}
            </div>

            <div className="flex-1 relative pb-16">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="step-1"
                            variants={currentStepVariant}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="space-y-4"
                        >
                            <div className="mb-6 space-y-1">
                                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                    <SettingsIcon className="w-5 h-5 text-primary" /> Core Details
                                </h2>
                                <p className="text-sm text-muted-foreground leading-tight">
                                    Let's set up your public-facing alias and link.
                                </p>
                            </div>

                            <div className="flex justify-center mb-6">
                                <div className="w-24 h-24 rounded-full bg-accent/30 border-2 border-primary/20 flex flex-col items-center justify-center text-primary/50 cursor-pointer hover:bg-accent/50 transition-colors relative overflow-hidden group">
                                    {avatar ?
                                        <img src={avatar} alt="Avatar" className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                                        :
                                        <><Camera className="w-8 h-8 mb-1" /><span className="text-[10px] font-bold uppercase tracking-wider">Photo</span></>
                                    }
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Display Name</Label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Inky Bob"
                                    className="bg-accent/5"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Booking Link Username</Label>
                                <div className="flex rounded-md overflow-hidden bg-accent/5 focus-within:ring-2 focus-within:ring-primary/50 transition-all border border-input">
                                    <div className="px-3 py-2 bg-black/40 text-muted-foreground text-sm border-r border-input flex items-center shrink-0">
                                        calendair.com/
                                    </div>
                                    <input
                                        type="text"
                                        className="flex-1 bg-transparent px-3 text-sm outline-none w-full"
                                        value={slug}
                                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                        placeholder="username"
                                    />
                                </div>
                            </div>

                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="step-2"
                            variants={currentStepVariant}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="space-y-4"
                        >
                            <div className="mb-6 space-y-1">
                                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                    <WalletIcon className="w-5 h-5 text-primary" /> Remittances
                                </h2>
                                <p className="text-sm text-muted-foreground leading-tight">
                                    Where should your clients send you their booking deposits?
                                </p>
                            </div>

                            <div className="space-y-1.5 mt-4">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Default Deposit ($)</Label>
                                <Input
                                    type="number"
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                    placeholder="e.g. 50"
                                    className="bg-accent/5"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bank BSB</Label>
                                    <Input value={bsb} onChange={(e) => setBsb(e.target.value)} placeholder="000-000" className="bg-accent/5" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bank ACC</Label>
                                    <Input value={acc} onChange={(e) => setAcc(e.target.value)} placeholder="0001001" className="bg-accent/5" />
                                </div>
                            </div>

                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div
                            key="step-3"
                            variants={currentStepVariant}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="space-y-4"
                        >
                            <div className="mb-6 space-y-1">
                                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                    <CalendarIcon className="w-5 h-5 text-primary" /> Availability
                                </h2>
                                <p className="text-sm text-muted-foreground leading-tight">
                                    Configure your default working hours. Clients will only be able to book you during these windows.
                                </p>
                            </div>

                            <div className="space-y-4 pb-4">
                                {days.map(({ key, label }) => {
                                    const daySchedule = workSchedule[key];
                                    return (
                                        <div key={key} className="space-y-2 p-3 border border-white/5 rounded-lg bg-black/20">
                                            <div className="flex items-center justify-between">
                                                <Label
                                                    className={cn(
                                                        "text-sm font-semibold",
                                                        daySchedule.enabled
                                                            ? "text-foreground"
                                                            : "text-muted-foreground"
                                                    )}
                                                >
                                                    {label}
                                                </Label>
                                                <Switch
                                                    checked={daySchedule.enabled}
                                                    onCheckedChange={() => handleDayToggle(key)}
                                                />
                                            </div>

                                            {daySchedule.enabled && (
                                                <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-white/5">
                                                    <Select
                                                        value={daySchedule.type || "work"}
                                                        onValueChange={(val: any) =>
                                                            handleTypeChange(key, val)
                                                        }
                                                    >
                                                        <SelectTrigger className="h-8 bg-white/5 border-white/10 text-xs w-full mb-1">
                                                            <SelectValue placeholder="Select type" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="work">Work</SelectItem>
                                                            <SelectItem value="design">Design</SelectItem>
                                                            <SelectItem value="personal">Personal</SelectItem>
                                                        </SelectContent>
                                                    </Select>

                                                    <div className="flex gap-2">
                                                        <div className="flex-1">
                                                            <Input
                                                                type="time"
                                                                value={daySchedule.start}
                                                                onChange={e =>
                                                                    handleTimeChange(key, "start", e.target.value)
                                                                }
                                                                className="h-8 text-xs bg-white/5 border-white/10"
                                                            />
                                                        </div>
                                                        <span className="flex items-center text-muted-foreground text-[10px] font-bold">
                                                            TO
                                                        </span>
                                                        <div className="flex-1">
                                                            <Input
                                                                type="time"
                                                                value={daySchedule.end}
                                                                onChange={e =>
                                                                    handleTimeChange(key, "end", e.target.value)
                                                                }
                                                                className="h-8 text-xs bg-white/5 border-white/10"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-4 border-t border-white/10 space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <LinkIcon className="w-3.5 h-3.5" /> External Calendar Sync
                                </Label>
                                <p className="text-[11px] text-muted-foreground leading-tight">
                                    Paste a public Apple iCloud or Google Calendar `Secret address in iCal format` (.ics) URL here to automatically block busy slots.
                                </p>
                                <div className="space-y-2">
                                    <Input
                                        value={appleCalendarUrl}
                                        onChange={(e) => {
                                            setAppleCalendarUrl(e.target.value);
                                            setSyncStatus("idle");
                                            setSyncMessage("");
                                        }}
                                        placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                                        className="bg-accent/5"
                                    />
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs font-medium">
                                            {syncStatus === "success" && <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {syncMessage}</span>}
                                            {syncStatus === "error" && <span className="text-red-400">{syncMessage}</span>}
                                        </div>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={handleTestUrl}
                                            disabled={!appleCalendarUrl || syncStatus === "testing"}
                                            className="h-8 text-xs px-3"
                                        >
                                            {syncStatus === "testing" ? "Testing..." : "Test Sync"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 4 && (
                        <motion.div
                            key="step-4"
                            variants={currentStepVariant}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="flex flex-col items-center justify-center text-center space-y-4 py-8"
                        >
                            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                                <RefreshCw className="w-8 h-8 text-emerald-500" />
                            </div>

                            <p className="text-sm text-muted-foreground">
                                Your Public Booking Link is live! You can modify any of these settings later within your Dashboard Dashboard.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="absolute bottom-6 left-6 right-6">
                <Button
                    className="w-full h-12 text-sm font-bold tracking-wide uppercase"
                    onClick={handleNext}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Saving..." : step === 4 ? "Go to Dashboard" : "Continue"}
                </Button>
            </div>
        </div>
    );
}
