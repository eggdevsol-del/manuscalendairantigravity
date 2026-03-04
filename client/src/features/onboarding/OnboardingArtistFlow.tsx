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
import { Camera, RefreshCw, Settings as SettingsIcon, MapPin, Building2, CreditCard, Scissors, Bell, Star } from "lucide-react";

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
    const [businessName, setBusinessName] = useState("");
    const [publicSlug, setPublicSlug] = useState("");
    const [businessEmail, setBusinessEmail] = useState("");
    const [licenceNumber, setLicenceNumber] = useState("");

    // Identify if Queensland compliance is required
    const isQLD = businessCountry === "AU" && (businessAddress.toLowerCase().includes("qld") || businessAddress.toLowerCase().includes("queensland"));

    // Step 3: Deposit Config
    const [bsb, setBsb] = useState("");
    const [accountNumber, setAccountNumber] = useState("");

    // Step 4: Intro Services
    const [services, setServices] = useState<any[]>([]);
    const [newServiceTitle, setNewServiceTitle] = useState("");
    const [newServiceDuration, setNewServiceDuration] = useState("60");
    const [newServicePrice, setNewServicePrice] = useState("");
    const [newServiceIsProject, setNewServiceIsProject] = useState(false);
    const [newServiceSittings, setNewServiceSittings] = useState("1");

    // Step 5: Automation Level
    const [sendAutomatedReminders, setSendAutomatedReminders] = useState(true);

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
            setStep(3);
        } else if (step === 3) {
            setStep(4);
        } else if (step === 4) {
            if (services.length === 0) {
                toast.error("Please create at least one introductory service.");
                return;
            }
            setStep(5);
        } else if (step === 5) {
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
                setStep(6);
            } catch (e) {
                toast.error("Failed to sequence operation. Check inputs.");
            } finally {
                setIsSubmitting(false);
            }
        } else if (step === 6) {
            // Dismiss overlay and push to subscription screen
            await onComplete();
            setLocation("/subscriptions");
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
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full ${step >= i ? 'bg-primary' : 'bg-primary/20'}`} />
                    ))}
                </div>

                <div className="flex-1 relative pb-20">
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
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Country</Label>
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

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Account BSB / Routing Number</Label>
                                    <Input
                                        value={bsb}
                                        onChange={(e) => setBsb(e.target.value)}
                                        placeholder="e.g. 064-000"
                                        className="bg-accent/5"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Account Number</Label>
                                    <Input
                                        value={accountNumber}
                                        onChange={(e) => setAccountNumber(e.target.value)}
                                        placeholder="e.g. 12345678"
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
                                className="space-y-4"
                            >
                                <div className="mb-4 space-y-1">
                                    <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                        <Scissors className="w-5 h-5 text-primary" /> Introductory Services
                                    </h2>
                                    <p className="text-sm text-muted-foreground leading-tight">
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

                                    <Input placeholder="Service Name (e.g. Full Day Session)" value={newServiceTitle} onChange={(e) => setNewServiceTitle(e.target.value)} />

                                    <div className="flex gap-2">
                                        <Select value={newServiceDuration} onValueChange={setNewServiceDuration}>
                                            <SelectTrigger><SelectValue placeholder="Duration" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="30">30 Min</SelectItem>
                                                <SelectItem value="60">1 Hour</SelectItem>
                                                <SelectItem value="180">3 Hours (Half Day)</SelectItem>
                                                <SelectItem value="360">6 Hours (Full Day)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input placeholder="$ Price" type="number" value={newServicePrice} onChange={(e) => setNewServicePrice(e.target.value)} />
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
                                className="flex flex-col items-center justify-center text-center space-y-4 py-8"
                            >
                                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                                    <Star className="w-8 h-8 text-emerald-500" />
                                </div>

                                <h2 className="text-2xl font-black">All Set!</h2>
                                <p className="text-sm text-muted-foreground">
                                    Your fundamental studio architecture is mounted. You will now be redirected to select your preferred subscription tier unlocking platform capabilities.
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="absolute bottom-6 left-6 right-6">
                    <Button
                        className="w-full h-12 text-sm font-bold tracking-wide uppercase shadow-lg shadow-primary/20"
                        onClick={handleNext}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Finalizing..." : step === 6 ? "Proceed to Subscription" : "Continue"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
