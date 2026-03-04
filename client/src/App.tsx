import React from "react";
import { trpc } from "@/lib/trpc";
import { Toaster, TooltipProvider } from "@/components/ui";
import { UIDebugProvider } from "@/_core/contexts/UIDebugContext";
import {
  BottomNavProvider,
  useBottomNav,
  useRegisterFABActions,
} from "@/contexts/BottomNavContext";
import InstallPrompt from "./components/InstallPrompt";
import IOSInstallPrompt from "./components/IOSInstallPrompt";
import BottomNav from "@/components/BottomNav";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTabletLandscape } from "@/hooks/useTabletLandscape";
import { TeaserProvider } from "@/contexts/TeaserContext";
import { useAppointmentCheckIn } from "@/features/appointments/useAppointmentCheckIn";
import { AppointmentCheckInModal } from "@/components/modals/AppointmentCheckInModal";
import { SplashScreen } from "@/components/SplashScreen";

import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Calendar from "./pages/Calendar";
import Settings from "./pages/Settings";
import Conversations from "./pages/Conversations";
import Dashboard from "./pages/Dashboard";
// Portfolio page removed - replaced by Promotions
import Promotions from "./pages/Promotions";

import Consultations from "./pages/Consultations";
import Policies from "./pages/Policies";
import PolicyManagement from "./pages/PolicyManagement";
import NotificationsManagement from "./pages/NotificationsManagement";
import WorkHours from "./pages/WorkHours";
import QuickActionsManagement from "./pages/QuickActionsManagement";
import CompleteProfile from "./pages/CompleteProfile";
import Subscriptions from "./pages/Subscriptions";
import StudioDashboard from "./features/studio/StudioDashboard";
import Clients from "./pages/Clients";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import SetPassword from "./pages/SetPassword";
import ClientProfile from "./pages/ClientProfile";
import { PublicFunnel } from "./pages/funnel";
import PublicStudioFunnel from "./pages/funnel/PublicStudioFunnel";
import { DepositSheet } from "./pages/funnel/DepositSheet";
import LeadDetail from "./pages/LeadDetail";
import { GlobalOnboardingOverlay } from "./features/onboarding/GlobalOnboardingOverlay";

function Router() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const isTabletLandscape = useTabletLandscape();
  const isArtist = user?.role === "artist";

  // Guard routing component
  const GuardedRoute = ({ component: Component, ...rest }: any) => {
    return (
      <Route
        {...rest}
        component={(props: any) => {
          if (!user) {
            setLocation("/login");
            return null;
          }
          return <Component {...props} />;
        }}
      />
    );
  };

  // iOS Cold-Boot Deeplink Failsafe
  // When an iOS PWA is fully asleep and tapped via Push Notification,
  // Apple breaks the sandbox if opened on a deep route instead of root '/'.
  // The service worker passes ?deeplink= in the URL instead.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deeplink = params.get("deeplink");
    if (deeplink) {
      window.history.replaceState({}, document.title, window.location.pathname);
      // Wait a tiny fraction of a second for React layout to mount before navigating
      setTimeout(() => setLocation(deeplink), 50);
    }
  }, [setLocation]);

  // Initialize OneSignal
  React.useEffect(() => {
    import("@/lib/onesignal").then(({ initializeOneSignal }) => {
      initializeOneSignal();
    });
  }, []);

  // Initialize OneSignal user & request push permissions
  React.useEffect(() => {
    if (user?.id) {
      import("@/lib/onesignal").then(
        ({ setExternalUserId, requestNotificationPermission }) => {
          setExternalUserId(user.id).then(() => {
            // Explicitly prompt the user for permission now that they are logged in
            requestNotificationPermission().catch(err => {
              console.error(
                "[OneSignal] Failed to request permission on login:",
                err
              );
            });
          });
        }
      );
    }
  }, [user?.id]);

  const hideBottomNavPaths = [
    "/",
    "/login",
    "/signup",
    "/set-password",
    "/complete-profile",
  ];
  const isPublicFunnel =
    location.startsWith("/start/") ||
    location.startsWith("/deposit/") ||
    location.startsWith("/studio/");
  const shouldShowBottomNav =
    !hideBottomNavPaths.includes(location) &&
    !location.startsWith("/404") &&
    !isPublicFunnel;

  return (
    <div className={`min-h-screen ${shouldShowBottomNav ? "pb-16" : ""}`}>
      <SplashScreen />
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/set-password" component={SetPassword} />
        <Route path="/complete-profile" component={CompleteProfile} />

        {/* Public funnel - no auth required */}
        <Route path="/studio/:slug" component={PublicStudioFunnel} />
        <Route path="/start/:slug" component={PublicFunnel} />
        <Route path="/deposit/:token" component={DepositSheet} />

        {/* Protected Routes */}
        <GuardedRoute path="/conversations" component={Conversations} />
        <GuardedRoute path="/lead/:id" component={LeadDetail} />
        <GuardedRoute path="/chat/:id" component={Chat} />
        <GuardedRoute path="/calendar" component={Calendar} />

        <GuardedRoute path="/dashboard" component={Dashboard} />
        {/* Portfolio routes removed */}
        <GuardedRoute path="/promotions" component={Promotions} />

        <GuardedRoute path="/settings" component={Settings} />
        <GuardedRoute path="/consultations" component={Consultations} />
        <GuardedRoute path="/policies" component={Policies} />
        <GuardedRoute path="/policy-management" component={PolicyManagement} />
        <GuardedRoute
          path="/notifications-management"
          component={NotificationsManagement}
        />
        <GuardedRoute path="/work-hours" component={WorkHours} />
        <GuardedRoute path="/subscriptions" component={Subscriptions} />
        <GuardedRoute path="/studio" component={StudioDashboard} />
        <GuardedRoute path="/quick-actions" component={QuickActionsManagement} />
        <GuardedRoute path="/clients" component={Clients} />
        <GuardedRoute path="/profile" component={ClientProfile} />

        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      {shouldShowBottomNav && <BottomNav />}
      {isArtist && <AppointmentCheckInOverlay />}
      {user && user.hasCompletedOnboarding === 0 && <GlobalOnboardingOverlay />}
    </div>
  );
}

