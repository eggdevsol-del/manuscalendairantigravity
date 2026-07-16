import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useUIDebug } from "@/_core/contexts/UIDebugContext";
import { Card, Switch } from "@/components/ui";
import { LoadingState, PageShell, PageHeader, UserAvatar } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Banknote,
  Bell,
  BookOpen,
  ChevronRight,
  Clock,
  CreditCard,
  Database,
  FileText,
  Image,
  Link2,
  LogOut,
  MapPin,
  Plane,
  RefreshCw,
  Store,

  Users,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { forceUpdate } from "@/lib/pwa";
import { APP_VERSION } from "@/lib/version";
import { trpc } from "@/lib/trpc";

// ── Settings sub-panels ──────────────────────────────────────────────────────
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { BusinessSettings } from "@/components/settings/BusinessSettings";
import { WorkHoursAndServicesSettings } from "@/components/settings/WorkHoursAndServicesSettings";
import { PortfolioSettings } from "@/components/settings/PortfolioSettings";
import { FunnelSettings } from "@/components/FunnelSettings";
import { RegulationSettings } from "@/components/settings/RegulationSettings";
import { ConsultationSettings } from "@/components/settings/ConsultationSettings";
import { DataImportSettings } from "@/components/settings/DataImportSettings";
import { TravelSettings } from "@/components/settings/TravelSettings";
import { DangerZoneSettings } from "@/components/settings/DangerZoneSettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { StudioDashboardSettings } from "@/components/settings/StudioDashboardSettings";
import StorefrontSetupWizard from "@/features/storefront/StorefrontSetupWizard";

// ── Valid section keys ───────────────────────────────────────────────────────
type SettingsSection =
  | "profile"
  | "portfolio"
  | "storefront"
  | "booking-link"
  | "business"
  | "work-hours"
  | "travel"
  | "data-import"
  | "regulation"
  | "consultations"
  | "studio"
  | "notifications"
  | "danger-zone";

// ── Reusable row ─────────────────────────────────────────────────────────────
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

