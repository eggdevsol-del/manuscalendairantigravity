import { Button, ModalShell } from "@/components/ui";
import { Loader2 } from "lucide-react";
import React from "react";

export interface WizardStepConfig {
  id: string;
  label: string;
  render: () => React.ReactNode;
  // Footer configuration
  nextLabel?: string;
  onNext?: () => void;
  canNext?: boolean;
  isNextLoading?: boolean;
  hideNext?: boolean;
  hideBack?: boolean;
  customFooter?: React.ReactNode;
}

interface WizardShellProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  steps: WizardStepConfig[];
  currentStepIndex: number;
  onStepChange: (index: number) => void;
  overlayName?: string;
  overlayId?: string;
}

export function WizardShell({
  isOpen,
  onClose,
  steps,
  currentStepIndex,
  onStepChange,
  overlayName = "Wizard",
  overlayId,
}: WizardShellProps) {
  const currentStep = steps[currentStepIndex];

  const handleNext = () => {
    if (currentStep.onNext) {
      currentStep.onNext();
    } else if (currentStepIndex < steps.length - 1) {
      onStepChange(currentStepIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      onStepChange(currentStepIndex - 1);
    }
  };

  if (!currentStep) return null;

  const footer = !currentStep.customFooter ? (
    <div className="flex flex-row justify-between items-center w-full gap-4">
      <div className="flex-1">
        {!currentStep.hideBack && currentStepIndex > 0 ? (
          <Button
            variant="ghost"
            onClick={handleBack}
            className="text-white/50 hover:text-white hover:bg-white/5 -ml-4 font-bold"
          >
            Back
          </Button>
        ) : (
          <div />
        )}
      </div>

      <div className="flex-1 flex justify-end">
        {!currentStep.hideNext && (
          <Button
            disabled={!currentStep.canNext || currentStep.isNextLoading}
            onClick={handleNext}
            className="rounded-full px-8 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none transition-all w-full sm:w-auto"
          >
            {currentStep.isNextLoading && (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            )}
            {currentStep.nextLabel || "Next"}
          </Button>
        )}
      </div>
    </div>
  ) : null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={currentStep.label}
      footer={currentStep.customFooter || footer}
      overlayName={overlayName}
      overlayId={overlayId}
    >
      {currentStep.render()}
    </ModalShell>
  );
}
