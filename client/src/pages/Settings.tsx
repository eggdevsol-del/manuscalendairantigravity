import { useAuth } from "@/_core/hooks/useAuth";
import { useUIDebug } from "@/_core/contexts/UIDebugContext";
import { useTheme } from "@/contexts/ThemeContext";
import DemoDataLoader from "./DemoDataLoader";
import PushNotificationSettings from "@/components/PushNotificationSettings";
import WorkHoursAndServices from "./WorkHoursAndServices";
import ArtistLink from "@/components/ArtistLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { LoadingState, PageShell, PageHeader, GlassSheet } from "@/components/ui/ssot";
import { trpc } from "@/lib/trpc";
import {
  Bell,
  Calendar,
  ChevronRight,
  Clock,
  LogOut,
  MapPin,
  Moon,
  Sun,
  User,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { forceUpdate } from "@/lib/pwa";
import { RefreshCw } from "lucide-react";
import { APP_VERSION } from "@/lib/version";

type SettingsSection = "main" | "profile" | "work-hours" | "quick-actions" | "notifications" | "business";

export default function Settings() {
  const { user, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showDebugLabels, setShowDebugLabels } = useUIDebug();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState<SettingsSection>("main");

  // Profile state
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Business settings state
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [bsb, setBsb] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [autoSendDepositInfo, setAutoSendDepositInfo] = useState(false);

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

  const { data: artistSettings } = trpc.artistSettings.get.useQuery(undefined, {
    enabled: !!user && (user.role === "artist" || user.role === "admin"),
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    // if (!loading && !user) {
    //   setLocation("/login");
    // }
  }, [user, loading, setLocation]);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || "");
      setProfilePhone(user.phone || "");
      setProfileBio(user.bio || "");
      setProfileAvatar(user.avatar || "");
    }
  }, [user]);

  useEffect(() => {
    if (artistSettings) {
      setBusinessName(artistSettings.businessName || "");
      setBusinessAddress(artistSettings.businessAddress || "");
      setBsb(artistSettings.bsb || "");
      setAccountNumber(artistSettings.accountNumber || "");
      setDepositAmount(artistSettings.depositAmount?.toString() || "");
      setAutoSendDepositInfo(!!artistSettings.autoSendDepositInfo);
    }
  }, [artistSettings]);

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
        businessAddress,
        bsb,
        accountNumber,
        depositAmount: depositAmount ? parseInt(depositAmount) : undefined,
        autoSendDepositInfo: autoSendDepositInfo,
        workSchedule: artistSettings.workSchedule,
        services: artistSettings.services,
      });
    }
  };

  // --- Sub-View: Work Hours --- 
  // WorkHoursAndServices should ideally be migrated to Sheet Layout as well.
  // Since we assume we will migrate it next, we render it directly.
  if (activeSection === "work-hours" && isArtist) {
    return <WorkHoursAndServices onBack={() => setActiveSection("main")} />;
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
              <img src={profileAvatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-white/50" />
            )}
          </div>
        </div>

        {/* 3. Sheet Container */}
        <GlassSheet className="bg-white/5">
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
        </GlassSheet>
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

        <GlassSheet className="bg-white/5">
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
                onClick={handleSaveBusinessInfo}
                disabled={upsertArtistSettingsMutation.isPending}
              >
                {upsertArtistSettingsMutation.isPending ? "Saving..." : "Save Business Info"}
              </Button>
            </div>
          </div>
        </GlassSheet>
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
              <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
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
      <GlassSheet className="bg-white/5">
        <div className="shrink-0 pt-6 pb-2 px-6 border-b border-white/5">
          <h2 className="text-xs font-bold text-muted-foreground tracking-widest uppercase">
            Preferences
          </h2>
        </div>

        <div className="flex-1 w-full h-full px-4 pt-4 overflow-y-auto mobile-scroll touch-pan-y">
          <div className="pb-32 max-w-lg mx-auto space-y-4">

            <Card className="cursor-pointer hover:bg-white/10 transition-colors border-0 bg-white/5 rounded-2xl" onClick={() => setActiveSection("profile")}>
              <div className="p-4 flex items-center justify-between">
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
            </Card>

            <Card className="border-0 bg-white/5 rounded-2xl overflow-hidden">
              <div className="p-4 flex items-center justify-between">
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
            </Card>

            {!isArtist && (
              <>
                <Card className="cursor-pointer hover:bg-white/10 transition-colors border-0 bg-white/5 rounded-2xl" onClick={() => setLocation("/consultations")}>
                  <div className="p-4 flex items-center justify-between">
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
                </Card>
                <Card className="cursor-pointer hover:bg-white/10 transition-colors border-0 bg-white/5 rounded-2xl" onClick={() => setLocation("/policies")}>
                  <div className="p-4 flex items-center justify-between">
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
                </Card>
              </>
            )}

            {isArtist && (
              <>
                <Card className="cursor-pointer hover:bg-white/10 transition-colors border-0 bg-white/5 rounded-2xl" onClick={() => setLocation("/clients")}>
                  <div className="p-4 flex items-center justify-between">
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
                </Card>

                {user && <ArtistLink artistId={user.id} artistName={user.name || "Artist"} />}

                <Card className="cursor-pointer hover:bg-white/10 transition-colors border-0 bg-white/5 rounded-2xl" onClick={() => setActiveSection("business")}>
                  <div className="p-4 flex items-center justify-between">
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
                </Card>

                <Card className="cursor-pointer hover:bg-white/10 transition-colors border-0 bg-white/5 rounded-2xl" onClick={() => setActiveSection("work-hours")}>
                  <div className="p-4 flex items-center justify-between">
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
                </Card>

                <Card className="cursor-pointer hover:bg-white/10 transition-colors border-0 bg-white/5 rounded-2xl" onClick={() => setLocation("/quick-actions")}>
                  <div className="p-4 flex items-center justify-between">
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
                </Card>

                <Card className="cursor-pointer hover:bg-white/10 transition-colors border-0 bg-white/5 rounded-2xl" onClick={() => setLocation("/notifications-management")}>
                  <div className="p-4 flex items-center justify-between">
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
                </Card>
              </>
            )}

            {isArtist && <DemoDataLoader />}

            <Card className="border-0 bg-white/5 rounded-2xl overflow-hidden">
              <div className="p-4 flex items-center justify-between">
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
            </Card>

            <Card 
              className="cursor-pointer hover:bg-blue-500/10 transition-colors border-0 bg-white/5 rounded-2xl group" 
              onClick={() => {
                toast.info("Checking for updates...");
                forceUpdate();
              }}
            >
              <div className="p-4 flex items-center justify-between">
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
            </Card>

            <Card className="cursor-pointer hover:bg-destructive/10 transition-colors border-0 bg-white/5 rounded-2xl group" onClick={handleLogout}>
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
      </GlassSheet>
    </PageShell>
  );
}
