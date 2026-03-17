/**
 * Funnel Contact Step
 * Second step: Contact information (early capture for abandoned funnel recovery)
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Phone, MapPin } from "lucide-react";
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
  const [firstName, setFirstName] = useState(stepData.contact?.firstName || "");
  const [lastName, setLastName] = useState(stepData.contact?.lastName || "");
  const [birthdate, setBirthdate] = useState(stepData.contact?.birthdate || "");
  const [email, setEmail] = useState(stepData.contact?.email || "");
  const [phone, setPhone] = useState(stepData.contact?.phone || "");
  const [city, setCity] = useState(stepData.contact?.city || "");
  const [country, setCountry] = useState(stepData.contact?.country || "");

  const handleNext = () => {
    onNext("contact", {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthdate,
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      city: city.trim() || undefined,
      country: country.trim() || undefined,
    });
  };

  // Basic validation
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValid = firstName.trim().length >= 2 && lastName.trim().length >= 2 && birthdate && isValidEmail;

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
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground mb-2">
              First name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First name"
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground mb-2">
              Last name *
            </label>
            <Input
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Last name"
            />
          </div>
        </div>

        {/* Date of Birth */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Date of birth *
          </label>
          <Input
            type="date"
            value={birthdate}
            onChange={e => setBirthdate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
          />
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
              onChange={e => setEmail(e.target.value)}
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
            Phone number{" "}
            <span className="text-muted-foreground">(optional)</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="pl-10"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            For SMS appointment reminders
          </p>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Your location{" "}
            <span className="text-muted-foreground">(optional)</span>
          </label>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="City"
                className="pl-10"
              />
            </div>
            <div className="flex-1">
              <Input
                type="text"
                value={country}
                onChange={e => setCountry(e.target.value)}
                placeholder="Country"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Helps your artist notify you about sessions in your area
          </p>
        </div>
      </motion.div>

      {/* Privacy note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-6 p-4 rounded-[4px] bg-muted/50"
      >
        <p className="text-xs text-muted-foreground">
          🔒 Your information is secure and will only be used to communicate
          about your tattoo request. We never share your details with third
          parties.
        </p>
      </motion.div>
    </FunnelStepWrapper>
  );
}
