/**
 * Funnel Contact Step
 * Second step: Contact information (early capture for abandoned funnel recovery)
 * Uses parent state directly so the parent nav Continue button works.
 */

import { motion } from "framer-motion";
import { User, Mail, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import FunnelStepWrapper from "../components/FunnelStepWrapper";
import type { ArtistProfile } from "../FunnelWrapper";

interface FunnelContactStepProps {
  artistProfile: ArtistProfile;
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  birthdate: string;
  setBirthdate: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  country: string;
  setCountry: (v: string) => void;
}

export default function FunnelContactStep({
  artistProfile,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  birthdate,
  setBirthdate,
  email,
  setEmail,
  phone,
  setPhone,
  city,
  setCity,
  country,
  setCountry,
}: FunnelContactStepProps) {

  return (
    <FunnelStepWrapper
      title="Your contact details"
      onNext={() => { }}
      onBack={() => { }}
      isFirstStep={false}
      isLastStep={false}
      nextDisabled={false}
      submitting={false}
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
          {email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
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
            Your location *
          </label>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="City"
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
    </FunnelStepWrapper>
  );
}
