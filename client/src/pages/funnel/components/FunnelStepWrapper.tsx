/**
 * Funnel Step Wrapper
 * Provides consistent layout and navigation for all funnel steps
 */

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FunnelStepWrapperProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  isFirstStep?: boolean;
  isLastStep?: boolean;
  nextLabel?: string;
  nextDisabled?: boolean;
  submitting?: boolean;
}

export default function FunnelStepWrapper({
  title,
  subtitle,
  children,
  onNext,
  onBack,
  isFirstStep = false,
  isLastStep = false,
  nextLabel,
  nextDisabled = false,
  submitting = false,
}: FunnelStepWrapperProps) {
  return (
    <div className="px-6 pb-32">
      {/* Step header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">
          {title}
        </h2>
        {subtitle && (
          <p className="text-muted-foreground mt-1">
            {subtitle}
          </p>
        )}
      </div>

      {/* Step content */}
      <div className="space-y-4">
        {children}
      </div>

      {/* Navigation buttons - fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent">
        <div className="flex gap-3 max-w-lg mx-auto">
          {!isFirstStep && (
            <Button
              variant="outline"
              size="lg"
              onClick={onBack}
              className="flex-1"
              disabled={submitting}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}
          <Button
            size="lg"
            onClick={onNext}
            disabled={nextDisabled || submitting}
            className={`${isFirstStep ? 'w-full' : 'flex-1'}`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                {nextLabel || (isLastStep ? 'Submit Request' : 'Continue')}
                {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
