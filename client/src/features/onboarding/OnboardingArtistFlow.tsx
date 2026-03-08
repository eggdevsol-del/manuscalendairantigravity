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
import { useLocation } from "wouter";
import { Camera, RefreshCw, Settings as SettingsIcon, MapPin, Building2, CreditCard, Scissors, Bell, Star, Calendar as CalendarIcon, Link as LinkIcon, Wallet as WalletIcon, Database } from "lucide-react";
import { DataImportSettings } from "@/components/settings/DataImportSettings";
import { ImageUpload } from "@/components/ui/ImageUpload";

interface OnboardingArtistFlowProps {
    onComplete: () => Promise<void>;
}

export function OnboardingArtistFlow({ onComplete }: OnboardingArtistFlowProps) {
    const { user, refresh } = useAuth();
    const [, setLocation] = useLocation();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Step 1: Location & Profile
    const [businessCountry, setBusinessCountry] = useState("AU");
    const [businessAddress, setBusinessAddress] = useState("");
    const [name, setName] = useState(user?.name || "");
    const [avatar, setAvatar] = useState(user?.avatar || "");

    // Step 2: Business Details
    const [businessName, setBusinessName] = useState(user?.name || "");
    const [publicSlug, setPublicSlug] = useState(user?.username || "");
    const [businessEmail, setBusinessEmail] = useState(user?.email || "");
    const [licenceNumber, setLicenceNumber] = useState("");

    // Identify if Queensland compliance is required
    const isQLD = businessCountry === "AU" && (businessAddress.toLowerCase().includes("qld") || businessAddress.toLowerCase().includes("queensland"));

    // Step 3: Deposit Config
    const [bsb, setBsb] = useState("");
    const [accountNumber, setAccountNumber] = useState("");

    // Services (Merged into Step 2)
    const [services, setServices] = useState<any[]>([]);
    const [newServiceTitle, setNewServiceTitle] = useState("");
    const [newServiceDuration, setNewServiceDuration] = useState("60");
    const [newServicePrice, setNewServicePrice] = useState("");
    const [newServiceIsProject, setNewServiceIsProject] = useState(false);
    const [newServiceSittings, setNewServiceSittings] = useState("1");

    // Step 4: Data Import
    const [showImporter, setShowImporter] = useState(false);

    // Step 5: Automation Level
    const [sendAutomatedReminders, setSendAutomatedReminders] = useState(true);

    // Step 7: Subscription
    const [subscriptionTier, setSubscriptionTier] = useState<"free" | "pro" | "pro_plus">("pro");

    const updateProfileMutation = trpc.auth.updateProfile.useMutation();
    const updateSettingsMutation = trpc.artistSettings.upsert.useMutation();

    const handleAddService = () => {
        if (!newServiceTitle || !newServicePrice) {
            toast.error("Title and Price are required.");
            return;
        }
        const serviceObj = {
            id: Date.now().toString(),
            title: newServiceTitle,
            durationMinutes: parseInt(newServiceDuration, 10),
            price: parseInt(newServicePrice, 10),
            sittings: newServiceIsProject ? parseInt(newServiceSittings, 10) : 1,
            description: "",
            depositAmount: 0,
            allowOnlineBooking: true
        };
        setServices([...services, serviceObj]);
        setNewServiceTitle("");
        setNewServicePrice("");
        setNewServiceIsProject(false);
        setNewServiceSittings("1");
    };

    const handleRemoveService = (id: string) => {
        setServices(services.filter(s => s.id !== id));
    };

    const handleNext = async () => {
        if (step === 1) {
            if (!businessCountry || !name) {
                toast.error("Country and Name are required.");
                return;
            }
            setIsSubmitting(true);
            try {
                await updateProfileMutation.mutateAsync({ name, avatar });
                await refresh();
                setStep(2);
            } catch (e) {
                toast.error("Failed to save profile.");
            } finally {
                setIsSubmitting(false);
            }
        } else if (step === 2) {
            if (!businessName || !publicSlug || !businessEmail) {
                toast.error("Business ID fields are required.");
                return;
            }
            if (isQLD && !licenceNumber) {
                toast.error("QLD Licence Number is required for your locale.");
                return;
            }
            if (services.length === 0) {
                toast.error("Please create at least one introductory service.");
                return;
            }
            setStep(3);
        } else if (step === 3) {
            setStep(4);
        } else if (step === 4) {
            if (showImporter) {
                setShowImporter(false);
            }
            setStep(5);
        } else if (step === 5) {
            setStep(6);
        } else if (step === 6) {
            // Final submission
            setIsSubmitting(true);
            try {
                await updateSettingsMutation.mutateAsync({
                    businessCountry,
                    businessAddress,
                    businessName,
                    publicSlug,
                    businessEmail,
                    licenceNumber: isQLD ? licenceNumber : undefined,
                    bsb,
                    accountNumber,
                    services: JSON.stringify(services),
                    sendAutomatedReminders,
                    // Supply a safe default schema for schedule to avoid DB breaks
                    workSchedule: JSON.stringify({}),
                });

                // Move to Walkthrough
                setStep(7);
            } catch (e) {
                toast.error("Failed to sequence operation. Check inputs.");
            } finally {
                setIsSubmitting(false);
            }
        } else if (step === 7) {
            // Dismiss overlay to let them interact with app
            await onComplete();
        }
    };

    const currentStepVariant = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
    };

    return (
        <div className="flex flex-col h-full w-full relative">
            <div className="mb-6 space-y-1 px-2">
                {/* Progress Indicator */}
                <div className="flex items-center gap-1.5 mb-6">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full ${step >= i ? 'bg-primary' : 'bg-primary/20'}`} />
                    ))}
                </div>
            </div>

            <div className="flex-1 relative pb-20 overflow-y-auto">
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
                                    <MapPin className="w-5 h-5 text-primary" /> Location & Profile
                                </h2>
                                <p className="text-sm text-muted-foreground leading-tight">
                                    Establish your business location to configure regional compliance and display identity.
                                </p>
                            </div>

                            <div className="space-y-1.5 mb-6">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Country <span className="text-primary">*</span></Label>
                                <Select value={businessCountry} onValueChange={setBusinessCountry}>
                                    <SelectTrigger className="bg-accent/5 border border-input">
                                        <SelectValue placeholder="Select your Country" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="AU">Australia</SelectItem>
                                        <SelectItem value="US">United States</SelectItem>
                                        <SelectItem value="UK">United Kingdom</SelectItem>
                                        <SelectItem value="NZ">New Zealand</SelectItem>
                                        <SelectItem value="CA">Canada</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex justify-center mb-6">
                                <div className="w-24 h-24 rounded-full relative overflow-hidden group">
                                    <ImageUpload
                                        value={avatar}
                                        onChange={(url) => setAvatar(url)}
                                        onRemove={() => setAvatar("")}
                                        label="Photo"
                                        className="w-full h-full border-none rounded-full [&>div]:bg-accent/30 hover:[&>div]:bg-accent/50 group-hover:opacity-100"
                                    />
                                    {/* Overlay for non-Uploaded state to force circular shape */}
                                    {!avatar && (
                                        <div className="absolute inset-0 pointer-events-none rounded-full border-2 border-primary/20 flex flex-col items-center justify-center text-primary/50">
                                            <Camera className="w-8 h-8 mb-1" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Photo</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Studio Address</Label>
                                <Input
                                    value={businessAddress}
                                    onChange={(e) => setBusinessAddress(e.target.value)}
                                    placeholder="e.g. 123 Ink Blvd, QLD 4000"
                                    className="bg-accent/5"
                                />
                                <p className="text-[10px] text-muted-foreground">Enables mapping and detects compliance constraints automatically.</p>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name / Display Name</Label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. John Doe"
                                    className="bg-accent/5"
                                />
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
                                    <Building2 className="w-5 h-5 text-primary" /> Business Details
                                </h2>
                                <p className="text-sm text-muted-foreground leading-tight">
                                    Register your operational identity and platform booking handles.
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Business Name</Label>
                                <Input
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    placeholder="e.g. Inky Bob's Studio"
                                    className="bg-accent/5"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Platform Booking Handle</Label>
                                <div className="flex rounded-md overflow-hidden bg-accent/5 focus-within:ring-2 focus-within:ring-primary/50 transition-all border border-input">
                                    <div className="px-3 py-2 bg-black/40 text-muted-foreground text-sm border-r border-input flex items-center shrink-0">
                                        calendair.net/
                                    </div>
                                    <input
                                        type="text"
                                        className="flex-1 bg-transparent px-3 text-sm outline-none w-full"
                                        value={publicSlug}
                                        onChange={(e) => setPublicSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                        placeholder="inkybob"
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground">Share this public link to intake clients.</p>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Business Email</Label>
                                <Input
                                    type="email"
                                    value={businessEmail}
                                    onChange={(e) => setBusinessEmail(e.target.value)}
                                    placeholder="e.g. bob@studio.com"
                                    className="bg-accent/5"
                                />
                            </div>

                            {isQLD && (
                                <div className="space-y-1.5 pt-4 border-t border-white/10 mt-4">
                                    <Label className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                                        ⚠️ QLD Legislative Compliance
                                    </Label>
                                    <p className="text-[11px] text-muted-foreground pb-2">
                                        Your address indicates operating in Queensland, Australia. You must provide a valid Infection Control Licence Number per local laws.
                                    </p>
                                    <Input
                                        value={licenceNumber}
                                        onChange={(e) => setLicenceNumber(e.target.value)}
                                        placeholder="Licence Number (e.g. LQN-001245)"
                                        className="bg-red-400/5 border-red-400/20 placeholder:text-red-400/30 text-red-50"
                                    />
                                </div>
                            )}

                            <div className="space-y-1.5 pt-6 border-t border-white/10 mt-6">
                                <div className="mb-4 space-y-1">
                                    <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2 uppercase">
                                        <Scissors className="w-4 h-4 text-primary" /> Base Services
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-tight">
                                        Map out your core offerings. You can build advanced variables later.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2 mb-4">
                                    {services.map((s, i) => (
                                        <div key={i} className="flex flex-col bg-white/5 border border-white/10 rounded-lg p-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-semibold">{s.title}</span>
                                                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => handleRemoveService(s.id)}>Remove</Button>
                                            </div>
                                            <div className="text-[11px] text-muted-foreground mt-1">
                                                {s.durationMinutes} minutes • ${s.price} total
                                                {s.sittings > 1 && ` • Project: ${s.sittings} Sittings`}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-accent/5 border border-input rounded-xl p-4 space-y-3">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-foreground/10 pb-2 w-full flex">Add Base Service</Label>

                                    <Input className="h-9 bg-background" placeholder="Service Name (e.g. Full Day Session)" value={newServiceTitle} onChange={(e) => setNewServiceTitle(e.target.value)} />

                                    <div className="flex gap-2">
                                        <Select value={newServiceDuration} onValueChange={setNewServiceDuration}>
                                            <SelectTrigger className="h-9 bg-background border border-input w-[140px]">
                                                <SelectValue placeholder="Duration" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Array.from({ length: 24 }).map((_, i) => (
                                                    <SelectItem key={i + 1} value={String((i + 1) * 60)}>
                                                        {i + 1} {i + 1 === 1 ? 'Hour' : 'Hours'}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Input className="h-9 flex-1 bg-background" placeholder="$ Price" type="number" value={newServicePrice} onChange={(e) => setNewServicePrice(e.target.value)} />
                                    </div>

                                    <div className="flex items-center justify-between px-1 pt-2">
                                        <div className="flex flex-col">
                                            <Label className="text-xs font-semibold text-foreground">Project Mode Toggle</Label>
                                            <span className="text-[10px] text-muted-foreground">Spans multi-session tattoos</span>
                                        </div>
                                        <Switch checked={newServiceIsProject} onCheckedChange={setNewServiceIsProject} />
                                    </div>

                                    {newServiceIsProject && (
                                        <div className="bg-primary/5 p-3 rounded-md border border-primary/20 space-y-2 mt-2">
                                            <Label className="text-xs text-primary font-bold uppercase tracking-wider">Number of Sittings/Sessions</Label>
                                            <Input type="number" min="2" value={newServiceSittings} onChange={(e) => setNewServiceSittings(e.target.value)} />
                                            <p className="text-[10px] text-primary/70 leading-tight">This is a multi-session project. The total price entered above will be the combined cost for all sittings.</p>
                                        </div>
                                    )}

                                    <Button variant="secondary" className="w-full h-8 text-xs mt-2" onClick={handleAddService}>Add Service</Button>
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
                                    <CreditCard className="w-5 h-5 text-primary" /> Deposit Configuration
                                </h2>
                                <p className="text-sm text-muted-foreground leading-tight">
                                    Set your standard collection methods. Bank transfer is the lowest fee option and our platform default.
                                </p>
                            </div>

                            {businessCountry !== "NZ" && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        {businessCountry === "AU" ? "BSB Number" :
                                            businessCountry === "UK" ? "Sort Code" :
                                                businessCountry === "CA" ? "Transit & Inst. Number" :
                                                    "Routing Number"}
                                    </Label>
                                    <Input
                                        value={bsb}
                                        onChange={(e) => setBsb(e.target.value)}
                                        placeholder={
                                            businessCountry === "AU" ? "e.g. 064-000" :
                                                businessCountry === "UK" ? "e.g. 20-00-00" :
                                                    businessCountry === "CA" ? "e.g. 12345-001" :
                                                        "e.g. 122000248"
                                        }
                                        className="bg-accent/5"
                                    />
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Account Number</Label>
                                <Input
                                    value={accountNumber}
                                    onChange={(e) => setAccountNumber(e.target.value)}
                                    placeholder={businessCountry === "NZ" ? "e.g. 12-3456-1234567-00" : "e.g. 12345678"}
                                    className="bg-accent/5"
                                />
                            </div>

                            <div className="p-3 mt-4 rounded-xl border border-white/5 bg-white/5 opacity-50 flex flex-col">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold">Stripe / PayPal Gateways</span>
                                    <Switch disabled checked={false} />
                                </div>
                                <p className="text-[10px] text-muted-foreground">Automated charge rails are available inside the operational dashboard post-setup.</p>
                            </div>

                            <p className="text-[10px] text-muted-foreground mt-2 italic text-center">
                                Note: Cash point-of-sale deposits are intentionally excluded from automation and are added contextually inside appointments via the Dashboard natively.
                            </p>

                        </motion.div>
                    )}

                    {step === 4 && (
                        <motion.div
                            key="step-4"
                            variants={currentStepVariant}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className={cn("space-y-4", showImporter ? "h-[65vh] min-h-[500px] relative" : "h-full relative")}
                        >
                            {showImporter ? (
                                <DataImportSettings onBack={() => setShowImporter(false)} />
                            ) : (
                                <>
                                    <div className="mb-4 space-y-1">
                                        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                            <Database className="w-5 h-5 text-primary" /> Data Import
                                        </h2>
                                        <p className="text-sm text-muted-foreground leading-tight">
                                            Transfer your existing client roster and historic appointments from other booking platforms.
                                        </p>
                                    </div>

                                    <div className="bg-accent/5 border border-input rounded-xl p-5 space-y-4 text-center flex flex-col items-center mt-8">
                                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                                            <Database className="w-8 h-8 text-primary" />
                                        </div>
                                        <h3 className="font-bold text-foreground">Have existing records?</h3>
                                        <p className="text-xs text-muted-foreground px-4 leading-relaxed">
                                            You can automatically ingest .CSV exports from platforms like Fresha, Vagaro, or Square. This ensures your calendars and CRM are fully populated from day one.
                                        </p>
                                        <Button
                                            variant="default"
                                            className="w-full mt-4"
                                            onClick={() => setShowImporter(true)}
                                        >
                                            Upload CSV File
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="w-full text-xs text-muted-foreground"
                                            onClick={() => setStep(5)}
                                        >
                                            Skip for now
                                        </Button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    )}

                    {step === 5 && (
                        <motion.div
                            key="step-5"
                            variants={currentStepVariant}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="space-y-4"
                        >
                            <div className="mb-6 space-y-1">
                                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-primary" /> Automation Level
                                </h2>
                                <p className="text-sm text-muted-foreground leading-tight">
                                    Choose how communication timelines operate across your booked clientele.
                                </p>
                            </div>

                            <div
                                className={cn("p-4 rounded-xl border flex flex-col gap-2 cursor-pointer transition-colors", sendAutomatedReminders ? 'bg-primary/10 border-primary/50' : 'bg-accent/5 border-input hover:border-white/20')}
                                onClick={() => setSendAutomatedReminders(true)}
                            >
                                <span className="font-bold text-sm text-foreground">Automated Reminders</span>
                                <span className="text-xs text-muted-foreground">The platform automatically sends timed SMS/Email reminders bridging appointments, deposits, and consultations.</span>
                            </div>

                            <div
                                className={cn("p-4 rounded-xl border flex flex-col gap-2 cursor-pointer transition-colors", !sendAutomatedReminders ? 'bg-primary/10 border-primary/50' : 'bg-accent/5 border-input hover:border-white/20')}
                                onClick={() => setSendAutomatedReminders(false)}
                            >
                                <span className="font-bold text-sm text-foreground">Manual Reminders</span>
                                <span className="text-xs text-muted-foreground">Retain complete personal control. You will trigger native SMS and Email notifications yourself inside Dashboard workflows.</span>
                            </div>
                        </motion.div>
                    )}

                    {step === 6 && (
                        <motion.div
                            key="step-6"
                            variants={currentStepVariant}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="space-y-4"
                        >
                            <div className="mb-4 space-y-1">
                                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                    <Star className="w-5 h-5 text-primary" /> Select Plan
                                </h2>
                                <p className="text-sm text-muted-foreground leading-tight">
                                    Finalize your studio configuration by selecting your operational tier.
                                </p>
                            </div>

                            <div className="space-y-3">
                                {/* Free Tier */}
                                <div
                                    className={cn("p-4 rounded-xl border cursor-pointer transition-all", subscriptionTier === 'free' ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10' : 'bg-card border-white/5 opacity-80')}
                                    onClick={() => setSubscriptionTier('free')}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-bold text-lg">Free Tier</h3>
                                        <span className="text-xs font-bold px-2 py-0.5 bg-white/10 rounded-full">$0/mo</span>
                                    </div>
                                    <ul className="text-[10px] space-y-1 mt-3">
                                        <li className="flex justify-between"><span className="text-muted-foreground">Tri-app proprietary booking app</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Calendar (client/artist)</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Revenue protection</span> <span className="text-red-400 font-bold">✗</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">In-app messages</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Booking link for bio</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Booking consult funnel</span> <span className="text-red-400 font-bold">✗</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Branded consult funnel</span> <span className="text-red-400 font-bold">✗</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Custom consult funnel</span> <span className="text-red-400 font-bold">✗</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Photos/reference storage</span> <span className="text-red-400 font-bold">✗</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Business / Social / Personal dashboard</span> <span className="text-red-400 font-bold">✗</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Promotional items</span> <span className="text-foreground font-bold">5 max</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Client import/export data</span> <span className="text-red-400 font-bold">✗</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Maps link on appointments</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Auto medical release forms</span> <span className="text-red-400 font-bold">✗</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Auto consent forms</span> <span className="text-red-400 font-bold">✗</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">QLD Procedure Form 9</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Full client event history</span> <span className="text-red-400 font-bold">✗</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Customer support</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">One-on-one systems creation advice</span> <span className="text-red-400 font-bold">✗</span></li>
                                    </ul>
                                </div>

                                {/* Pro Tier */}
                                <div
                                    className={cn("p-4 rounded-xl border relative cursor-pointer transition-all", subscriptionTier === 'pro' ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10' : 'bg-card border-white/5 opacity-80')}
                                    onClick={() => setSubscriptionTier('pro')}
                                >
                                    <div className="absolute -top-2.5 right-4 bg-primary text-primary-foreground text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-md z-10">Popular</div>
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-bold text-lg text-primary">Pro Tier</h3>
                                        <span className="text-xs font-bold px-2 py-0.5 bg-primary/20 text-primary rounded-full">$29/mo</span>
                                    </div>
                                    <ul className="text-[10px] space-y-1 mt-3">
                                        <li className="flex justify-between"><span className="text-muted-foreground">Tri-app proprietary booking app</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Calendar (client/artist)</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Revenue protection</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">In-app messages</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Booking link for bio</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Booking consult funnel</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Branded consult funnel</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Custom consult funnel</span> <span className="text-red-400 font-bold">✗</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Photos/reference storage</span> <span className="text-foreground font-bold">1 year storage</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Business / Social / Personal dashboard</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Promotional items</span> <span className="text-foreground font-bold">100 max</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Client import/export data</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Maps link on appointments</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Auto medical release forms</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Auto consent forms</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">QLD Procedure Form 9</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Full client event history</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Customer support</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">One-on-one systems creation advice</span> <span className="text-red-400 font-bold">✗</span></li>
                                    </ul>
                                </div>

                                {/* Pro Plus Tier */}
                                <div
                                    className={cn("p-4 rounded-xl border cursor-pointer transition-all", subscriptionTier === 'pro_plus' ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10' : 'bg-card border-white/5 opacity-80')}
                                    onClick={() => setSubscriptionTier('pro_plus')}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-bold text-lg">Pro Plus</h3>
                                        <span className="text-xs font-bold px-2 py-0.5 bg-white/10 rounded-full">$49/mo</span>
                                    </div>
                                    <ul className="text-[10px] space-y-1 mt-3">
                                        <li className="flex justify-between"><span className="text-muted-foreground">Tri-app proprietary booking app</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Calendar (client/artist)</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Revenue protection</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">In-app messages</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Booking link for bio</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Booking consult funnel</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Branded consult funnel</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Custom consult funnel</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Photos/reference storage</span> <span className="text-foreground font-bold">unlimited</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Business / Social / Personal dashboard</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Promotional items</span> <span className="text-foreground font-bold">unlimited</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Client import/export data</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Maps link on appointments</span> <span className="text-foreground font-bold text-right pl-2">customisable</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Auto medical release forms</span> <span className="text-foreground font-bold text-right pl-2">customisable</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Auto consent forms</span> <span className="text-foreground font-bold text-right pl-2">customisable</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">QLD Procedure Form 9</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Full client event history</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">Customer support</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                        <li className="flex justify-between"><span className="text-muted-foreground">One-on-one systems creation advice</span> <span className="text-emerald-500 font-bold">✓</span></li>
                                    </ul>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 7 && (
                        <motion.div
                            key="step-7"
                            variants={currentStepVariant}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="space-y-6 pt-2 pb-8"
                        >
                            <div className="text-center space-y-2 mb-8">
                                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                                    <SettingsIcon className="w-8 h-8 text-emerald-500 animate-spin-slow" />
                                </div>
                                <h2 className="text-2xl font-black">Platform Activated</h2>
                                <p className="text-sm text-muted-foreground">
                                    Your fundamental studio architecture is mounted. Here is how to navigate your new operational hub.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex gap-4 p-4 rounded-xl bg-card border border-white/5">
                                    <div className="shrink-0 pt-1">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                            <CalendarIcon className="w-4 h-4 text-primary" />
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm text-foreground">Central Calendar Engine</h4>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            All studio operations route through here. Tap the center FAB button anytime to manage your availability, process Consultations, or add new projects.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-4 p-4 rounded-xl bg-card border border-white/5">
                                    <div className="shrink-0 pt-1">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                            <LinkIcon className="w-4 h-4 text-primary" />
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm text-foreground">Studio Booking Link</h4>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Add <span className="text-primary font-mono text-[10px]">calendair.net/{publicSlug}</span> to your Instagram bio. Your custom booking wizard collects client requests and reference photos into your inbox.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-4 p-4 rounded-xl bg-card border border-white/5">
                                    <div className="shrink-0 pt-1">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                            <WalletIcon className="w-4 h-4 text-primary" />
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm text-foreground">Deposit Routing</h4>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            When you approve a Consultation, clients are instantly sent a secure checkout link allowing them to process the deposit directly to your configured Bank Account.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Fixed Footer */}
            {(!showImporter || step !== 4) && (
                <div className="absolute bottom-6 left-6 right-6 z-40">
                    <Button
                        className="w-full h-12 text-sm font-bold tracking-wide uppercase shadow-lg shadow-primary/20"
                        onClick={handleNext}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Finalizing Studio..." : step === 7 ? "Enter Dashboard" : step === 6 ? "Activate Subscription" : step === 4 ? "Skip Data Import" : "Continue"}
                    </Button>
                </div>
            )}
        </div>
    );
}
