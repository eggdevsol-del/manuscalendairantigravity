import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
  const utils = trpc.useUtils();
  const [jobId, setJobId] = useState<number>();
  const profile = trpc.merchantAuth.getMerchantProfile.useQuery();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"credentials" | "store" | "status">(
    "credentials"
  );
  const [storeUrl, setStoreUrl] = useState("");
  const progress = trpc.merchantAuth.getSyncStatus.useQuery(jobId ? { jobId } : undefined, {
    enabled: open && step === "status" && !!jobId,
    refetchInterval: query =>
      query.state.data?.status === "complete" || query.state.data?.status === "failed" ? false : 2000,
  });
  const run = trpc.merchantAuth.simulateShopifyImport.useMutation({
    onSuccess: data => {
      setJobId(data.jobId);
      setStep("status");
    },
  });
  useEffect(() => {
    if (progress.data?.status === "complete") {
      void utils.storefront.getProducts.invalidate();
      void utils.merchantAuth.getDashboardStats.invalidate();
    }
  }, [progress.data?.status, utils]);
  if (!profile.data?.shopifySimulatorEnabled) return null;
  return (
    <>
      <Panel>
        <Status>Test mode</Status>
        <h3>Test your Shopify catalogue</h3>
        <p className="v3-muted">
          Simulate sign-in, then import your public store. This does not connect
          or authenticate with Shopify.
        </p>
        <Action
          onClick={() => {
            setJobId(undefined);
            run.reset();
            setStep("credentials");
            setOpen(true);
          }}
        >
          Connect with Shopify
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
            {progress.data?.status !== "complete" && progress.data?.status !== "failed" && (
              <div role="status" aria-live="polite" aria-busy="true" className="v3-stack">
                <Loader2 className="animate-spin" aria-hidden="true" size={32} />
                <h3>Importing your store</h3>
                <p className="v3-muted">{run.data?.storeUrl || storeUrl}</p>
                <p>Fetching products, images and variants, then saving your catalogue. You can close this sheet while the import continues.</p>
              </div>
            )}
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
            {progress.data?.status === "complete" && <ActionLink href="/merchant/products">Review products</ActionLink>}
          </div>
        )}
      </SheetShell>
    </>
  );
}
