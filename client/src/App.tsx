import { Toaster } from "@/components/ui/sonner";
import { UIDebugProvider } from "@/_core/contexts/UIDebugContext";
import { BottomNavProvider } from "@/contexts/BottomNavContext";
import InstallPrompt from "./components/InstallPrompt";
import IOSInstallPrompt from "./components/IOSInstallPrompt";
import { TooltipProvider } from "@/components/ui/tooltip";
import BottomNav from "@/components/BottomNav";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Calendar from "./pages/Calendar";
import Settings from "./pages/Settings";
import Conversations from "./pages/Conversations";
import Dashboard from "./pages/Dashboard";
import Portfolio from "./pages/Portfolio";
import Wallet from "./pages/Wallet";

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
import ClientProfile from "./pages/ClientProfile";

function Router() {
  const [location] = useLocation();
  const hideBottomNavPaths = ["/", "/login", "/signup", "/complete-profile"];
  const shouldShowBottomNav = !hideBottomNavPaths.includes(location) && !location.startsWith("/404");

  return (
    <div className={`min-h-screen ${shouldShowBottomNav ? "pb-16" : ""}`}>
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />

        <Route path="/conversations" component={Conversations} />
        <Route path="/chat/:id" component={Chat} />
        <Route path="/calendar" component={Calendar} />

        <Route path="/dashboard" component={Dashboard} />
        <Route path="/portfolio" component={Portfolio} />
        <Route path="/explore" component={Portfolio} />
        <Route path="/wallet" component={Wallet} />

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
            <IOSInstallPrompt />
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

