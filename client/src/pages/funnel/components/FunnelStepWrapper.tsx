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
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>

      {/* Step content */}
      <div className="space-y-4">{children}</div>


    </div>
  );
}
