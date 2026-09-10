import Dashboard from "@/pages/Dashboard";
import ProjectSummary from "@/features/bookings/ProjectSummary";
import BookingsPage from "@/features/bookings/BookingsPage";
import { MerchantProducts } from "@/features/merchant/Products";
import { MerchantOrders } from "@/features/merchant/Orders";
import { BottomNavProvider } from "@/contexts/BottomNavContext";
import { TeaserProvider } from "@/contexts/TeaserContext";
import { TooltipTourProvider, TooltipOverlay } from "@/components/tooltip-tour";
import BottomNav from "@/components/BottomNav";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
/** Development-only layout fixture; not imported by the production entry point. */
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { UIDebugProvider } from "@/_core/contexts/UIDebugContext";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { FullScreenSheet } from "@/components/ui/ssot/FullScreenSheet";
import { BottomSheet, ActionSheet } from "@/components/ui/ssot/BottomSheet";
import { HalfSheet } from "@/components/ui/ssot/HalfSheet";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { ModalShell } from "@/components/ui/overlays/modal-shell";
import { Button, Input } from "@/components/ui";
import "@/index.css";
const params = new URLSearchParams(location.search);
const initialKind = params.get("kind") || "page";
const fixtureRole = params.get("role") || "artist";
const fixtureLocation = memoryLocation({
  path: initialKind === "project" ? "/projects/42" : "/dashboard",
});
if (
  (initialKind.startsWith("launch") || initialKind === "project") &&
  params.get("tour") !== "on"
)
  localStorage.setItem(
    "manus_completed_tours",
    JSON.stringify(["dashboard-overview", "profile-onboarding"])
  );
