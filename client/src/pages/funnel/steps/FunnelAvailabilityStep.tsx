/**
 * Funnel Availability Step
 * Fifth step: When are you looking to get tattooed?
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Calendar, Clock } from "lucide-react";
import FunnelStepWrapper from "../components/FunnelStepWrapper";
import type { ArtistProfile, FunnelStepData } from "../FunnelWrapper";

interface FunnelAvailabilityStepProps {
  artistProfile: ArtistProfile;
  stepData: FunnelStepData;
  onNext: (stepName: string, data: any) => void;
  onBack: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  submitting: boolean;
}

const TIMEFRAME_OPTIONS = [
  { id: 'asap', label: 'As soon as possible', icon: '⚡' },
  { id: '1-3-months', label: '1-3 months', icon: '📅' },
  { id: '3-6-months', label: '3-6 months', icon: '🗓️' },
  { id: '6-12-months', label: '6-12 months', icon: '📆' },
  { id: 'flexible', label: 'I\'m flexible', icon: '🤷' },
];

const URGENCY_OPTIONS = [
  { 
    id: 'flexible', 
    label: 'Flexible', 
    description: 'I can wait for the right time',
    color: 'text-green-500'
  },
  { 
    id: 'moderate', 
    label: 'Moderate', 
    description: 'Would like to book within my timeframe',
    color: 'text-yellow-500'
  },
  { 
    id: 'urgent', 
    label: 'Urgent', 
    description: 'Need it done soon (special occasion, etc.)',
    color: 'text-red-500'
  },
];

// Generate next 12 months
const getNextMonths = () => {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({
      id: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      short: date.toLocaleDateString('en-US', { month: 'short' }),
    });
  }
  return months;
};

export default function FunnelAvailabilityStep({
  artistProfile,
  stepData,
  onNext,
  onBack,
  isFirstStep,
  isLastStep,
  submitting,
}: FunnelAvailabilityStepProps) {
  const [preferredTimeframe, setPreferredTimeframe] = useState(
    stepData.availability?.preferredTimeframe || ''
  );
  const [preferredMonths, setPreferredMonths] = useState<string[]>(
    stepData.availability?.preferredMonths || []
  );
  const [urgency, setUrgency] = useState<'flexible' | 'moderate' | 'urgent'>(
    stepData.availability?.urgency || 'flexible'
  );

  const months = getNextMonths();

  const toggleMonth = (monthId: string) => {
    setPreferredMonths(prev =>
      prev.includes(monthId)
        ? prev.filter(m => m !== monthId)
        : [...prev, monthId]
    );
  };

  const handleNext = () => {
    onNext('availability', {
      preferredTimeframe,
      preferredMonths,
      urgency,
    });
  };

  const isValid = preferredTimeframe && urgency;

  return (
    <FunnelStepWrapper
      title="When works for you?"
      subtitle="Let us know your availability"
      onNext={handleNext}
      onBack={onBack}
      isFirstStep={isFirstStep}
      isLastStep={isLastStep}
      nextLabel="Submit Request"
      nextDisabled={!isValid}
      submitting={submitting}
    >
      {/* Timeframe */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          <Calendar className="w-4 h-4 inline mr-1" />
          When are you looking to get tattooed?
        </label>
        <div className="space-y-2">
          {TIMEFRAME_OPTIONS.map((option, index) => (
            <motion.button
              key={option.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => setPreferredTimeframe(option.id)}
              className={`
                relative w-full p-3 rounded-xl border-2 text-left transition-all flex items-center gap-3
                ${preferredTimeframe === option.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/50'
                }
              `}
            >
              <span className="text-xl">{option.icon}</span>
              <span className="font-medium text-foreground">{option.label}</span>
              {preferredTimeframe === option.id && (
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
      </div>

      {/* Preferred months (optional) */}
      {preferredTimeframe && preferredTimeframe !== 'asap' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-6"
        >
          <label className="block text-sm font-medium text-foreground mb-2">
            Preferred months <span className="text-muted-foreground">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {months.map((month, index) => (
              <motion.button
                key={month.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => toggleMonth(month.id)}
                className={`
                  px-3 py-1.5 rounded-full text-sm font-medium transition-all
                  ${preferredMonths.includes(month.id)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }
                `}
              >
                {month.short}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Urgency */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          <Clock className="w-4 h-4 inline mr-1" />
          How urgent is this?
        </label>
        <div className="space-y-2">
          {URGENCY_OPTIONS.map((option, index) => (
            <motion.button
              key={option.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              onClick={() => setUrgency(option.id as typeof urgency)}
              className={`
                relative w-full p-3 rounded-xl border-2 text-left transition-all
                ${urgency === option.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/50'
                }
              `}
            >
              <span className={`font-medium ${option.color}`}>{option.label}</span>
              <span className="text-sm text-muted-foreground block mt-0.5">
                {option.description}
              </span>
              {urgency === option.id && (
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
      </div>
    </FunnelStepWrapper>
  );
}
