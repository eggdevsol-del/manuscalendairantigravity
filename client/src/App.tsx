import React from "react";
import { Toaster, TooltipProvider } from "@/components/ui";
import { UIDebugProvider } from "@/_core/contexts/UIDebugContext";
import { BottomNavProvider } from "@/contexts/BottomNavContext";
import InstallPrompt from "./components/InstallPrompt";
import IOSInstallPrompt from "./components/IOSInstallPrompt";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { TeaserProvider } from "@/contexts/TeaserContext";
import { SplashScreen } from "@/components/SplashScreen";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import SetPassword from "./pages/SetPassword";
import CompleteProfile from "./pages/CompleteProfile";
import PublicStudioFunnel from "./pages/funnel/PublicStudioFunnel";
import { PublicFunnel } from "./pages/funnel";
import { DepositSheet } from "./pages/funnel/DepositSheet";
import { BalanceSheet } from "./pages/funnel/BalanceSheet";
import PublicStorefront from "./pages/public/PublicStorefront";
import PublicEvents from "./pages/public/PublicEvents";
import ArtistHub from "./pages/public/ArtistHub";

import ArtistShell from "./shells/ArtistShell";
import ClientShell from "./shells/ClientShell";
import MerchantShell from "./shells/MerchantShell";

function GuardedShell() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  if (loading) return null;
  if (!user) return null;

  if (user.role === "artist" || user.role === "admin") {
    return <ArtistShell />;
  } else if (user.role === "merchant") {
    return <MerchantShell />;
  } else {
    return <ClientShell />;
  }
}

function Router() {
  const [location] = useLocation();
  const { user } = useAuth();

  // iOS Cold-Boot Deeplink Failsafe
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deeplink = params.get("deeplink");
    if (deeplink) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => {
        window.location.href = deeplink;
      }, 50);
    }
  }, []);

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

  const isPublicFunnel =
    location.startsWith("/start/") ||
    location.startsWith("/deposit/") ||
    location.startsWith("/balance/") ||
    location.startsWith("/studio/");

  return (
    <div className="min-h-screen">
      {!isPublicFunnel && <SplashScreen />}
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
        <Route path="/balance/:id" component={BalanceSheet} />

        {/* Dynamic Slug Route for Artist Hub */}
        <Route path="/shop/:slug" component={PublicStorefront} />
        <Route path="/events/:slug" component={PublicEvents} />
        <Route path="/:slug" component={ArtistHub} />

        {/* Fallback to GuardedShell for all app routes */}
        <Route path="*">
          <GuardedShell />
        </Route>
      </Switch>
    </div>
  );
}

function ConditionalIOSInstallPrompt() {
  const [location] = useLocation();
  const isPublicFunnel =
    location.startsWith("/start/") || location.startsWith("/deposit/");

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
              <ErrorBoundary boundary="app-root">
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
