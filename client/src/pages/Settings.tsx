import { useAuth } from "@/_core/hooks/useAuth";
import { useUIDebug } from "@/_core/contexts/UIDebugContext";
import PushNotificationSettings from "@/components/PushNotificationSettings";
import { getAssetUrl } from "@/lib/assets";

import { Card, Switch } from "@/components/ui";
import { LoadingState, PageShell, PageHeader } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import {
  Bell,
  ChevronRight,
  Clock,
  Link2,
  LogOut,
  MapPin,
  User,
  Zap,
  RefreshCw,
  Banknote,
  Briefcase,
  Image,
  CreditCard,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { forceUpdate } from "@/lib/pwa";
import { APP_VERSION } from "@/lib/version";
import { trpc } from "@/lib/trpc";

// --- Reusable Settings Row ---
interface SettingsRowProps {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  trailing?: React.ReactNode;
}

function SettingsRow({ icon: Icon, iconColor, title, subtitle, onClick, trailing }: SettingsRowProps) {
  return (
    <div
      className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors cursor-pointer active:scale-[0.99]"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-xl", iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-left">
          <p className="font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {trailing}
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </div>
    </div>
  );
}

// --- Stripe Connect Row ---
function PaymentProcessingRow() {
  const connectStatus = trpc.artistSettings.getStripeConnectStatus.useQuery();
  const [, setLocation] = useLocation();

  const status = connectStatus.data;
  const accountType = status?.accountType || "standard";
  const isConnected = status?.connected && status?.onboardingComplete;
  const isPending = status?.connected && !status?.onboardingComplete;

  return (
    <SettingsRow
      icon={Banknote}
      iconColor={
        isConnected ? "bg-emerald-500/20 text-emerald-400"
          : isPending ? "bg-amber-500/20 text-amber-400"
            : "bg-rose-500/20 text-rose-400"
      }
      title="Payment Processing"
      subtitle={
        isConnected ? "Stripe Connected ✓"
          : isPending && accountType === "custom"
            ? "Complete onboarding →"
            : isPending ? "Complete onboarding →"
              : "Connect Stripe to receive payments"
      }
      onClick={() => setLocation("/wallet")}
      trailing={
        <>
          {isConnected && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
          {isPending && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
        </>
      }
    />
  );
}

// --- Main Settings Page ---
export default function Settings() {
  const { user, loading, logout } = useAuth();
  const { showDebugLabels, setShowDebugLabels } = useUIDebug();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  if (loading) {
    return <LoadingState message="Loading..." fullScreen />;
  }

  const isArtist = user?.role === "artist" || user?.role === "admin";

  return (
    <PageShell>
      <PageHeader title="Settings" subtitle={`v${APP_VERSION}`} />

      {/* Scrollable settings list */}
      <div className="flex-1 overflow-y-auto mobile-scroll px-4 pt-4 pb-32">
        <div className="max-w-lg mx-auto space-y-6">

          {/* ═══ PROFILE & IDENTITY ═══ */}
          <section>
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1 mb-2">
              Profile & Identity
            </h2>
            <Card className={cn(tokens.card.base, tokens.card.bg, "border-0 p-0 overflow-hidden", "settings-card-override")}>
              <div className="divide-y divide-border/30">
                {/* Profile summary at top */}
                <div className="p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-secondary/50 flex items-center justify-center overflow-hidden border border-border">
                    {user?.avatar ? (
                      <img src={getAssetUrl(user.avatar)} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-7 h-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold text-foreground">{user?.name || "User"}</p>
                    <p className="text-sm text-muted-foreground capitalize">{user?.role || "Account"}</p>
                  </div>
                  <ChevronRight
                    className="w-5 h-5 text-muted-foreground cursor-pointer"
                    onClick={() => setLocation("/settings?section=profile")}
                  />
                </div>

                {isArtist && (
                  <>
                    <SettingsRow
                      icon={Image}
                      iconColor="bg-violet-500/20 text-violet-400"
                      title="Portfolio"
                      subtitle="Manage your work gallery"
                      onClick={() => setLocation("/portfolio")}
                    />
                    <SettingsRow
                      icon={Link2}
                      iconColor="bg-purple-500/20 text-purple-400"
                      title="Booking Link"
                      subtitle="Share your link"
                      onClick={() => setLocation("/settings?section=booking-link")}
                    />
                  </>
                )}
              </div>
            </Card>
          </section>

          {/* ═══ BUSINESS (Artist only) ═══ */}
          {isArtist && (
            <section>
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1 mb-2">
                Business
              </h2>
              <Card className={cn(tokens.card.base, tokens.card.bg, "border-0 p-0 overflow-hidden", "settings-card-override")}>
                <div className="divide-y divide-border/30">
                  <SettingsRow
                    icon={MapPin}
                    iconColor="bg-indigo-500/20 text-indigo-400"
                    title="Business Info"
                    subtitle="Address & details"
                    onClick={() => setLocation("/settings?section=business")}
                  />
                  <SettingsRow
                    icon={Clock}
                    iconColor="bg-pink-500/20 text-pink-400"
                    title="Services & Hours"
                    subtitle="Manage schedule & pricing"
                    onClick={() => setLocation("/settings?section=work-hours")}
                  />
                  <SettingsRow
                    icon={User}
                    iconColor="bg-green-500/20 text-green-400"
                    title="Clients"
                    subtitle="Manage client list"
                    onClick={() => setLocation("/clients")}
                  />
                </div>
              </Card>
            </section>
          )}

          {/* ═══ PAYMENTS (Artist only) ═══ */}
          {isArtist && (
            <section>
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1 mb-2">
                Payments
              </h2>
              <Card className={cn(tokens.card.base, tokens.card.bg, "border-0 p-0 overflow-hidden", "settings-card-override")}>
                <div className="divide-y divide-border/30">
                  <PaymentProcessingRow />
                  <SettingsRow
                    icon={CreditCard}
                    iconColor="bg-blue-500/20 text-blue-400"
                    title="Subscription & Billing"
                    subtitle="Manage your plan"
                    onClick={() => setLocation("/subscriptions")}
                  />
                </div>
              </Card>
            </section>
          )}

          {/* ═══ NOTIFICATIONS ═══ */}
          <section>
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1 mb-2">
              Notifications
            </h2>
            <PushNotificationSettings />
          </section>

          {/* ═══ SYSTEM ═══ */}
          <section>
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1 mb-2">
              System
            </h2>
            <Card className={cn(tokens.card.base, tokens.card.bg, "border-0 p-0 overflow-hidden", "settings-card-override")}>
              <div className="divide-y divide-border/30">
                <div className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors">
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
                <div
                  className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors cursor-pointer active:scale-[0.99] group"
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
                      <p className="text-xs text-muted-foreground">Force refresh to latest version</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* ═══ LOG OUT ═══ */}
          <section>
            <Card
              className={cn(tokens.card.base, tokens.card.bg, tokens.card.interactive, "border-0 group", "settings-card-override")}
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
                    <p className="text-xs text-muted-foreground">Sign out of your account</p>
                  </div>
                </div>
              </div>
            </Card>
          </section>

        </div>
      </div>
    </PageShell>
  );
}
