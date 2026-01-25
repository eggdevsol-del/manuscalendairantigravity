/**
 * Funnel Loading State
 * Displayed while loading artist profile
 */

import { motion } from "framer-motion";

export default function FunnelLoadingState() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <motion.div
        className="text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 mx-auto mb-4 animate-pulse" />
        <div className="h-4 w-32 bg-muted rounded mx-auto mb-2 animate-pulse" />
        <div className="h-3 w-24 bg-muted/50 rounded mx-auto animate-pulse" />
      </motion.div>
    </div>
  );
}
