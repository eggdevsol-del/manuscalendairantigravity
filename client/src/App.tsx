import React, { Suspense } from "react";
import { Toaster, TooltipProvider } from "@/components/ui";
import { UIDebugProvider } from "@/_core/contexts/UIDebugContext";
import { BottomNavProvider } from "@/contexts/BottomNavContext";

import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { TeaserProvider } from "@/contexts/TeaserContext";
import { SplashScreen } from "@/components/SplashScreen";
import { UpdateBanner } from "@/components/UpdateBanner";
import { InstallAppBanner } from "@/components/InstallAppBanner";
import { useVersionCheck } from "@/lib/useVersionCheck";

const PublicBookingPage = React.lazy(() => import("@/pages/public/PublicBookingPage"));

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

function getRedirectUrlForRole(role: string, path: string = "") {
  const { hostname, port, protocol } = window.location;
  const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

  // Localhost dev setup mapping
  if (LOCAL_HOSTS.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".lvh.me")) {
    const baseHost = hostname.replace(/^(artist|merchant|app)\./, "");
    let subdomain = "";
    if (role === "artist" || role === "admin") subdomain = "artist.";
    if (role === "merchant") subdomain = "merchant.";

    const portStr = port ? `:${port}` : "";
    return `${protocol}//${subdomain}${baseHost}${portStr}${path}`;
  }

  // Production setup mapping
  let subdomain = "app";
  if (role === "artist" || role === "admin") subdomain = "artist";
  if (role === "merchant") subdomain = "merchant";

  return `${protocol}//${subdomain}.tattoi.app${path}`;
}

/**
 * GuardedShell — selects the correct shell based on the logged-in user's role.
 * No subdomain redirects — single entrypoint serves all roles.
 */
function GuardedShell() {
  const { user, loading, isSessionChecked } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    // Only redirect once the me query has fully settled (isFetched).
    // Using !loading alone creates a single-frame gap where loading=false
    // but user hasn't populated yet, causing a premature /login redirect.
    if (isSessionChecked && !loading && !user) {
      setLocation("/login");
    }
  }, [user, loading, isSessionChecked, setLocation]);

  if (loading || !isSessionChecked) return null;
  if (!user) return null;

  const userRole = user.role;
  const isArtist = userRole === "artist" || userRole === "admin";
  const isMerchant = userRole === "merchant";

  if (isArtist) {
    return <ArtistShell />;
  } else if (isMerchant) {
    return <MerchantShell />;
  } else {
    return <ClientShell />;
  }
}

// Known first-segment app routes used by the shells.
// Any path starting with one of these is an authenticated app route, not an artist slug.
const KNOWN_APP_ROUTES = new Set([
  "calendar", "conversations", "chat", "dashboard", "settings",
  "work-hours", "clients", "bank-payouts", "payout-history",
  "notifications-management", "subscriptions", "lead", "admin",
  "profile", "merchant", "discover", "complete-profile",
]);

/**
 * Smart catch-all that disambiguates between app routes and public slug pages.
 * - Known app routes → GuardedShell (handles auth + role-based shell)
 * - Multi-segment paths → GuardedShell
 * - On client app, unknown single-segment paths → public pages (ArtistHub, Storefront, Events)
 * - On artist/merchant apps, everything → GuardedShell
 */
function CatchAllRoute() {
  const [location] = useLocation();
  const { user } = useAuth();

  // Extract the first path segment (e.g. "/calendar" → "calendar", "/shop/xyz" → "shop")
  const segments = location.replace(/^\//, "").split("/");
  const firstSegment = segments[0] || "";

  // For client users (or unauthenticated), route unknown slugs to public pages
  const isClient = !user || user.role === "client";
  if (isClient && firstSegment && !KNOWN_APP_ROUTES.has(firstSegment)) {
    // /shop/:slug → PublicStorefront
    if (firstSegment === "shop" && segments.length >= 2) {
      return <PublicStorefront />;
    }
    // /events/:slug → PublicEvents
    if (firstSegment === "events" && segments.length >= 2) {
      return <PublicEvents />;
    }
    // /:slug (single segment, not a known route) → ArtistHub
    if (segments.length === 1) {
      return <ArtistHub />;
    }
  }

  // Everything else → authenticated shell
  return <GuardedShell />;
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
    location.startsWith("/studio/") ||
    location.startsWith("/book/");

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
        <Route path="/book/:slug">
          <Suspense fallback={null}><PublicBookingPage /></Suspense>
        </Route>
        <Route path="/deposit/:token" component={DepositSheet} />
        <Route path="/balance/:id" component={BalanceSheet} />

        {/* Smart catch-all: app routes vs public slug pages */}
        <Route path="*">
          <CatchAllRoute />
        </Route>
      </Switch>
    </div>
  );
}

/** Only show UpdateBanner + InstallAppBanner when user is signed in */
function AuthOnlyBanners() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <UpdateBanner />
      <InstallAppBanner />
    </>
  );
}

/**
 * RoleThemeWrapper — Reads the user's role from auth and sets the theme.
 * Client users get dark mode, artist/merchant get light mode.
 */
function RoleThemeWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isClient = !user || user.role === "client";
  return (
    <ThemeProvider forceTheme={isClient ? "dark" : "light"}>
      {children}
    </ThemeProvider>
  );
}

function App() {
  // Check client version against server on boot + periodically
  useVersionCheck();

  return (
    <RoleThemeWrapper>
      <TeaserProvider>
        <UIDebugProvider>
          <BottomNavProvider>
            <TooltipProvider>
              <Toaster />
              <AuthOnlyBanners />
              <ErrorBoundary boundary="app-root">
                <Router />
              </ErrorBoundary>
            </TooltipProvider>
          </BottomNavProvider>
        </UIDebugProvider>
      </TeaserProvider>
    </RoleThemeWrapper>
  );
}

export default App;