// ── Stripe Connect status row ─────────────────────────────────────────────────
function PaymentProcessingRow() {
  const connectStatus = trpc.artistSettings.getStripeConnectStatus.useQuery();
  const [, setLocation] = useLocation();

  const status = connectStatus.data;
  const isConnected = status?.connected && status?.onboardingComplete;
  const isPending   = status?.connected && !status?.onboardingComplete;

  return (
    <SettingsRow
      icon={Banknote}
      iconColor={
        isConnected ? "bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)]"
          : isPending ? "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)]"
            : "bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-text)]"
      }
      title="Payment Processing"
      subtitle={
        isConnected ? "Stripe Connected ✓"
          : isPending ? "Complete onboarding →"
            : "Connect Stripe to receive payments"
      }
      onClick={() => setLocation("/bank-payouts")}
      trailing={
        <>
          {isConnected && <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse" />}
          {isPending   && <span className="w-2 h-2 rounded-full bg-[var(--color-warning)] animate-pulse" />}
        </>
      }
    />
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Settings() {
  const { user, loading, logout } = useAuth();
  const { showDebugLabels, setShowDebugLabels } = useUIDebug();
  const [, setLocation] = useLocation(); // for cross-page nav (logout, /clients, etc.)
  // Section state — pure local state, no URL involved.
  // nav(s) sets the section; handleBack() resets it.
  // Using pure local state avoids any wouter routing side-effects.
  const [section, setSection] = React.useState<SettingsSection | null>(null);

  // nav() updates section state directly — guaranteed re-render.
  const nav = (s: SettingsSection) => () => setSection(s);
  const handleBack = () => setSection(null);

  if (loading) return <LoadingState message="Loading..." fullScreen />;

  const isArtist = user?.role === "artist" || user?.role === "admin";
  const isStudio = user?.role === "studio"  || user?.role === "admin";

  if (section) {
    const panel = (() => {
      switch (section) {
        case "profile":       return <ProfileSettings onBack={handleBack} />;
        case "portfolio":     return <ProfileSettings onBack={handleBack} />;
        case "storefront":    return <StorefrontSetupWizard onClose={handleBack} />;
        case "booking-link":  return <FunnelSettings onBack={handleBack} />;
        case "business":      return <BusinessSettings onBack={handleBack} />;
        case "work-hours":    return <WorkHoursAndServicesSettings onBack={handleBack} />;
        case "travel":        return <TravelSettings onBack={handleBack} onNavigateToClients={() => setLocation("/clients")} />;
        case "data-import":   return <DataImportSettings onBack={handleBack} />;
        case "regulation":    return <RegulationSettings onBack={handleBack} />;
        case "consultations": return <ConsultationSettings onBack={handleBack} />;
        case "studio":        return (isStudio) ? <StudioDashboardSettings onBack={handleBack} /> : null;
        case "notifications": return <NotificationSettings onBack={handleBack} />;
        case "danger-zone":   return <DangerZoneSettings onBack={handleBack} />;
        default:              return null;
      }
    })();

    // Settings components render their own header with back button.
    // PageShell provides the full-height flex container.
    return <PageShell>{panel}</PageShell>;
  }

  // ── MAIN LIST MODE ───────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <PageShell>
      <PageHeader title="Settings" subtitle={`v${APP_VERSION}`} />

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto mobile-scroll px-4 pt-2 pb-32">
        <div className="max-w-lg mx-auto space-y-6">

          {/* ═══ PROFILE & IDENTITY ═══ */}
          <section>
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1 mb-2">
              Profile & Identity
            </h2>
            <Card className={cn(tokens.card.base, tokens.card.bg, "border-0 p-0 overflow-hidden", "settings-card-override")}>
              <div className="divide-y divide-border/30">
                {/* Avatar summary row */}
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={isArtist ? nav("profile") : () => setLocation("/profile")}
                >
                  <UserAvatar name={user?.name} avatar={user?.avatar} size="xl" />
                  <div className="flex-1">
                    <p className="text-base font-bold text-foreground">{user?.name || "User"}</p>
                    <p className="text-sm text-muted-foreground capitalize">{user?.role || "Account"}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>

                {isArtist && (
                  <>
                    <SettingsRow
                      icon={Image}
                      iconColor="bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)]"
                      title="Portfolio"
                      subtitle="Manage your work gallery"
                      onClick={nav("portfolio")}
                    />
                    <SettingsRow
                      icon={Store}
                      iconColor="bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)]"
                      title="Storefront"
                      subtitle="Your public profile page"
                      onClick={nav("storefront")}
                    />
                    <SettingsRow
                      icon={Link2}
                      iconColor="bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)]"
                      title="Booking Link"
                      subtitle="Share your booking link"
                      onClick={nav("booking-link")}
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
                    iconColor="bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)]"
                    title="Business Info"
                    subtitle="Address & details"
                    onClick={nav("business")}
                  />
                  <SettingsRow
                    icon={Clock}
                    iconColor="bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-text)]"
                    title="Services & Hours"
                    subtitle="Manage schedule & pricing"
                    onClick={nav("work-hours")}
                  />
                  <SettingsRow
                    icon={Plane}
                    iconColor="bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)]"
                    title="Travel Dates"
                    subtitle="Guest spots & travel"
                    onClick={nav("travel")}
                  />
                  <SettingsRow
                    icon={Users}
                    iconColor="bg-[var(--color-status-success-bg)] text-[var(--color-success)]"
                    title="Clients"
                    subtitle="Manage client list"
                    onClick={() => setLocation("/clients")}
                  />
                  <SettingsRow
                    icon={Database}
                    iconColor="bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)]"
                    title="Import Clients"
                    subtitle="Upload a CSV file"
                    onClick={nav("data-import")}
                  />
                  <SettingsRow
                    icon={FileText}
                    iconColor="bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)]"
                    title="Regulation & Forms"
                    subtitle="Health & consent forms"
                    onClick={nav("regulation")}
                  />
                  <SettingsRow
                    icon={BookOpen}
                    iconColor="bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)]"
                    title="Consultations"
                    subtitle="Intake & consult settings"
                    onClick={nav("consultations")}
                  />
                  {isStudio && (
                    <SettingsRow
                      icon={Users}
                      iconColor="bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-text)]"
                      title="Studio Headquarters"
                      subtitle="Manage your studio"
                      onClick={nav("studio")}
                    />
                  )}
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
                    iconColor="bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)]"
                    title="Subscription & Billing"
                    subtitle="Manage your plan"
                    onClick={() => setLocation("/subscriptions")}
                  />
                </div>
              </Card>
            </section>
          )}

          {/* ═══ PREFERENCES ═══ */}
          <section>
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1 mb-2">
              Preferences
            </h2>
            <Card className={cn(tokens.card.base, tokens.card.bg, "border-0 p-0 overflow-hidden", "settings-card-override")}>
              <div className="divide-y divide-border/30">
                <SettingsRow
                  icon={Bell}
                  iconColor="bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)]"
                  title="Notifications"
                  subtitle="Push & alert preferences"
                  onClick={nav("notifications")}
                />
                {/* UI Debug toggle */}
                <div className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-background0/20 text-muted-foreground">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-foreground">UI Debug</p>
                      <p className="text-xs text-muted-foreground">Show technical IDs</p>
                    </div>
                  </div>
                  <Switch checked={showDebugLabels} onCheckedChange={setShowDebugLabels} />
                </div>
              </div>
            </Card>
          </section>

          {/* ═══ SYSTEM ═══ */}
          <section>
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1 mb-2">
              System
            </h2>
            <Card className={cn(tokens.card.base, tokens.card.bg, "border-0 p-0 overflow-hidden", "settings-card-override")}>
              <div className="divide-y divide-border/30">
                {/* Check for updates */}
                <div
                  className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors cursor-pointer active:scale-[0.99] group"
                  onClick={() => {
                    toast.info("Checking for updates...");
                    forceUpdate();
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)] group-hover:bg-blue-500/30 transition-colors">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-foreground">Check for Updates</p>
                      <p className="text-xs text-muted-foreground">Force refresh to latest version</p>
                    </div>
                  </div>
                </div>
                {/* Danger Zone */}
                <SettingsRow
                  icon={AlertTriangle}
                  iconColor="bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-text)]"
                  title="Danger Zone"
                  subtitle="Delete account & data"
                  onClick={nav("danger-zone")}
                />
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
