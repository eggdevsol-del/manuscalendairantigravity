/**
 * Funnel Contact Step
 * Second step: Contact information (early capture for abandoned funnel recovery)
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import FunnelStepWrapper from "../components/FunnelStepWrapper";
import type { ArtistProfile, FunnelStepData } from "../FunnelWrapper";

interface FunnelContactStepProps {
  artistProfile: ArtistProfile;
  stepData: FunnelStepData;
  onNext: (stepName: string, data: any) => void;
  onBack: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  submitting: boolean;
}

export default function FunnelContactStep({
  artistProfile,
  stepData,
  onNext,
  onBack,
  isFirstStep,
  isLastStep,
  submitting,
}: FunnelContactStepProps) {
  const [name, setName] = useState(stepData.contact?.name || '');
  const [email, setEmail] = useState(stepData.contact?.email || '');
  const [phone, setPhone] = useState(stepData.contact?.phone || '');

  const handleNext = () => {
    onNext('contact', {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
    });
  };

  // Basic validation
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValid = name.trim().length >= 2 && isValidEmail;

  return (
    <FunnelStepWrapper
      title="How can we reach you?"
      subtitle="We'll use this to send you updates on your request"
      onNext={handleNext}
      onBack={onBack}
      isFirstStep={isFirstStep}
      isLastStep={isLastStep}
      nextDisabled={!isValid}
      submitting={submitting}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Your name *
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              className="pl-10"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Email address *
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="pl-10"
            />
          </div>
          {email && !isValidEmail && (
            <p className="text-xs text-destructive mt-1">
              Please enter a valid email address
            </p>
          )}
        </div>

        {/* Phone (optional) */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Phone number <span className="text-muted-foreground">(optional)</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="pl-10"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            For SMS appointment reminders
          </p>
        </div>
      </motion.div>

      {/* Privacy note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-6 p-4 rounded-xl bg-muted/50"
      >
        <p className="text-xs text-muted-foreground">
          🔒 Your information is secure and will only be used to communicate about your tattoo request. 
          We never share your details with third parties.
        </p>
      </motion.div>
    </FunnelStepWrapper>
  );
}
