import { useAuth } from "@/_core/hooks/useAuth";
import { useUIDebug } from "@/_core/contexts/UIDebugContext";
import { useTheme } from "@/contexts/ThemeContext";
import PushNotificationSettings from "@/components/PushNotificationSettings";
import { getAssetUrl } from "@/lib/assets";

import { Card, Switch } from "@/components/ui";
import { LoadingState, PageShell, PageHeader } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import {
  Bell,
  Calendar,
  ChevronRight,
  Clock,
  Crown,
  Link2,
  LogOut,
  MapPin,
  Moon,
  Sun,
  User,
  Users,
  Zap,
  RefreshCw,
  Scale,
  CreditCard,
  Banknote,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { forceUpdate } from "@/lib/pwa";
import { APP_VERSION } from "@/lib/version";
import { trpc } from "@/lib/trpc";

type SettingsSection =
  | "main"
  | "profile"
  | "work-hours"
  | "quick-actions"
  | "notifications"
  | "business"
  | "booking-link"
  | "regulation";

/** Stripe Connect onboarding row for artist Settings */
function PaymentProcessingSettingsRow() {
  const connectStatus = trpc.artistSettings.getStripeConnectStatus.useQuery();
  const connectStripe = trpc.artistSettings.connectStripe.useMutation();

  const status = connectStatus.data;
  const isConnected = status?.connected && status?.onboardingComplete;
  const isPending = status?.connected && !status?.onboardingComplete;

  const handleClick = async () => {
    try {
      if (isConnected) {
        toast.info("Stripe is connected and active.");
        return;
      }
      toast.info("Connecting to Stripe...");
      const result = await connectStripe.mutateAsync();
      if (result.url) {
        window.location.href = result.url;
      } else if (result.alreadyConnected) {
        toast.success("Stripe account is already connected!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to connect Stripe");
    }
  };

  return (
    <div
      className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
      onClick={handleClick}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-xl",
          isConnected ? "bg-emerald-500/20 text-emerald-400"
            : isPending ? "bg-amber-500/20 text-amber-400"
              : "bg-rose-500/20 text-rose-400"
        )}>
          <Banknote className="w-5 h-5" />
        </div>
        <div className="text-left">
          <p className="font-semibold text-foreground">
            Payment Processing
          </p>
          <p className="text-xs text-muted-foreground">
            {isConnected ? "Stripe Connected ✓"
              : isPending ? "Complete onboarding →"
                : "Connect Stripe to receive payments"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isConnected && (
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        )}
        {isPending && (
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        )}
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showDebugLabels, setShowDebugLabels } = useUIDebug();
  const [location, setLocation] = useLocation();
  const search = useSearch();

  const [activeTab, setActiveTab] = useState<"account" | "business" | "system">(
    "account"
  );

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

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  if (loading) {
    return <LoadingState message="Loading..." fullScreen />;
  }

  const isArtist = user?.role === "artist" || user?.role === "admin";

  // --- Main View ---
  return (
    <PageShell>
      {/* 1. Page Header - Left aligned, with version number */}
      <PageHeader title="Settings" subtitle={`v${APP_VERSION}`} />

      {/* 2. Top Context Area (Profile Summary) */}
      <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[20vh] opacity-80">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border-2 border-white/5 shadow-lg">
            {user?.avatar ? (
              <img
                src={getAssetUrl(user.avatar)}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-8 h-8 text-white/50" />
            )}
          </div>
          <div>
            <p className="text-xl font-bold text-foreground tracking-tight">
              {user?.name || "User"}
            </p>
            <p className="text-sm text-muted-foreground capitalize">
              {user?.role || "Account"}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Grid Content Container */}
      <div className={tokens.contentContainer.base}>
        <div className="flex-1 w-full h-full px-4 pt-4 overflow-y-auto mobile-scroll touch-pan-y">
          <div className="pb-32 w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {/* ACCOUNT SECTION */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider pl-1">
                Account
              </h2>
              <Card
                className={cn(
                  tokens.card.base,
                  tokens.card.bg,
                  "border-0 p-0 overflow-hidden"
                )}
              >
                <div className="divide-y divide-white/5">
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
                        <p className="text-xs text-muted-foreground">
                          Manage personal details
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>

                  <div
                    className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                    onClick={toggleTheme}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl",
                        theme === "noir" ? "bg-amber-500/20 text-amber-400" : "bg-purple-500/20 text-purple-400"
                      )}>
                        {theme === "dark" ? (
                          <Moon className="w-5 h-5" />
                        ) : theme === "noir" ? (
                          <Crown className="w-5 h-5" />
                        ) : (
                          <Sun className="w-5 h-5" />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-foreground">
                          Appearance
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {theme === "dark" ? "Dark Mode" : theme === "noir" ? "Noir Mode" : "Light Mode"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </Card>

              <PushNotificationSettings />
            </div>

            {/* BUSINESS SECTION */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider pl-1">
                Business
              </h2>
              <Card
                className={cn(
                  tokens.card.base,
                  tokens.card.bg,
                  "border-0 p-0 overflow-hidden"
                )}
              >
                <div className="divide-y divide-white/5">
                  {!isArtist && (
                    <>
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => setLocation("/consultations")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                            <Calendar className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">
                              Consultations
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Manage booking requests
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => setLocation("/policies")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400">
                            <Bell className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">
                              Policies
                            </p>
                            <p className="text-xs text-muted-foreground">
                              View term & conditions
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </>
                  )}

                  {isArtist && (
                    <>
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => setLocation("/clients")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-green-500/20 text-green-400">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">
                              Clients
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Manage client list
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => navigateToSection("booking-link")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                            <Link2 className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">
                              Booking Link
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Share your link
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => navigateToSection("business")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                            <MapPin className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">
                              Business Info
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Set address & payments
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                      {(user?.role === "studio" || user?.role === "admin") && (
                        <div
                          className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                          onClick={() => setLocation("/studio")}
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400">
                              <Users className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                              <p className="font-semibold text-foreground">
                                Studio Headquarters
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Manage your team
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => setLocation("/subscriptions")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                            <Zap className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">
                              Subscription & Billing
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Manage your plan
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <PaymentProcessingSettingsRow />
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => navigateToSection("work-hours")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400">
                            <Clock className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">
                              Work Hours & Services
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Manage schedule
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => navigateToSection("regulation")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400">
                            <Scale className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">
                              Regulation & Forms
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Form 9, Medical, Consent
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => setLocation("/quick-actions")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-yellow-500/20 text-yellow-400">
                            <Zap className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">
                              Quick Actions
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Chat shortcuts
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div
                        className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        onClick={() => setLocation("/notifications-management")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                            <Bell className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-foreground">
                              Notifications
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Manage templates
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </>
                  )}
                </div>
              </Card>
            </div>

            {/* SYSTEM SECTION */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider pl-1">
                System
              </h2>
              <Card
                className={cn(
                  tokens.card.base,
                  tokens.card.bg,
                  "border-0 p-0 overflow-hidden"
                )}
              >
                <div className="divide-y divide-white/5">
                  <div className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-slate-500/20 text-slate-400">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-foreground">
                          UI Debug
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Show technical IDs
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={showDebugLabels}
                      onCheckedChange={setShowDebugLabels}
                    />
                  </div>

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
                        <p className="font-semibold text-foreground">
                          Check for Updates
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Force refresh app to latest version
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card
                className={cn(
                  tokens.card.base,
                  tokens.card.bg,
                  tokens.card.interactive,
                  "border-0 group"
                )}
                onClick={handleLogout}
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-destructive/10 text-destructive group-hover:bg-destructive/20 transition-colors">
                      <LogOut className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-foreground group-hover:text-destructive transition-colors">
                        Log Out
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Sign out of your account
                      </p>
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
