/**
 * Funnel Not Found
 * Displayed when artist slug is invalid or funnel is disabled
 */

import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";

interface FunnelNotFoundProps {
  message?: string;
}

export default function FunnelNotFound({ message = "Artist not found" }: FunnelNotFoundProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        className="text-center max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="w-20 h-20 rounded-full bg-destructive/10 mx-auto mb-6 flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Oops!
        </h1>
        <p className="text-muted-foreground mb-6">
          {message}
        </p>
        <p className="text-sm text-muted-foreground">
          If you believe this is an error, please contact the artist directly.
        </p>
      </motion.div>
    </div>
  );
}
