import React, { useState } from "react";
import { Button } from "@/components/ui";
import { MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CountryConfirmationProps {
  country: "AU" | "NZ";
  onOverride: (country: "AU" | "NZ") => void;
}

export function CountryConfirmation({ country, onOverride }: CountryConfirmationProps) {
  const [showOverride, setShowOverride] = useState(false);

  return (
    <>
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-border shadow-sm">
        <MapPin className="w-4 h-4 text-primary" />
        <span className="text-xs font-medium">
          {country === "AU" ? "🇦🇺 Australia" : "🇳🇿 New Zealand"}
        </span>
        <button
          onClick={() => setShowOverride(true)}
          className="text-[10px] text-muted-foreground hover:text-primary transition-colors ml-2 underline underline-offset-2"
        >
          Not you?
        </button>
      </div>

      <AnimatePresence>
        {showOverride && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-md w-full space-y-4"
            >
              <div className="text-center space-y-2 mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Select your region</h2>
                <p className="text-sm text-muted-foreground">
                  Choose the country where your business is legally registered.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <Button
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all"
                  onClick={() => {
                    onOverride("AU");
                    setShowOverride(false);
                  }}
                >
                  <span className="text-3xl">🇦🇺</span>
                  <span className="font-semibold">Australia</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all"
                  onClick={() => {
                    onOverride("NZ");
                    setShowOverride(false);
                  }}
                >
                  <span className="text-3xl">🇳🇿</span>
                  <span className="font-semibold">New Zealand</span>
                </Button>
              </div>

              <Button
                variant="ghost"
                className="w-full mt-4"
                onClick={() => setShowOverride(false)}
              >
                Cancel
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
