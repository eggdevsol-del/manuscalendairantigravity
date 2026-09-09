import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Input, Label } from "@/components/ui";
export function ShopifySyncTier() {
  const utils = trpc.useUtils();
  const profile = trpc.merchantAuth.getMerchantProfile.useQuery();
  const progress = trpc.merchantAuth.getSyncStatus.useQuery(undefined, {
    refetchInterval: query =>
      query.state.data?.status === "syncing" ? 3000 : 10000,
  });
  const [domain, setDomain] = useState(""),
    [token, setToken] = useState(""),
    [edit, setEdit] = useState(false);
  const save = trpc.merchantAuth.saveShopifyCredentials.useMutation({
    onSuccess: () => {
      setToken("");
      setEdit(false);
      void profile.refetch();
    },
  });
  const sync = trpc.merchantAuth.triggerShopifySync.useMutation({
    onSuccess: () => void progress.refetch(),
  });
  const connected = profile.data?.shopifyConnected;
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">Shopify catalogue</h2>
      <p className="text-sm text-muted-foreground">
        Import products and variants without replacing their order-history
        references. Newly imported products start hidden so you can review
        delivery and pricing before publishing. Stock is copied on first import;
        manage your Tattoi stock allocation in Products. Later imports update
        catalogue details without replenishing sold or reserved stock.
      </p>
      {profile.isLoading && <p role="status">Loading connection…</p>}
      {profile.error && (
        <p role="alert">
          Connection status is unavailable.{" "}
          <button className="underline" onClick={() => void profile.refetch()}>
            Retry
          </button>
        </p>
      )}
      {connected && (
        <div className="rounded-xl border p-4 space-y-2">
          <p className="font-medium">{profile.data?.shopifyDomain}</p>
          <p className="text-sm text-muted-foreground">
            Connection saved. Imports run when you choose Sync catalogue.
          </p>
          <Button variant="outline" onClick={() => setEdit(!edit)}>
            {edit ? "Cancel connection change" : "Change connection"}
          </Button>
        </div>
      )}
      {(!connected || edit) && (
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            save.mutate({ shopUrl: domain, accessToken: token });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="shopify-domain">Store domain</Label>
            <Input
              id="shopify-domain"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="your-store.myshopify.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shopify-token">Admin API token</Label>
            <Input
              id="shopify-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={e => setToken(e.target.value)}
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            The app needs product-read permissions for catalogue imports.
            Supplier draft-order handoff also requires draft-order permissions.
          </p>
          <Button
            className="min-h-12 w-full"
            disabled={save.isPending || !domain || !token}
          >
            {save.isPending ? "Verifying connection…" : "Verify and save"}
          </Button>
        </form>
      )}
      {(save.error || sync.error) && (
        <p role="alert" className="text-destructive">
          {(save.error || sync.error)?.message}
        </p>
      )}
      {connected && (
        <section className="space-y-3 rounded-xl bg-secondary p-4">
          <h3 className="font-semibold">Import status</h3>
          <p role="status" className="text-sm">
            {progress.isLoading
              ? "Checking import status…"
              : progress.error
                ? "Import status unavailable."
                : progress.data?.status === "failed"
                  ? progress.data.error
                  : progress.data?.status === "idle"
                    ? "No import has been started."
                    : progress.data?.message || progress.data?.status}
          </p>
          <Button
            className="min-h-12"
            disabled={sync.isPending || progress.data?.status === "syncing"}
            onClick={() => sync.mutate()}
          >
            {sync.isPending
              ? "Queuing import…"
              : progress.data?.status === "syncing"
                ? "Import in progress…"
                : "Sync catalogue"}
          </Button>
          <Button variant="ghost" onClick={() => void progress.refetch()}>
            Refresh status
          </Button>
        </section>
      )}
    </div>
  );
}
