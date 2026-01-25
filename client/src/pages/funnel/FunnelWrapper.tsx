/**
 * Funnel Wrapper Component
 * 
 * This is the main container for the public consultation funnel.
 * It handles:
 * - Session management
 * - Step navigation
 * - Progress tracking
 * - Data persistence across steps
 * 
 * IMPORTANT: This is a PUBLIC page - no authentication required
 */

import { useState, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
// Generate unique session ID
const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Funnel step components
import FunnelIntentStep from "./steps/FunnelIntentStep";
import FunnelContactStep from "./steps/FunnelContactStep";
import FunnelStyleStep from "./steps/FunnelStyleStep";
import FunnelBudgetStep from "./steps/FunnelBudgetStep";
import FunnelAvailabilityStep from "./steps/FunnelAvailabilityStep";
import FunnelSuccessStep from "./steps/FunnelSuccessStep";
import FunnelLoadingState from "./components/FunnelLoadingState";
import FunnelNotFound from "./components/FunnelNotFound";

// Types
export interface FunnelStepData {
  intent?: {
    projectType: string;
    projectDescription: string;
  };
  contact?: {
    name: string;
    email: string;
    phone?: string;
  };
  style?: {
    stylePreferences: string[];
    referenceImages: string[];
  };
  budget?: {
    placement: string;
    estimatedSize: string;
    budgetMin: number;
    budgetMax: number;
    budgetLabel: string;
  };
  availability?: {
    preferredTimeframe: string;
    preferredMonths: string[];
    urgency: 'flexible' | 'moderate' | 'urgent';
  };
}

export interface ArtistProfile {
  id: string;
  slug: string;
  displayName: string;
  tagline?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
  styleOptions: string[];
  placementOptions: string[];
  budgetRanges: { label: string; min: number; max: number | null }[];
  enabledSteps: string[];
}

interface FunnelWrapperProps {
  artistSlug: string;
}

const STEP_ORDER = ['intent', 'contact', 'style', 'budget', 'availability', 'success'];

export default function FunnelWrapper({ artistSlug }: FunnelWrapperProps) {
  const [, setLocation] = useLocation();
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [artistProfile, setArtistProfile] = useState<ArtistProfile | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<string>("intent");
  const [stepData, setStepData] = useState<FunnelStepData>({});
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [leadId, setLeadId] = useState<number | null>(null);

  // Initialize session and fetch artist profile
  useEffect(() => {
    const initFunnel = async () => {
      try {
        setLoading(true);
        
        // Generate or retrieve session ID
        let storedSessionId = sessionStorage.getItem(`funnel_session_${artistSlug}`);
        if (!storedSessionId) {
          storedSessionId = generateSessionId();
          sessionStorage.setItem(`funnel_session_${artistSlug}`, storedSessionId);
        }
        setSessionId(storedSessionId);
        
        // Restore step data if exists
        const storedData = sessionStorage.getItem(`funnel_data_${artistSlug}`);
        if (storedData) {
          const parsed = JSON.parse(storedData);
          setStepData(parsed.stepData || {});
          setCompletedSteps(parsed.completedSteps || []);
          setCurrentStep(parsed.currentStep || 'intent');
        }
        
        // Fetch artist profile
        const response = await fetch(`/api/public/artist/${artistSlug}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Artist not found");
          } else {
            setError("Failed to load artist profile");
          }
          return;
        }
        
        const profile = await response.json();
        setArtistProfile(profile);
        
      } catch (err) {
        console.error("Failed to initialize funnel:", err);
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    
    initFunnel();
  }, [artistSlug]);

  // Persist data to session storage
  useEffect(() => {
    if (sessionId && artistSlug) {
      sessionStorage.setItem(`funnel_data_${artistSlug}`, JSON.stringify({
        stepData,
        completedSteps,
        currentStep,
      }));
    }
  }, [stepData, completedSteps, currentStep, sessionId, artistSlug]);

  // Get enabled steps for this artist
  const getEnabledSteps = useCallback(() => {
    if (!artistProfile) return STEP_ORDER.filter(s => s !== 'success');
    return artistProfile.enabledSteps.filter(s => STEP_ORDER.includes(s));
  }, [artistProfile]);

  // Navigation handlers
  const handleNext = useCallback((stepName: string, data: any) => {
    // Save step data
    setStepData(prev => ({
      ...prev,
      [stepName]: data,
    }));
    
    // Mark step as completed
    if (!completedSteps.includes(stepName)) {
      setCompletedSteps(prev => [...prev, stepName]);
    }
    
    // Find next step
    const enabledSteps = getEnabledSteps();
    const currentIndex = enabledSteps.indexOf(stepName);
    
    if (currentIndex < enabledSteps.length - 1) {
      setCurrentStep(enabledSteps[currentIndex + 1]);
    } else {
      // All steps complete - submit
      handleSubmit({ ...stepData, [stepName]: data });
    }
  }, [completedSteps, getEnabledSteps, stepData]);

  const handleBack = useCallback(() => {
    const enabledSteps = getEnabledSteps();
    const currentIndex = enabledSteps.indexOf(currentStep);
    
    if (currentIndex > 0) {
      setCurrentStep(enabledSteps[currentIndex - 1]);
    }
  }, [currentStep, getEnabledSteps]);

  // Submit funnel
  const handleSubmit = async (finalData: FunnelStepData) => {
    if (!artistProfile) return;
    
    setSubmitting(true);
    try {
      const response = await fetch('/api/public/funnel/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId: artistProfile.id,
          sessionId,
          ...finalData,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit');
      }
      
      const result = await response.json();
      setLeadId(result.leadId);
      setCurrentStep('success');
      
      // Clear session storage
      sessionStorage.removeItem(`funnel_session_${artistSlug}`);
      sessionStorage.removeItem(`funnel_data_${artistSlug}`);
      
    } catch (err) {
      console.error("Failed to submit funnel:", err);
      // Show error but stay on current step
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate progress
  const getProgress = useCallback(() => {
    const enabledSteps = getEnabledSteps();
    const currentIndex = enabledSteps.indexOf(currentStep);
    return ((currentIndex + 1) / enabledSteps.length) * 100;
  }, [currentStep, getEnabledSteps]);

  // Loading state
  if (loading) {
    return <FunnelLoadingState />;
  }

  // Error state
  if (error || !artistProfile) {
    return <FunnelNotFound message={error || "Artist not found"} />;
  }

  // Render current step
  const renderStep = () => {
    const commonProps = {
      artistProfile,
      stepData,
      onNext: handleNext,
      onBack: handleBack,
      isFirstStep: currentStep === getEnabledSteps()[0],
      isLastStep: currentStep === getEnabledSteps()[getEnabledSteps().length - 1],
      submitting,
    };

    switch (currentStep) {
      case 'intent':
        return <FunnelIntentStep {...commonProps} />;
      case 'contact':
        return <FunnelContactStep {...commonProps} />;
      case 'style':
        return <FunnelStyleStep {...commonProps} />;
      case 'budget':
        return <FunnelBudgetStep {...commonProps} />;
      case 'availability':
        return <FunnelAvailabilityStep {...commonProps} />;
      case 'success':
        return <FunnelSuccessStep artistProfile={artistProfile} leadId={leadId} />;
      default:
        return <FunnelIntentStep {...commonProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Progress bar */}
      {currentStep !== 'success' && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <div className="h-1 bg-muted">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${getProgress()}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Artist header */}
      {currentStep !== 'success' && (
        <div className="pt-6 pb-4 px-6 text-center">
          {artistProfile.profileImageUrl ? (
            <img
              src={artistProfile.profileImageUrl}
              alt={artistProfile.displayName}
              className="w-16 h-16 rounded-full mx-auto mb-3 object-cover ring-2 ring-primary/20"
            />
          ) : (
            <div className="w-16 h-16 rounded-full mx-auto mb-3 bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {artistProfile.displayName?.charAt(0) || '?'}
              </span>
            </div>
          )}
          <h1 className="text-lg font-bold text-foreground">
            {artistProfile.displayName}
          </h1>
          {artistProfile.tagline && (
            <p className="text-sm text-muted-foreground mt-1">
              {artistProfile.tagline}
            </p>
          )}
        </div>
      )}

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
