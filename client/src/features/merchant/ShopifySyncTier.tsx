import React, { useState } from "react";
import { Settings, RefreshCw, CheckCircle2, AlertCircle, KeyRound, Link as LinkIcon, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";

export function ShopifySyncTier() {
  const [shopUrl, setShopUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const utils = trpc.useUtils();

  const { data: merchant, isLoading } = trpc.merchantAuth.getMerchantProfile.useQuery();

  const saveCredentialsMutation = trpc.merchantAuth.saveShopifyCredentials.useMutation({
    onSuccess: () => {
      toast.success("Shopify credentials saved successfully!");
      utils.merchantAuth.getMerchantProfile.invalidate();
      setIsSaving(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save credentials");
      setIsSaving(false);
    }
  });

  const triggerSyncMutation = trpc.merchantAuth.triggerShopifySync.useMutation({
    onSuccess: () => {
      toast.success("Sync started! Your storefront will update shortly.");
      // The SyncOverlay component will automatically pick up the status via getSyncStatus polling
    },
    onError: (error) => {
      toast.error(error.message || "Failed to trigger sync");
    }
  });

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopUrl || !accessToken) return;
    setIsSaving(true);
    saveCredentialsMutation.mutate({ shopUrl, accessToken });
  };

  const handleForceSync = () => {
    triggerSyncMutation.mutate();
  };

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading integration status...</div>;
  }

  const isConnected = merchant?.integrationType === "shopify" && !!merchant?.shopifyToken;

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-6 border-b border-border/50 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-foreground">Shopify Integration</h3>
          <p className="text-sm text-muted-foreground mt-1">Connect your Tattoi storefront to Shopify.</p>
        </div>
        {isConnected ? (
          <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Connected
          </div>
        ) : (
          <div className="px-3 py-1 bg-secondary text-muted-foreground text-xs font-bold rounded-full flex items-center gap-1">
            Disconnected
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        {!isConnected ? (
          <form onSubmit={handleConnect} className="bg-secondary/20 border border-border/50 rounded-2xl p-6 space-y-6">
            <div>
              <h4 className="text-base font-bold text-foreground mb-2">Connect via Custom App Token</h4>
              <p className="text-sm text-muted-foreground mb-6">
                To enable live inventory syncing, create a Custom App in your Shopify Admin dashboard with <strong>Read Products</strong> and <strong>Read Orders</strong> permissions.
              </p>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Shopify Store URL</label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="e.g. mystudio.myshopify.com" 
                      className="pl-10 bg-background/50 border-border/50 focus:border-primary/50"
                      value={shopUrl}
                      onChange={(e) => setShopUrl(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Admin API Access Token</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      type="password"
                      placeholder="shpat_..." 
                      className="pl-10 bg-background/50 border-border/50 focus:border-primary/50"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border/50">
              <button 
                type="submit" 
                disabled={isSaving || !shopUrl || !accessToken}
                className="px-6 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-full disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect & Save"}
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-secondary/20 border border-border/50 rounded-2xl p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                <Settings className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h4 className="text-base font-bold text-foreground">Sync Status</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Your store (<span className="text-foreground font-medium">{merchant.shopifyDomain}</span>) is connected. You can trigger a manual sync at any time.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-background/50 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-foreground">Products Synced</p>
                  <p className="text-xs text-muted-foreground">Admin API Active</p>
                </div>
                <p className="text-xl font-light text-foreground">Live</p>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-amber-500/20">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-bold text-foreground">Webhooks Not Configured</p>
                    <p className="text-xs text-amber-500/80">Configure webhooks in Shopify to enable real-time pushing.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border/50 flex justify-end gap-3">
              <button 
                onClick={handleForceSync}
                disabled={triggerSyncMutation.isPending}
                className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-full flex items-center gap-2 shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] disabled:opacity-50"
              >
                {triggerSyncMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {triggerSyncMutation.isPending ? "Starting Sync..." : "Force Deep Sync"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
