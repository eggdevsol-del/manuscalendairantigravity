/**
 * Funnel Intent Step
 * First step: What are you after?
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import FunnelStepWrapper from "../components/FunnelStepWrapper";
import type { ArtistProfile, FunnelStepData } from "../FunnelWrapper";

interface FunnelIntentStepProps {
  artistProfile: ArtistProfile;
  stepData: FunnelStepData;
  onNext: (stepName: string, data: any) => void;
  onBack: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  submitting: boolean;
}

const PROJECT_TYPES = [
  { id: "full-sleeve", label: "Full Sleeve", icon: "💪" },
  { id: "half-sleeve", label: "Half Sleeve", icon: "🦾" },
  { id: "back-piece", label: "Back Piece", icon: "🎨" },
  { id: "chest-piece", label: "Chest Piece", icon: "❤️" },
  { id: "cover-up", label: "Cover Up", icon: "🔄" },
  { id: "small-piece", label: "Small Piece", icon: "✨" },
  { id: "touch-up", label: "Touch Up", icon: "🖌️" },
  { id: "custom", label: "Custom Project", icon: "🎯" },
];

export default function FunnelIntentStep({
  artistProfile,
  stepData,
  onNext,
  onBack,
  isFirstStep,
  isLastStep,
  submitting,
}: FunnelIntentStepProps) {
  const [projectType, setProjectType] = useState(
    stepData.intent?.projectType || ""
  );
  const [projectDescription, setProjectDescription] = useState(
    stepData.intent?.projectDescription || ""
  );

  const handleNext = () => {
    onNext("intent", {
      projectType,
      projectDescription,
    });
  };

  const isValid = projectType && projectDescription.trim().length >= 10;

  return (
    <FunnelStepWrapper
      title="What are you looking for?"
      subtitle="Tell us about your tattoo idea"
      onNext={handleNext}
      onBack={onBack}
      isFirstStep={isFirstStep}
      isLastStep={isLastStep}
      nextDisabled={!isValid}
      submitting={submitting}
    >
      {/* Project type selection */}
      <div className="grid grid-cols-2 gap-3">
        {PROJECT_TYPES.map((type, index) => (
          <motion.button
            key={type.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => setProjectType(type.id)}
            className={`
              relative p-4 rounded-2xl border-2 text-left transition-all
              ${
                projectType === type.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/50"
              }
            `}
          >
            <span className="text-2xl mb-2 block">{type.icon}</span>
            <span className="font-medium text-foreground">{type.label}</span>

            {projectType === type.id && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
              >
                <Check className="w-3 h-3 text-primary-foreground" />
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>

      {/* Project description */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          Describe your idea
        </label>
        <Textarea
          value={projectDescription}
          onChange={e => setProjectDescription(e.target.value)}
          placeholder="Tell us about your vision... What's the meaning behind it? Any specific elements you want included?"
          rows={4}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground mt-2">
          {projectDescription.length < 10
            ? `At least ${10 - projectDescription.length} more characters needed`
            : "✓ Looking good!"}
        </p>
      </div>
    </FunnelStepWrapper>
  );
}
