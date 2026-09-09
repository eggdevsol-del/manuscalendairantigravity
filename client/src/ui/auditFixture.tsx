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
                  json:
                    name === "auth.me"
                      ? {
                          id: "ui-audit",
                          role: "artist",
                          name: "A very long studio and artist business name",
                        }
                      : { token: "test" },
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
  const close = () => setKind(kind === "full" ? "sheet" : "page");
  if (kind === "action") return <ActionSheet open onClose={close} title={title}><h2 className="text-xl font-semibold">{title}</h2><Content/></ActionSheet>;
  if (kind === "bottom") return <BottomSheet open onClose={close} title={title}><PageHeader title={title} onBack={close}/><div className="flex-1 min-h-0 overflow-auto p-4"><Content/></div></BottomSheet>;
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
