import React from "react";
import { trpc } from "@/lib/trpc";
import { Toaster, TooltipProvider } from "@/components/ui";
import { UIDebugProvider } from "@/_core/contexts/UIDebugContext";
import { BottomNavProvider, useBottomNav, useRegisterFABActions } from "@/contexts/BottomNavContext";
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
import Clients from "./pages/Clients";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import SetPassword from "./pages/SetPassword";
import ClientProfile from "./pages/ClientProfile";
import { PublicFunnel } from "./pages/funnel";
import { DepositSheet } from "./pages/funnel/DepositSheet";
import LeadDetail from "./pages/LeadDetail";

function Router() {
  const [location] = useLocation();
  const { user } = useAuth();
  const isTabletLandscape = useTabletLandscape();
  const isArtist = user?.role === 'artist';

  // Initialize OneSignal
  React.useEffect(() => {
    import("@/lib/onesignal").then(({ initializeOneSignal }) => {
      initializeOneSignal();
    });
  }, []);

  // Initialize OneSignal user
  React.useEffect(() => {
    if (user?.id) {
      import("@/lib/onesignal").then(({ setExternalUserId }) => {
        setExternalUserId(user.id);
      });
    }
  }, [user?.id]);

  const hideBottomNavPaths = ["/", "/login", "/signup", "/set-password", "/complete-profile"];
  const isPublicFunnel = location.startsWith("/start/") || location.startsWith("/deposit/");
  const shouldShowBottomNav = !hideBottomNavPaths.includes(location) && !location.startsWith("/404") && !isPublicFunnel;

  return (
    <div className={`min-h-screen ${shouldShowBottomNav ? "pb-16" : ""}`}>
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/set-password" component={SetPassword} />
        <Route path="/complete-profile" component={CompleteProfile} />

        {/* Public funnel - no auth required */}
        <Route path="/start/:slug" component={PublicFunnel} />
        <Route path="/deposit/:token" component={DepositSheet} />

        <Route path="/conversations" component={Conversations} />
        <Route path="/lead/:id" component={LeadDetail} />
        <Route path="/chat/:id" component={Chat} />
        <Route path="/calendar" component={Calendar} />

        <Route path="/dashboard" component={Dashboard} />
        {/* Portfolio routes removed */}
        <Route path="/promotions" component={Promotions} />

        <Route path="/settings" component={Settings} />
        <Route path="/consultations" component={Consultations} />
        <Route path="/policies" component={Policies} />
        <Route path="/policy-management" component={PolicyManagement} />
        <Route path="/notifications-management" component={NotificationsManagement} />
        <Route path="/work-hours" component={WorkHours} />
        <Route path="/quick-actions" component={QuickActionsManagement} />
        <Route path="/clients" component={Clients} />
        <Route path="/profile" component={ClientProfile} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      {shouldShowBottomNav && <BottomNav />}
      {isArtist && <AppointmentCheckInOverlay />}

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
    if (!activeCheckIn || dismissed === activeCheckIn.appointment.id) return null;

    return (
      <div className="w-full flex-1">
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

  return fabContent ? <AppointmentCheckInFABRegistrar content={fabContent} /> : null;
}



function AppointmentCheckInFABRegistrar({ content }: { content: React.ReactNode }) {
  useRegisterFABActions("appointment-check-in", content);
  return null;
}

/**
 * Wrapper component to conditionally render IOSInstallPrompt
 * Only shows on non-funnel pages (funnel has its own install prompt on success)
 */
function ConditionalIOSInstallPrompt() {
  const [location] = useLocation();
  const isPublicFunnel = location.startsWith("/start/") || location.startsWith("/deposit/");

  // Don't render on funnel pages - the funnel handles its own install prompt
  if (isPublicFunnel) {
    return null;
  }

  return <IOSInstallPrompt />;
}

function App() {
  return (
    <ThemeProvider
      defaultTheme="dark"
      switchable
    >
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
