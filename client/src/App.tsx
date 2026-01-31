import { Toaster, TooltipProvider } from "@/components/ui";
import { UIDebugProvider } from "@/_core/contexts/UIDebugContext";
import { BottomNavProvider } from "@/contexts/BottomNavContext";
import InstallPrompt from "./components/InstallPrompt";
import IOSInstallPrompt from "./components/IOSInstallPrompt";
import IOSInstallPrompt from "./components/IOSInstallPrompt";
import BottomNav from "@/components/BottomNav";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTabletLandscape } from "@/hooks/useTabletLandscape";
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

  const hideBottomNavPaths = ["/", "/login", "/signup", "/set-password", "/complete-profile"];
  const isPublicFunnel = location.startsWith("/start/") || location.startsWith("/deposit/");
  const shouldShowBottomNav = !hideBottomNavPaths.includes(location) && !location.startsWith("/404") && !isPublicFunnel && !(isArtist && isTabletLandscape);

  return (
    <div className={`min-h-screen ${shouldShowBottomNav ? "pb-16" : ""}`}>
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/set-password" component={SetPassword} />

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
    </div>
  );
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
    </ThemeProvider>
  );
}

export default App;
