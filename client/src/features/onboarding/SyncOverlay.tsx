import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

const LOADING_STEPS = [
  "Setting up supplier dashboard...",
  "Configuring inventory management...",
  "Setting up order management...",
  "Preparing analytics engine...",
];

export function SyncOverlay() {
  const [stepIndex, setStepIndex] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);

  const { data: syncStatus } = trpc.merchantAuth.getSyncStatus.useQuery(undefined, {
    refetchInterval: (data) => data?.status === "syncing" ? 1000 : false,
  });

  // Cycle through static loading messages
  useEffect(() => {
    if (syncStatus?.status === "syncing") {
      const interval = setInterval(() => {
        setStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [syncStatus?.status]);

  if (!syncStatus || syncStatus.status === "complete" || syncStatus.status === "idle" || isDismissed) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-lg flex flex-col items-center relative"
      >
        {/* TATTOI Header */}
        <h1 className="text-4xl md:text-5xl font-light tracking-widest text-foreground mb-16">
          TATTOI
        </h1>

        {syncStatus.status === "syncing" && (
          <div className="w-full flex flex-col items-center">
            {/* Dynamic Scraper Output */}
            <p className="text-lg font-medium text-foreground mb-4">
              Importing your catalogue — <span className="font-bold">{syncStatus.count}</span> products found
            </p>

            <AnimatePresence mode="wait">
              <motion.p
                key={syncStatus.message || LOADING_STEPS[stepIndex]}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-sm text-muted-foreground mb-8 text-center h-6"
              >
                {syncStatus.message || LOADING_STEPS[stepIndex]}
              </motion.p>
            </AnimatePresence>

            {/* Pulsing loading bar */}
            <div className="h-[2px] w-full max-w-[200px] bg-secondary overflow-hidden mb-12">
              <motion.div 
                className="h-full bg-primary"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>
        )}

        {syncStatus.status === "failed" && (
          <div className="flex flex-col items-center">
            <h2 className="text-xl font-bold text-red-400 mb-2">Import Failed</h2>
            <p className="text-sm text-muted-foreground mb-8 px-4 text-center max-w-sm">
              {syncStatus.error || "We couldn't extract products from the provided URL."}
            </p>
            <button 
              onClick={() => setIsDismissed(true)}
              className="px-6 py-2 bg-secondary text-foreground font-bold rounded-full text-sm hover:bg-secondary/80 transition-colors"
            >
              Continue to Dashboard
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
