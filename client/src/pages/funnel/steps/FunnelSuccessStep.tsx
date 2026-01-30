/**
 * Funnel Success Step
 * Final step: Confirmation and next steps
 */

import { motion } from "framer-motion";
import { CheckCircle2, MessageCircle, Clock, Bell } from "lucide-react";
import type { ArtistProfile } from "../FunnelWrapper";

interface FunnelSuccessStepProps {
  artistProfile: ArtistProfile;
  leadId: number | null;
}

export default function FunnelSuccessStep({
  artistProfile,
  leadId,
}: FunnelSuccessStepProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* Success animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.6 }}
        className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
        >
          <CheckCircle2 className="w-12 h-12 text-green-500" />
        </motion.div>
      </motion.div>

      {/* Success message */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-center max-w-md"
      >
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Request Submitted!
        </h1>
        <p className="text-muted-foreground">
          Your consultation request has been sent to{" "}
          <span className="text-foreground font-medium">
            {artistProfile.displayName}
          </span>
        </p>
      </motion.div>

      {/* What happens next */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8 w-full max-w-md"
      >
        <h2 className="text-sm font-medium text-muted-foreground mb-4 text-center">
          WHAT HAPPENS NEXT
        </h2>
        
        <div className="space-y-4">
          <div className="flex gap-4 items-start p-4 rounded-xl bg-card border border-border">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Review & Response</h3>
              <p className="text-sm text-muted-foreground">
                {artistProfile.displayName} will review your request and reach out to discuss your idea
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start p-4 rounded-xl bg-card border border-border">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Typical Response Time</h3>
              <p className="text-sm text-muted-foreground">
                Most artists respond within 24-48 hours
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start p-4 rounded-xl bg-card border border-border">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Stay Updated</h3>
              <p className="text-sm text-muted-foreground">
                Check your email for updates on your request
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Reference number */}
      {leadId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-8 text-center"
        >
          <p className="text-xs text-muted-foreground">
            Reference: #{leadId.toString().padStart(6, '0')}
          </p>
        </motion.div>
      )}

      {/* Close/Done hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-12 text-sm text-muted-foreground"
      >
        You can close this page now
      </motion.p>
    </div>
  );
}
