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

function GuardedShell({ appType }: { appType: "artist" | "client" | "merchant" }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  React.useEffect(() => {
    if (loading || !user) return;

    const userRole = user.role;
    const isArtist = userRole === "artist" || userRole === "admin";
    const isMerchant = userRole === "merchant";
    const isClient = userRole === "client";

    let needsRedirect = false;
    let targetRole = "";

    if (appType === "artist" && !isArtist) {
      needsRedirect = true;
      targetRole = isMerchant ? "merchant" : "client";
    } else if (appType === "merchant" && !isMerchant) {
      needsRedirect = true;
      targetRole = isArtist ? "artist" : "client";
    } else if (appType === "client" && !isClient && (isArtist || isMerchant)) {
      needsRedirect = true;
      targetRole = isArtist ? "artist" : "merchant";
    }

    if (needsRedirect) {
      console.log(`[Router] Redirecting to subdomain matching role: ${targetRole}`);
      window.location.href = getRedirectUrlForRole(targetRole, window.location.pathname + window.location.search);
    }
  }, [user, loading, appType]);

  if (loading) return null;
  if (!user) return null;

  const userRole = user.role;
  const isArtist = userRole === "artist" || userRole === "admin";
  const isMerchant = userRole === "merchant";
  const isClient = userRole === "client";

  const isMismatch =
    (appType === "artist" && !isArtist) ||
    (appType === "merchant" && !isMerchant) ||
    (appType === "client" && !isClient && (isArtist || isMerchant));

  if (isMismatch) return null;

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
function CatchAllRoute({ appType }: { appType: "artist" | "client" | "merchant" }) {
  const [location] = useLocation();

  // Extract the first path segment (e.g. "/calendar" → "calendar", "/shop/xyz" → "shop")
  const segments = location.replace(/^\//, "").split("/");
  const firstSegment = segments[0] || "";

  // On the client app, route unknown slugs to public pages
  if (appType === "client" && firstSegment && !KNOWN_APP_ROUTES.has(firstSegment)) {
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
  return <GuardedShell appType={appType} />;
}

function Router({ appType }: { appType: "artist" | "client" | "merchant" }) {
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

  // Redirect client public pages from artist/merchant subdomains to the client subdomain
  React.useEffect(() => {
    if (appType !== "client") {
      const path = window.location.pathname;
      const isPublicClientPage =
        path.startsWith("/start/") ||
        path.startsWith("/deposit/") ||
        path.startsWith("/balance/") ||
        path.startsWith("/shop/") ||
        path.startsWith("/events/") ||
        path.startsWith("/studio/");

      if (isPublicClientPage) {
        console.log(`[Router] Redirecting public client page to client subdomain`);
        window.location.href = getRedirectUrlForRole("client", path + window.location.search);
      }
    }
  }, [appType, user]);

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

        {/* Single smart catch-all that disambiguates between:
            - Known app routes (calendar, settings, etc.) → GuardedShell
            - Public slug routes on client app (/:slug) → ArtistHub/Storefront
            This avoids the /:slug vs * ordering conflict in Switch. */}
        <Route path="*">
          <CatchAllRoute appType={appType} />
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

function App({ appType = "client" }: { appType?: "artist" | "client" | "merchant" }) {
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
                <Router appType={appType} />
              </ErrorBoundary>
            </TooltipProvider>
          </BottomNavProvider>
        </UIDebugProvider>
      </TeaserProvider>
    </ThemeProvider>
  );
}

export default App;
