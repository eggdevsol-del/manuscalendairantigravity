import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Status,
} from "../design/primitives";
export function ShopifyImportSimulator() {
  const profile = trpc.merchantAuth.getMerchantProfile.useQuery();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"credentials" | "store" | "status">(
    "credentials"
  );
  const [storeUrl, setStoreUrl] = useState("");
  const progress = trpc.merchantAuth.getSyncStatus.useQuery(undefined, {
    enabled: open && step === "status",
    refetchInterval: query =>
      query.state.data?.status === "syncing" ? 2000 : false,
  });
  const run = trpc.merchantAuth.simulateShopifyImport.useMutation({
    onSuccess: () => {
      setStep("status");
      void progress.refetch();
    },
  });
  if (!profile.data?.shopifySimulatorEnabled) return null;
  return (
    <>
      <Panel>
        <Status>Development simulation</Status>
        <h3>Test your Shopify catalogue</h3>
        <p className="v3-muted">
          Simulate sign-in, then import your public store. This does not connect
          or authenticate with Shopify.
        </p>
        <Action
          onClick={() => {
            run.reset();
            setStep("credentials");
            setOpen(true);
          }}
        >
          Shopify sign-in (test)
        </Action>
      </Panel>
      <SheetShell
        isOpen={open}
        onClose={() => {
          if (!run.isPending) setOpen(false);
        }}
        title="Shopify import · test mode"
      >
        {step === "credentials" && (
          <form
            className="v3-form"
            autoComplete="off"
            onSubmit={e => {
              e.preventDefault();
              e.currentTarget.reset();
              setStep("store");
            }}
          >
            <p>
              Enter any dummy values. Do not enter your real Shopify
              credentials. These fields are discarded locally and never sent or
              saved.
            </p>
            <label>
              Dummy username
              <input required autoComplete="off" />
            </label>
            <label>
              Dummy password
              <input required autoComplete="off" type="text" />
            </label>
            <Action type="submit">Continue simulation</Action>
          </form>
        )}
        {step === "store" && (
          <form
            className="v3-form"
            onSubmit={e => {
              e.preventDefault();
              run.mutate({ storeUrl: storeUrl.trim() });
            }}
          >
            <p>
              Enter your public storefront URL. The existing scraper imports
              products for this supplier account; review them before publishing.
            </p>
            <label>
              Store URL
              <input
                required
                value={storeUrl}
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="https://your-store.com"
                onChange={e => setStoreUrl(e.target.value)}
              />
            </label>
            {run.error && <p role="alert">{run.error.message}</p>}
            <Action type="submit" disabled={run.isPending}>
              {run.isPending ? "Queuing import…" : "Import store"}
            </Action>
          </form>
        )}
        {step === "status" && (
          <div className="v3-stack">
            {run.data?.alreadyQueued && (
              <p>
                A catalogue import was already queued. Showing its progress.
              </p>
            )}
            <Feedback
              loading={progress.isLoading}
              error={progress.error}
              onRetry={() => progress.refetch()}
            />
            <p role="status">
              {progress.data?.status === "failed"
                ? progress.data.error
                : progress.data?.status === "complete"
                  ? "Import complete. Review your products before publishing."
                  : (progress.data && "message" in progress.data ? progress.data.message : undefined) ||
                    "Import queued. You can leave this screen while it runs."}
            </p>
            {progress.data?.status === "failed" && (
              <Action
                onClick={() => {
                  run.reset();
                  setStep("store");
                }}
              >
                Try another import
              </Action>
            )}
            <ActionLink href="/merchant/products">Review products</ActionLink>
          </div>
        )}
      </SheetShell>
    </>
  );
}
