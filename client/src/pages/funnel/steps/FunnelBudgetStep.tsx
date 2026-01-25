/**
 * Funnel Budget Step
 * Fourth step: Placement, size, and budget range
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, DollarSign } from "lucide-react";
import FunnelStepWrapper from "../components/FunnelStepWrapper";
import type { ArtistProfile, FunnelStepData } from "../FunnelWrapper";

interface FunnelBudgetStepProps {
  artistProfile: ArtistProfile;
  stepData: FunnelStepData;
  onNext: (stepName: string, data: any) => void;
  onBack: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  submitting: boolean;
}

const DEFAULT_PLACEMENTS = [
  { id: 'full-sleeve', label: 'Full Sleeve' },
  { id: 'half-sleeve', label: 'Half Sleeve' },
  { id: 'forearm', label: 'Forearm' },
  { id: 'upper-arm', label: 'Upper Arm' },
  { id: 'back-piece', label: 'Back' },
  { id: 'chest', label: 'Chest' },
  { id: 'ribs', label: 'Ribs' },
  { id: 'thigh', label: 'Thigh' },
  { id: 'calf', label: 'Calf' },
  { id: 'hand', label: 'Hand' },
  { id: 'neck', label: 'Neck' },
  { id: 'other', label: 'Other' },
];

const SIZE_OPTIONS = [
  { id: 'small', label: 'Small', description: '2-4 inches' },
  { id: 'medium', label: 'Medium', description: '4-6 inches' },
  { id: 'large', label: 'Large', description: '6-10 inches' },
  { id: 'extra-large', label: 'Extra Large', description: '10+ inches' },
];

const DEFAULT_BUDGET_RANGES = [
  { label: 'Under $500', min: 0, max: 500 },
  { label: '$500 - $1,000', min: 500, max: 1000 },
  { label: '$1,000 - $2,500', min: 1000, max: 2500 },
  { label: '$2,500 - $5,000', min: 2500, max: 5000 },
  { label: '$5,000 - $10,000', min: 5000, max: 10000 },
  { label: '$10,000+', min: 10000, max: null },
];

export default function FunnelBudgetStep({
  artistProfile,
  stepData,
  onNext,
  onBack,
  isFirstStep,
  isLastStep,
  submitting,
}: FunnelBudgetStepProps) {
  const [placement, setPlacement] = useState(stepData.budget?.placement || '');
  const [estimatedSize, setEstimatedSize] = useState(stepData.budget?.estimatedSize || '');
  const [selectedBudget, setSelectedBudget] = useState<{
    label: string;
    min: number;
    max: number | null;
  } | null>(
    stepData.budget ? {
      label: stepData.budget.budgetLabel,
      min: stepData.budget.budgetMin,
      max: stepData.budget.budgetMax,
    } : null
  );

  // Use artist's custom options if available
  const placements = artistProfile.placementOptions?.length > 0
    ? artistProfile.placementOptions.map(id => 
        DEFAULT_PLACEMENTS.find(p => p.id === id) || { id, label: id }
      )
    : DEFAULT_PLACEMENTS;

  const budgetRanges = artistProfile.budgetRanges?.length > 0
    ? artistProfile.budgetRanges
    : DEFAULT_BUDGET_RANGES;

  const handleNext = () => {
    if (!selectedBudget) return;
    
    onNext('budget', {
      placement,
      estimatedSize,
      budgetMin: selectedBudget.min,
      budgetMax: selectedBudget.max,
      budgetLabel: selectedBudget.label,
    });
  };

  const isValid = placement && estimatedSize && selectedBudget;

  return (
    <FunnelStepWrapper
      title="Size & Budget"
      subtitle="Help us understand the scope of your project"
      onNext={handleNext}
      onBack={onBack}
      isFirstStep={isFirstStep}
      isLastStep={isLastStep}
      nextDisabled={!isValid}
      submitting={submitting}
    >
      {/* Placement */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Where on your body?
        </label>
        <div className="grid grid-cols-3 gap-2">
          {placements.map((p, index) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              onClick={() => setPlacement(p.id)}
              className={`
                relative p-2 rounded-xl border-2 text-center transition-all text-sm
                ${placement === p.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/50'
                }
              `}
            >
              {p.label}
              {placement === p.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Size */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          Estimated size
        </label>
        <div className="grid grid-cols-2 gap-2">
          {SIZE_OPTIONS.map((size, index) => (
            <motion.button
              key={size.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.05 }}
              onClick={() => setEstimatedSize(size.id)}
              className={`
                relative p-3 rounded-xl border-2 text-left transition-all
                ${estimatedSize === size.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/50'
                }
              `}
            >
              <span className="font-medium text-foreground block">{size.label}</span>
              <span className="text-xs text-muted-foreground">{size.description}</span>
              {estimatedSize === size.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Budget */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          <DollarSign className="w-4 h-4 inline mr-1" />
          Budget range
        </label>
        <div className="space-y-2">
          {budgetRanges.map((range, index) => (
            <motion.button
              key={range.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              onClick={() => setSelectedBudget(range)}
              className={`
                relative w-full p-3 rounded-xl border-2 text-left transition-all
                ${selectedBudget?.label === range.label
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/50'
                }
              `}
            >
              <span className="font-medium text-foreground">{range.label}</span>
              {selectedBudget?.label === range.label && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-1/2 -translate-y-1/2 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check className="w-3 h-3 text-primary-foreground" />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          This helps us provide an accurate quote. Final pricing may vary based on design complexity.
        </p>
      </div>
    </FunnelStepWrapper>
  );
}
