import { useAuth } from "@/_core/hooks/useAuth";
import { useUIDebug } from "@/_core/contexts/UIDebugContext";
import { useTheme } from "@/contexts/ThemeContext";
import PushNotificationSettings from "@/components/PushNotificationSettings";
import { getAssetUrl } from "@/lib/assets";

import WorkHoursAndServices from "./WorkHoursAndServices";
import ArtistLink from "@/components/ArtistLink";
import RegulationPage from "./settings/RegulationPage";
import { Button, Card, Input, Label, Switch, Textarea } from "@/components/ui";
import { LoadingState, PageShell, PageHeader } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Bell,
  Calendar,
  ChevronRight,
  Clock,
  Link2,
  LogOut,
  MapPin,
  Moon,
  Sun,
  User,
  Zap,
  RefreshCw,
  Scale,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { forceUpdate } from "@/lib/pwa";
import { APP_VERSION } from "@/lib/version";
import { getGoogleMapsEmbedUrl } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

type SettingsSection = "main" | "profile" | "work-hours" | "quick-actions" | "notifications" | "business" | "booking-link" | "regulation";

export default function Settings() {
  const { user, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showDebugLabels, setShowDebugLabels } = useUIDebug();
  const [location, setLocation] = useLocation();
  const search = useSearch();

  // Derive active section from URL search params
  const params = new URLSearchParams(search);
  const activeSection = (params.get("section") as SettingsSection) || "main";

  // Helper to change section
  const navigateToSection = (section: SettingsSection) => {
    if (section === "main") {
      setLocation("/settings");
    } else {
      setLocation(`/settings?section=${section}`);
    }
  };

  // Profile state
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [profileBirthday, setProfileBirthday] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Business settings state
  const [businessName, setBusinessName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [bsb, setBsb] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [autoSendDepositInfo, setAutoSendDepositInfo] = useState(false);

  const debouncedAddress = useDebounce(businessAddress, 1000);

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update profile: " + error.message);
    },
  });

  const upsertArtistSettingsMutation = trpc.artistSettings.upsert.useMutation({
    onSuccess: () => {
      toast.success("Business info updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update business info: " + error.message);
    },
  });

  const uploadImageMutation = trpc.upload.uploadImage.useMutation({
    onSuccess: () => {
      toast.success("Image uploaded successfully");
    },
    onError: (error) => {
      toast.error("Failed to upload image: " + error.message);
      setUploadingAvatar(false);
    },
  });

  const {
    data: artistSettings,
    isLoading: isLoadingSettings,
    isError: isErrorSettings,
    error: settingsError,
    refetch: refetchSettings
  } = trpc.artistSettings.get.useQuery(undefined, {
    enabled: !!user && (user.role === "artist" || user.role === "admin"),
    retry: 3,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    // if (!loading && !user) {
    //   setLocation("/login");
    // }
  }, [user, loading, setLocation]);

  const initializedProfileRef = useRef(false);
  const initializedSettingsRef = useRef(false);

  // Initialize Profile state from user once
  if (user && !initializedProfileRef.current) {
    setProfileName(user.name || "");
    setProfilePhone(user.phone || "");
    setProfileBio(user.bio || "");
    setProfileAvatar(user.avatar || "");
    setProfileBirthday(user.birthday || "");
    setProfileAddress(user.address || "");
    setProfileCity(user.city || "");
    initializedProfileRef.current = true;
  }

  // Initialize Business settings state once
  if (artistSettings && !initializedSettingsRef.current) {
    setBusinessName(artistSettings.businessName || "");
    setDisplayName(artistSettings.displayName || "");
    setBusinessEmail(artistSettings.businessEmail || "");
    setBusinessAddress(artistSettings.businessAddress || "");
    setBsb(artistSettings.bsb || "");
    setAccountNumber(artistSettings.accountNumber || "");
    setLicenceNumber(artistSettings.licenceNumber || "");
    setDepositAmount(artistSettings.depositAmount?.toString() || "");
    setAutoSendDepositInfo(!!artistSettings.autoSendDepositInfo);
    initializedSettingsRef.current = true;
  }


  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      name: profileName,
      phone: profilePhone,
      bio: profileBio,
      avatar: profileAvatar,
      birthday: profileBirthday,
      address: profileAddress,
      city: profileCity,
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploadingAvatar(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target?.result as string;

      try {
        const result = await uploadImageMutation.mutateAsync({
          fileName: file.name,
          fileData: base64Data,
          contentType: file.type,
        });

        setProfileAvatar(result.url);
        setUploadingAvatar(false);
      } catch (error) {
        console.error(error);
      }
    };

    reader.onerror = () => {
      toast.error("Failed to read image file");
      setUploadingAvatar(false);
    };

    reader.readAsDataURL(file);
  };

  if (loading) {
    return <LoadingState message="Loading..." fullScreen />;
  }

  const isArtist = user?.role === "artist" || user?.role === "admin";

  const handleSaveBusinessInfo = () => {
    if (artistSettings) {
      upsertArtistSettingsMutation.mutate({
        businessName,
        displayName,
        businessEmail,
        businessAddress,
        bsb,
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

  // --- Sub-View: Booking Link ---
  if (activeSection === "booking-link" && isArtist) {
    return (
      <PageShell>
        <PageHeader title="Booking Link" />
        <div className={tokens.contentContainer.base}>
          <div className="p-6">
            {user && <ArtistLink artistId={user.id} artistName={user.name || "Artist"} />}
          </div>
        </div>
      </PageShell>
    );
  }

  // --- Sub-View: Work Hours --- 
  // WorkHoursAndServices should ideally be migrated to Sheet Layout as well.
  // Since we assume we will migrate it next, we render it directly.
  if (activeSection === "work-hours" && isArtist) {
    return <WorkHoursAndServices onBack={() => navigateToSection("main")} />;
  }

  if (activeSection === "regulation" && isArtist) {
    return <RegulationPage onBack={() => navigateToSection("main")} />;
  }

  if (activeSection === "profile") {
    return (
      <PageShell>
        {/* 1. Page Header - Left aligned, no icons */}
        <PageHeader title="Profile" />

        {/* 2. Top Context Area */}
        <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[20vh] opacity-80">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center overflow-hidden mb-2">
            {profileAvatar ? (
              <img src={getAssetUrl(profileAvatar)} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-white/50" />
            )}
          </div>
        </div>

        {/* 3. Sheet Container */}
        <div className={tokens.contentContainer.base}>
          <div className="flex-1 w-full h-full px-4 pt-6 overflow-y-auto mobile-scroll touch-pan-y">
            <div className="pb-32 max-w-lg mx-auto space-y-6">

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Profile Picture</Label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      id="avatar-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={uploadingAvatar}
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('avatar-upload')?.click()}
                      disabled={uploadingAvatar}
                      className="bg-transparent border-white/10 hover:bg-white/5"
                    >
                      {uploadingAvatar ? 'Uploading...' : 'Upload New Photo'}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Your name"
                    className="bg-white/5 border-white/10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="Your phone number"
                    className="bg-white/5 border-white/10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthday">Birthdate</Label>
                  <Input
                    id="birthday"
                    type="date"
                    value={profileBirthday}
                    onChange={(e) => setProfileBirthday(e.target.value)}
                    className="bg-white/5 border-white/10 [color-scheme:dark]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
                    placeholder="E.g. 123 Main St"
                    rows={2}
                    className="bg-white/5 border-white/10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={profileCity}
                    onChange={(e) => setProfileCity(e.target.value)}
                    placeholder="E.g. Melbourne"
                    className="bg-white/5 border-white/10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    placeholder="Tell us about yourself"
                    rows={4}
                    className="bg-white/5 border-white/10"
                  />
                </div>
              </div>

              <Button
                onClick={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
                className="w-full shadow-lg shadow-primary/20"
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>

            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  if (activeSection === "business" && isArtist) {
    return (
      <PageShell>
        {/* 1. Page Header - Left aligned, no icons */}
        <PageHeader title="Business Info" />

        <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[20vh] opacity-80">
          <p className="text-4xl font-light text-foreground/90 tracking-tight">Business</p>
          <p className="text-muted-foreground text-lg font-medium mt-1">Details & Payments (Confidential)</p>
        </div>

        <div className={tokens.contentContainer.base}>
          <div className="flex-1 w-full h-full px-4 pt-6 overflow-y-auto mobile-scroll touch-pan-y">
            <div className="pb-32 max-w-lg mx-auto space-y-6">

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Your business name"
                    className="bg-white/5 border-white/10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
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
                    onChange={(e) => setBusinessEmail(e.target.value)}
                    placeholder="email@example.com"
                    type="email"
                    className="bg-white/5 border-white/10"
                  />
                  <p className="text-xs text-muted-foreground">
                    This email will be used for sending notifications to clients
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="licenceNumber">Artist License Number <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                  <Input
                    id="licenceNumber"
                    value={licenceNumber}
                    onChange={(e) => setLicenceNumber(e.target.value)}
                    placeholder="E.g. 123456789"
                    className="bg-white/5 border-white/10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Required for generating health regulation logs (e.g. QLD Form 9)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessAddress">Business Address</Label>
                  <Textarea
                    id="businessAddress"
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    placeholder="Your business address"
                    rows={3}
                    className="bg-white/5 border-white/10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Clients will receive a map link to this address on appointment day
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
                <h3 className="font-semibold text-foreground">Usage Settings</h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoSendDeposit">Auto-send Deposit Info</Label>
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
                <h3 className="font-semibold text-foreground">Deposit Payment Settings</h3>

                <div className="space-y-2">
                  <Label htmlFor="bsb">BSB</Label>
                  <Input
                    id="bsb"
                    value={bsb}
                    onChange={(e) => setBsb(e.target.value)}
                    placeholder="123-456"
                    maxLength={7}
                    className="bg-white/5 border-white/10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="12345678"
                    className="bg-white/5 border-white/10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="depositAmount">Deposit Amount (per appointment)</Label>
                  <Input
                    id="depositAmount"
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="100"
                    className="bg-white/5 border-white/10"
                  />
                </div>
              </div>

              <Button
                className="w-full shadow-lg shadow-primary/20"
                onClick={isErrorSettings || (!artistSettings && !isLoadingSettings) ? () => refetchSettings() : handleSaveBusinessInfo}
                disabled={upsertArtistSettingsMutation.isPending || (isLoadingSettings && !isErrorSettings)}
                variant={isErrorSettings ? "destructive" : "default"}
              >
                {upsertArtistSettingsMutation.isPending ? "Saving..." :
                  isLoadingSettings ? "Loading..." :
                    isErrorSettings ? "Retry Loading Data" :
                      !artistSettings ? "Data Unavailable (Retry)" :
                        "Save Business Info"}
              </Button>
              {isErrorSettings && (
                <p className="text-xs text-destructive text-center mt-2">
                  Error: {settingsError?.message || "Could not load settings"}
                </p>
              )}
            </div>
          </div>
        </div>
      </PageShell>
    )
  }

  // --- Main View ---
  return (
    <PageShell>
      {/* 1. Page Header - Left aligned, with version number */}
      <PageHeader
        title="Settings"
        subtitle={`v${APP_VERSION}`}
      />

      {/* 2. Top Context Area (Profile Summary) */}
      <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[20vh] opacity-80">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border-2 border-white/5 shadow-lg">
            {user?.avatar ? (
              <img src={getAssetUrl(user.avatar)} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-white/50" />
            )}
          </div>
          <div>
            <p className="text-xl font-bold text-foreground tracking-tight">{user?.name || "User"}</p>
            <p className="text-sm text-muted-foreground capitalize">{user?.role || "Account"}</p>
          </div>
        </div>
      </div>

      {/* 3. Sheet Container */}
      <div className={tokens.contentContainer.base}>
        <div className="shrink-0 pt-6 pb-2 px-6 border-b border-white/5">
          <h2 className="text-xs font-bold text-muted-foreground tracking-widest uppercase">
            Preferences
          </h2>
        </div>

        <div className="flex-1 w-full h-full px-4 pt-4 overflow-y-auto mobile-scroll touch-pan-y">
          <div className="pb-32 max-w-lg mx-auto space-y-1">

            {/* 1. Account Section */}
            <div className="space-y-3">
              <h3 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-wider">Account</h3>
              <Card className={cn(tokens.card.base, tokens.card.bg, "border-0 p-0 overflow-hidden")}>
                <div className="divide-y divide-white/5">
                  {/* Profile */}
                  <div
                    className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                    onClick={() => navigateToSection("profile")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/20 text-primary">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-foreground">Profile</p>
                        <p className="text-xs text-muted-foreground">Manage personal details</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>

                  {/* Appearance */}
                  <div className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                        {theme === "dark" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-foreground">Appearance</p>
                        <p className="text-xs text-muted-foreground">{theme === "dark" ? "Dark Mode" : "Light Mode"}</p>
                      </div>
                    </div>
                    <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
                  </div>
                </div>
              </Card>
            </div>

            {/* 2. Role Specific Section */}
            <div className="space-y-3 pt-2">
              <h3 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {isArtist ? "Business & Management" : "Bookings"}
              </h3>
              <Card className={cn(tokens.card.base, tokens.card.bg, "border-0 p-0 overflow-hidden")}>
                <div className="divide-y divide-white/5">
                  {!isArtist && (
                    <>
                      {/* Consultations */}
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => setLocation("/consultations")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                            <Calendar className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">Consultations</p>
                            <p className="text-xs text-muted-foreground">Manage booking requests</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>

                      {/* Policies */}
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => setLocation("/policies")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400">
                            <Bell className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">Policies</p>
                            <p className="text-xs text-muted-foreground">View term & conditions</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </>
                  )}

                  {isArtist && (
                    <>
                      {/* Clients */}
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => setLocation("/clients")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-green-500/20 text-green-400">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">Clients</p>
                            <p className="text-xs text-muted-foreground">Manage client list</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>

                      {/* Booking Link */}
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => navigateToSection("booking-link")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                            <Link2 className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">Booking Link</p>
                            <p className="text-xs text-muted-foreground">Share your link</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>

                      {/* Business Info */}
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => navigateToSection("business")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                            <MapPin className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">Business Info</p>
                            <p className="text-xs text-muted-foreground">Set address & payments</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>

                      {/* Work Hours */}
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => navigateToSection("work-hours")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400">
                            <Clock className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">Work Hours & Services</p>
                            <p className="text-xs text-muted-foreground">Manage schedule</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>

                      {/* Regulation */}
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => navigateToSection("regulation")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400">
                            <Scale className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">Regulation & Forms</p>
                            <p className="text-xs text-muted-foreground">Form 9, Medical, Consent</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>

                      {/* Quick Actions */}
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => setLocation("/quick-actions")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-yellow-500/20 text-yellow-400">
                            <Zap className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">Quick Actions</p>
                            <p className="text-xs text-muted-foreground">Chat shortcuts</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>

                      {/* Notifications Page Link */}
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => setLocation("/notifications-management")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                            <Bell className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">Notifications</p>
                            <p className="text-xs text-muted-foreground">Manage templates</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </>
                  )}
                </div>
              </Card>
            </div>

            {/* Notifications Toggle Section (Both Roles - Client only logic preserved for now, but grouping) 
                 Actually, client specific notification toggles were inline. Let's group them or keep them in the main list. 
                 The original had WebPushSettings inline for clients.
             */}
            {/* Notification Preferences (All Roles) */}
            <div className="space-y-3 pt-2">
              <h3 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-wider">Notification Preferences</h3>
              <PushNotificationSettings />
            </div>

            {/* 3. System Section */}
            <div className="space-y-3 pt-2">
              <h3 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-wider">System</h3>
              <Card className={cn(tokens.card.base, tokens.card.bg, "border-0 p-0 overflow-hidden")}>
                <div className="divide-y divide-white/5">
                  {/* UI Debug */}
                  <div className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-slate-500/20 text-slate-400">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-foreground">UI Debug</p>
                        <p className="text-xs text-muted-foreground">Show technical IDs</p>
                      </div>
                    </div>
                    <Switch checked={showDebugLabels} onCheckedChange={setShowDebugLabels} />
                  </div>

                  {/* Updates */}
                  <div
                    className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99] group"
                    onClick={() => {
                      toast.info("Checking for updates...");
                      forceUpdate();
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30 transition-colors">
                        <RefreshCw className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-foreground">Check for Updates</p>
                        <p className="text-xs text-muted-foreground">Force refresh app to latest version</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* 4. Logout (Keep separate) */}
            <div className="pt-4">
              <Card
                className={cn(tokens.card.base, tokens.card.bg, tokens.card.interactive, "border-0 group")}
                onClick={handleLogout}
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-destructive/10 text-destructive group-hover:bg-destructive/20 transition-colors">
                      <LogOut className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-foreground group-hover:text-destructive transition-colors">Log Out</p>
                      <p className="text-xs text-muted-foreground">Sign out of your account</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

          </div>
        </div>
      </div>
    </PageShell>
  );
}