/**
 * Global overlay that shows appointment check-in modals for artists.
 * Now natively hooks into the FAB Menu system for a cleaner UX.
 */
function AppointmentCheckInOverlay() {
  const [dismissed, setDismissed] = React.useState<number | null>(null);
  const { activeCheckIn, updateAppointment } = useAppointmentCheckIn();
  const { setFABOpen } = useBottomNav();

  const activeId = activeCheckIn?.appointment?.id;

  // Reset dismissed state when the active appointment changes
  React.useEffect(() => {
    if (activeId && activeId !== dismissed) {
      setDismissed(null);
      // Automatically open the FAB when a check-in event appears
      setFABOpen(true);
    }
  }, [activeId, dismissed, setFABOpen]);

  const fabContent = React.useMemo(() => {
    if (!activeCheckIn || dismissed === activeCheckIn.appointment.id)
      return null;

    return (
      <div className="w-full flex-1 bg-card border border-border/50 rounded-3xl p-4 shadow-2xl backdrop-blur-xl">
        <AppointmentCheckInModal
          isOpen={!!activeCheckIn}
          checkIn={activeCheckIn}
          onDismiss={() => {
            setDismissed(activeCheckIn.appointment.id);
            setFABOpen(false);
          }}
          updateAppointment={updateAppointment}
        />
      </div>
    );
  }, [activeCheckIn, dismissed, updateAppointment, setFABOpen]);

  return fabContent ? (
    <AppointmentCheckInFABRegistrar content={fabContent} />
  ) : null;
}

function AppointmentCheckInFABRegistrar({
  content,
}: {
  content: React.ReactNode;
}) {
  useRegisterFABActions("appointment-check-in", content);
  return null;
}

/**
 * Wrapper component to conditionally render IOSInstallPrompt
 * Only shows on non-funnel pages (funnel has its own install prompt on success)
 */
function ConditionalIOSInstallPrompt() {
  const [location] = useLocation();
  const isPublicFunnel =
    location.startsWith("/start/") || location.startsWith("/deposit/");

  // Don't render on funnel pages - the funnel handles its own install prompt
  if (isPublicFunnel) {
    return null;
  }

  return <IOSInstallPrompt />;
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" switchable>
      <TeaserProvider>
        <UIDebugProvider>
          <BottomNavProvider>
            <TooltipProvider>
              <Toaster />
              <InstallPrompt />
              <ConditionalIOSInstallPrompt />
              <ErrorBoundary>
                <Router />
              </ErrorBoundary>
            </TooltipProvider>
          </BottomNavProvider>
        </UIDebugProvider>
      </TeaserProvider>
    </ThemeProvider>
  );
}

export default App;
