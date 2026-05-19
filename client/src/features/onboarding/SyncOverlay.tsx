import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [progress, setProgress] = useState(0);

  const { data: syncStatus } = trpc.merchantAuth.getSyncStatus.useQuery(undefined, {
    refetchInterval: (query) => {
      const status = (query.state.data as any)?.status;
      // Continue polling if we have no data yet, or if it's still syncing
      return (!status || status === "syncing") ? 1000 : false;
    },
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

  // Calculate dynamic progress
  useEffect(() => {
    if (syncStatus?.status === "syncing") {
      const interval = setInterval(() => {
        setProgress(p => {
          // If we can extract explicit progress from the backend message, use it
          const match = syncStatus.message?.match(/\((\d+)\/(\d+)\)/);
          if (match) {
             const current = parseInt(match[1]);
             const total = parseInt(match[2]);
             return (current / total) * 100;
          }
          
          // Otherwise, slowly auto-increment up to 95% to simulate loading
          const next = p + 0.3; // Very slow tick
          return next > 95 ? 95 : next;
        });
      }, 50);
      return () => clearInterval(interval);
    } else if (syncStatus?.status === "complete") {
      setProgress(100);
    }
  }, [syncStatus?.status, syncStatus?.message]);

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
        {/* TATTOI Header with Fill Animation */}
        <div className="relative mb-16">
          <h1 className="text-4xl md:text-5xl font-light tracking-widest text-foreground opacity-10 select-none">
            TATTOI
          </h1>
          <h1 
            className="text-4xl md:text-5xl font-light tracking-widest text-foreground absolute inset-0 select-none transition-all duration-75 ease-linear"
            style={{ clipPath: `inset(${100 - progress}% 0 0 0)` }}
          >
            TATTOI
          </h1>
        </div>

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
            
            {/* Fallback space for the removed line bar so the layout stays consistent */}
            <div className="h-[2px] mb-12"></div>
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
