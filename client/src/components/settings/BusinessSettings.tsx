import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getGoogleMapsEmbedUrl } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { getBankDetailLabels } from "@shared/utils/bankDetails";
import { Button, Input, Label, Textarea, Switch } from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft } from "lucide-react";

export function BusinessSettings({ onBack }: { onBack: () => void }) {
    const { user } = useAuth();

    // Business settings state
    const [businessName, setBusinessName] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [businessEmail, setBusinessEmail] = useState("");
    const [businessAddress, setBusinessAddress] = useState("");
    const [businessCountry, setBusinessCountry] = useState("AU");
    const [bsb, setBsb] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [licenceNumber, setLicenceNumber] = useState("");
    const [depositAmount, setDepositAmount] = useState("");
    const [autoSendDepositInfo, setAutoSendDepositInfo] = useState(false);

    const debouncedAddress = useDebounce(businessAddress, 1000);

    const upsertArtistSettingsMutation = trpc.artistSettings.upsert.useMutation({
        onSuccess: () => {
            toast.success("Business info updated successfully");
        },
        onError: error => {
            toast.error("Failed to update business info: " + error.message);
        },
    });

    const {
        data: artistSettings,
        isLoading: isLoadingSettings,
        isError: isErrorSettings,
        error: settingsError,
        refetch: refetchSettings,
    } = trpc.artistSettings.get.useQuery(undefined, {
        enabled: !!user && (user.role === "artist" || user.role === "admin"),
        retry: 3,
    });

    // Initialize business settings state once, inside useEffect (not render body)
    // to avoid setState-during-render which causes React error #185.
    const initializedSettingsRef = useRef(false);
    useEffect(() => {
        if (artistSettings && !initializedSettingsRef.current) {
            initializedSettingsRef.current = true;
            setBusinessName(artistSettings.businessName || "");
            setDisplayName(artistSettings.displayName || "");
            setBusinessEmail(artistSettings.businessEmail || "");
            setBusinessAddress(artistSettings.businessAddress || "");
            setBusinessCountry(artistSettings.businessCountry || "AU");
            setBsb(artistSettings.bsb || "");
            setAccountNumber(artistSettings.accountNumber || "");
            setLicenceNumber(artistSettings.licenceNumber || "");
            setDepositAmount(artistSettings.depositAmount?.toString() || "");
            setAutoSendDepositInfo(!!artistSettings.autoSendDepositInfo);
        }
    }, [artistSettings]);

    const handleSaveBusinessInfo = () => {
        if (artistSettings) {
            upsertArtistSettingsMutation.mutate({
                businessName,
                displayName,
                businessEmail,
                businessAddress,
                businessCountry,
                bsb: getBankDetailLabels(businessCountry).bankCodeLabel ? bsb : undefined, // Strip BSB if country doesn't need it
                accountNumber,
                licenceNumber,
                depositAmount: depositAmount ? parseInt(depositAmount) : undefined,
                autoSendDepositInfo: autoSendDepositInfo,
                workSchedule: artistSettings.workSchedule,
                services: artistSettings.services,
            });
        } else {
            toast.error("Cannot save: settings not loaded yet");
        }
    };

    return (
        <div className="w-full h-full flex flex-col overflow-hidden relative">
            {/* 1. Page Header - Left aligned, floating panel style */}
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-white/5">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                </button>
                <h2 className="text-xl font-semibold text-foreground">Business Info</h2>
            </div>

            <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
                <div className="pb-[180px] max-w-lg mx-auto space-y-6 px-4 pt-6">
                    <div className="mb-4">
                        <p className="text-muted-foreground text-sm font-medium">
                            Details & Payments (Confidential)
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="businessName">Business Name</Label>
                            <Input
                                id="businessName"
                                value={businessName}
                                onChange={e => setBusinessName(e.target.value)}
                                placeholder="Your business name"
                                className="bg-white/5 border-white/10"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="displayName">Display Name</Label>
                            <Input
                                id="displayName"
                                value={displayName}
                                onChange={e => setDisplayName(e.target.value)}
                                placeholder="Alias shown to clients"
                                className="bg-white/5 border-white/10"
                            />
                            <p className="text-xs text-muted-foreground">
                                This is the name clients will see in messages.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="businessEmail">Business Email</Label>
                            <Input
                                id="businessEmail"
                                value={businessEmail}
                                onChange={e => setBusinessEmail(e.target.value)}
                                placeholder="email@example.com"
                                type="email"
                                className="bg-white/5 border-white/10"
                            />
                            <p className="text-xs text-muted-foreground">
                                This email will be used for sending notifications to clients
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="licenceNumber">
                                Artist License Number{" "}
                                <span className="text-muted-foreground font-normal">
                                    (Optional)
                                </span>
                            </Label>
                            <Input
                                id="licenceNumber"
                                value={licenceNumber}
                                onChange={e => setLicenceNumber(e.target.value)}
                                placeholder="E.g. 123456789"
                                className="bg-white/5 border-white/10"
                            />
                            <p className="text-xs text-muted-foreground">
                                Required for generating health regulation logs (e.g. QLD
                                Form 9)
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="businessAddress">Business Address</Label>
                            <Textarea
                                id="businessAddress"
                                value={businessAddress}
                                onChange={e => setBusinessAddress(e.target.value)}
                                placeholder="Your business address"
                                rows={3}
                                className="bg-white/5 border-white/10"
                            />
                            <p className="text-xs text-muted-foreground">
                                Clients will receive a map link to this address on
                                appointment day
                            </p>

                            {/* Google Maps Preview */}
                            {businessAddress && (
                                <div className="mt-3 rounded-xl overflow-hidden border border-white/10 h-40 bg-black/20 relative group">
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        frameBorder="0"
                                        scrolling="no"
                                        marginHeight={0}
                                        marginWidth={0}
                                        src={getGoogleMapsEmbedUrl(debouncedAddress)}
                                        className="opacity-70 group-hover:opacity-100 transition-opacity"
                                    />
                                    <div className="absolute bottom-0 right-0 bg-black/60 px-2 py-1 text-[10px] text-white/70 backdrop-blur-sm rounded-tl-lg pointer-events-none">
                                        Preview
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-white/10">
                        <h3 className="font-semibold text-foreground">
                            Usage Settings
                        </h3>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="autoSendDeposit">
                                    Auto-send Deposit Info
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Send details when client accepts proposal
                                </p>
                            </div>
                            <Switch
                                id="autoSendDeposit"
                                checked={autoSendDepositInfo}
                                onCheckedChange={setAutoSendDepositInfo}
                            />
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-white/10">
                        <h3 className="font-semibold text-foreground">
                            Deposit Payment Settings
                        </h3>

                        <div className="space-y-2">
                            <Label htmlFor="businessCountry">Business Country</Label>
                            <Select value={businessCountry} onValueChange={setBusinessCountry}>
                                <SelectTrigger className="w-full bg-white/5 border-white/10">
                                    <SelectValue placeholder="Select Country" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="AU">Australia</SelectItem>
                                    <SelectItem value="NZ">New Zealand</SelectItem>
                                    <SelectItem value="US">United States</SelectItem>
                                    <SelectItem value="GB">United Kingdom</SelectItem>
                                    <SelectItem value="CA">Canada</SelectItem>
                                    <SelectItem value="EU">Europe (IBAN)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Sets regional bank formats</p>
                        </div>

                        {getBankDetailLabels(businessCountry).bankCodeLabel && (
                            <div className="space-y-2">
                                <Label htmlFor="bsb">{getBankDetailLabels(businessCountry).bankCodeLabel}</Label>
                                <Input
                                    id="bsb"
                                    value={bsb}
                                    onChange={e => setBsb(e.target.value)}
                                    placeholder={businessCountry === "AU" ? "123-456" : ""}
                                    maxLength={15}
                                    className="bg-white/5 border-white/10"
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="accountNumber">{getBankDetailLabels(businessCountry).accountLabel}</Label>
                            <Input
                                id="accountNumber"
                                value={accountNumber}
                                onChange={e => setAccountNumber(e.target.value)}
                                placeholder="12345678"
                                className="bg-white/5 border-white/10"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="depositAmount">
                                Deposit Amount
                            </Label>
                            {(!artistSettings?.subscriptionTier || artistSettings.subscriptionTier === "basic") ? (
                                <>
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">25% per booking</p>
                                            <p className="text-xs text-muted-foreground">
                                                Fixed on your current plan
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Deposit percentage is locked at 25% on the Free plan.
                                        Upgrade to <span className="text-primary font-medium cursor-pointer hover:underline" onClick={() => window.location.href = "/subscriptions"}>Pro</span> to set a custom deposit amount.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <Input
                                        id="depositAmount"
                                        type="number"
                                        value={depositAmount}
                                        onChange={e => setDepositAmount(e.target.value)}
                                        placeholder="100"
                                        className="bg-white/5 border-white/10"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Custom deposit amount per appointment
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    <Button
                        className="w-full shadow-lg shadow-primary/20"
                        onClick={
                            isErrorSettings || (!artistSettings && !isLoadingSettings)
                                ? () => refetchSettings()
                                : handleSaveBusinessInfo
                        }
                        disabled={
                            upsertArtistSettingsMutation.isPending ||
                            (isLoadingSettings && !isErrorSettings)
                        }
                        variant={isErrorSettings ? "destructive" : "default"}
                    >
                        {upsertArtistSettingsMutation.isPending
                            ? "Saving..."
                            : isLoadingSettings
                                ? "Loading..."
                                : isErrorSettings
                                    ? "Retry Loading Data"
                                    : !artistSettings
                                        ? "Data Unavailable (Retry)"
                                        : "Save Business Info"}
                    </Button>
                    {isErrorSettings && (
                        <p className="text-xs text-destructive text-center mt-2">
                            Error: {settingsError?.message || "Could not load settings"}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
