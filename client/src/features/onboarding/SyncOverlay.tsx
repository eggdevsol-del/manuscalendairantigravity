import React from "react";
import { motion } from "framer-motion";
import { Loader2, PackageCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageShell } from "@/components/ui/ssot";

export function SyncOverlay() {
  const { data: syncStatus, refetch } = trpc.merchantAuth.getSyncStatus.useQuery(undefined, {
    refetchInterval: (data) => data?.status === "syncing" ? 2000 : false,
  });

  if (!syncStatus || syncStatus.status === "complete" || syncStatus.status === "idle") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-card border border-border shadow-2xl rounded-[32px] p-8 flex flex-col items-center relative overflow-hidden"
      >
        {/* Animated background glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-primary/5 opacity-50 pointer-events-none" />

        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6 relative z-10 border-2 border-primary/30 shadow-[0_0_30px_rgba(var(--primary-rgb),0.3)]">
          {syncStatus.status === "syncing" ? (
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          ) : (
            <PackageCheck className="w-10 h-10 text-emerald-500" />
          )}
        </div>

        <h2 className="text-2xl font-black tracking-tight text-foreground mb-2 relative z-10">
          {syncStatus.status === "failed" ? "Import Failed" : "Building Your Storefront"}
        </h2>
        
        <p className="text-sm font-medium text-muted-foreground mb-8 relative z-10">
          {syncStatus.status === "failed" 
            ? "We couldn't extract products from the provided URL. Please check your Dashboard settings."
            : "We are currently extracting your entire catalogue. Please don't close this page."}
        </p>

        {syncStatus.status === "syncing" && (
          <div className="w-full relative z-10">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Products Found</span>
              <motion.span 
                key={syncStatus.count}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-black text-foreground tabular-nums leading-none"
              >
                {syncStatus.count}
              </motion.span>
            </div>
            {/* Pulsing bar */}
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary"
                animate={{ width: ["0%", "100%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>
        )}

        {syncStatus.status === "failed" && (
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-secondary text-foreground font-bold rounded-full text-sm hover:bg-secondary/80 transition-colors relative z-10"
          >
            Continue to Dashboard
          </button>
        )}
      </motion.div>
    </div>
  );
}