const fixtureSession = {
  id: 1,
  title: "Botanical sleeve",
  startTime: "2026-09-10 01:00:00",
  endTime: "2026-09-10 05:00:00",
  timeZone: "Australia/Brisbane",
  conversationId: 42,
  status: "confirmed",
  paymentStatus: "deposit_paid",
  price: 800,
  totalExpectedAmountCents: 80000,
  totalPaidAmountCents: 20000,
  remainingBalanceCents: 60000,
  client: { id: "client-qa", name: "Alex Morgan" },
};
function fixtureData(name: string): unknown {
  if (name === "auth.me")
    return {
      id: "ui-audit",
      role: fixtureRole,
      name: "A very long studio and artist business name",
      hasCompletedOnboarding: 1,
    };
  if (name === "auth.refreshToken") return { token: "test" };
  if (name === "projects.summary")
    return {
      conversationId: 42,
      artist: { name: "Jules Ink" },
      client: { name: "Alex Morgan" },
      location: "Brisbane studio",
      sessions: [
        {
          id: 1,
          title: "Botanical sleeve · first session",
          startsAt: "2026-09-10T01:00:00Z",
          status: "confirmed",
          paymentStatus: "deposit_paid",
          estimateCents: 80000,
          paidCents: 20000,
          remainingCents: 60000,
        },
      ],
      plans: [],
      history: [],
      forms: [
        { id: 1, appointmentId: 1, title: "Consent form", status: "pending" },
      ],
      briefs: [
        {
          id: 1,
          subject: "Botanical sleeve",
          description:
            "A flowing botanical sleeve with Australian native flowers. Please leave space around my existing tattoo.",
        },
      ],
      references: [],
    };
  if (name === "forms.getPendingForms")
    return [
      {
        id: 1,
        appointmentId: 1,
        title: "Consent form",
        formType: "procedure_consent",
        content: "Sample form for layout testing only.",
        status: "pending",
      },
    ];
  if (name === "dashboard.getArtistOverview")
    return {
      todayTimeline: [fixtureSession],
      nextAppointment: fixtureSession,
      stats: {},
    };
  if (name === "dashboard.getClientSessions") return [];
  if (name === "dashboardTasks.getBusinessTasks") return { tasks: [] };
  if (name === "conversations.list")
    return [{ id: 42, otherUser: { name: "Jules Ink" }, unreadCount: 1 }];
  if (name === "payouts.earningsBreakdown") return { netCents: 235000 };
  if (name === "payouts.nextPayout") return { nextPayoutAmountCents: 50000 };
  if (name === "merchantAuth.getMerchantProfile")
    return { businessName: "Studio Supply Co", country: "AU" };
  if (name === "merchantAuth.getDashboardStats")
    return {
      revenueCents: 160000,
      pendingOrders: 3,
      lowStockItems: 2,
      completedOrders: 8,
    };
  if (name === "merchantAuth.getMerchantStripeStatus")
    return { connected: true, chargesEnabled: true, payoutsEnabled: true };
  if (name === "storefront.getProducts")
    return [
      {
        id: 1,
        title: "Aftercare balm",
        description: "Fragrance-free aftercare balm",
        priceCents: 2500,
        stockQuantity: 20,
        isActive: true,
        fulfillmentType: "delivery",
        variants: [],
      },
    ];
  if (name === "storefront.getOrders") return [];
  if (/getSettings|artistSettings/.test(name)) return {};
  return [];
}
const title = "Booking review and payment details for a long project name";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const client = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch: async input => {
        const names = String(input).split("/").pop()!.split("?")[0].split(",");
        return new Response(
          JSON.stringify(
            names.map(name => ({
              result: {
                data: {
                  json: fixtureData(name),
                },
              },
            }))
          ),
          { headers: { "Content-Type": "application/json" } }
        );
      },
    }),
  ],
});
const noop = () => {};
function Content() {
  return (
    <div data-audit-content className="space-y-4">
      {Array.from({ length: 24 }, (_, i) => (
        <section key={i} className="rounded-2xl border bg-card p-4">
          <h2 className="text-lg font-semibold">Session {i + 1}</h2>
          <label>
            Appointment notes
            <Input placeholder="Enter appointment details" />
          </label>
        </section>
      ))}
      <Button data-audit-last>Confirm final session</Button>
    </div>
  );
}
function Fixture() {
  const [kind, setKind] = React.useState(initialKind);
  const live =
    initialKind === "project" ? (
      <ProjectSummary />
    ) : initialKind === "launch-dashboard" ? (
      <Dashboard />
    ) : initialKind === "launch-bookings" ? (
      <BookingsPage />
    ) : initialKind === "launch-products" ? (
      <MerchantProducts />
    ) : initialKind === "launch-orders" ? (
      <MerchantOrders />
    ) : null;
  if (live)
    return (
      <Router hook={fixtureLocation.hook}>
        <TooltipTourProvider>
          <TeaserProvider>
            <BottomNavProvider>
              {live}
              <BottomNav />
              <TooltipOverlay />
            </BottomNavProvider>
          </TeaserProvider>
        </TooltipTourProvider>
      </Router>
    );
  const close = () => setKind(kind === "full" ? "sheet" : "page");
  if (kind === "action")
    return (
      <ActionSheet open onClose={close} title={title}>
        <h2 className="text-xl font-semibold">{title}</h2>
        <Content />
      </ActionSheet>
    );
  if (kind === "bottom")
    return (
      <BottomSheet open onClose={close} title={title}>
        <PageHeader title={title} onBack={close} />
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <Content />
        </div>
      </BottomSheet>
    );
  if (kind === "full")
    return (
      <FullScreenSheet open onClose={close} title={title} contextTitle="Review">
        <Content />
      </FullScreenSheet>
    );
  if (kind === "half")
    return (
      <HalfSheet open onClose={close} title={title}>
        <Content />
      </HalfSheet>
    );
  if (kind === "sheet" || kind === "side")
    return (
      <SheetShell
        isOpen
        onClose={close}
        title={title}
        side={kind === "side" ? "right" : "bottom"}
      >
        <Content />
      </SheetShell>
    );
  if (kind === "modal")
    return (
      <ModalShell isOpen onClose={close} title={title}>
        <Content />
      </ModalShell>
    );
  if (kind === "document")
    return (
      <main className="app-document">
        <PageHeader title={title} onBack={noop} />
        <Content />
      </main>
    );
  return (
    <PageShell>
      <PageHeader
        title={title}
        subtitle="Long studio name and account settings"
        onBack={noop}
      />
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <Content />
      </div>
    </PageShell>
  );
}
createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={client} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        defaultTheme={params.get("theme") === "dark" ? "dark" : "light"}
      >
        <UIDebugProvider>
          <Fixture />
        </UIDebugProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
