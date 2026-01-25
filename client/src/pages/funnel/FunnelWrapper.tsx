/**
 * Funnel Wrapper Component
 * 
 * Simple, clean light-mode consultation funnel.
 * No images, no icons - just clean text and forms.
 */
import { useState, useEffect } from "react";
import IOSInstallPrompt from "@/components/IOSInstallPrompt";

// Generate unique session ID
const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

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

// Simple project types without emojis
const PROJECT_TYPES = [
  { id: 'full-sleeve', label: 'Full Sleeve' },
  { id: 'half-sleeve', label: 'Half Sleeve' },
  { id: 'back-piece', label: 'Back Piece' },
  { id: 'chest-piece', label: 'Chest Piece' },
  { id: 'cover-up', label: 'Cover Up' },
  { id: 'small-piece', label: 'Small Piece' },
  { id: 'touch-up', label: 'Touch Up' },
  { id: 'custom', label: 'Custom Project' },
];

// Simple style options
const STYLE_OPTIONS = [
  'Realism', 'Traditional', 'Neo-Traditional', 'Japanese', 
  'Blackwork', 'Dotwork', 'Watercolor', 'Geometric', 
  'Minimalist', 'Fine Line', 'Other'
];

// Budget ranges
const BUDGET_RANGES = [
  { label: 'Under $500', min: 0, max: 500 },
  { label: '$500 - $1,000', min: 500, max: 1000 },
  { label: '$1,000 - $2,500', min: 1000, max: 2500 },
  { label: '$2,500 - $5,000', min: 2500, max: 5000 },
  { label: '$5,000 - $10,000', min: 5000, max: 10000 },
  { label: '$10,000+', min: 10000, max: null },
];

// Timeframe options
const TIMEFRAME_OPTIONS = [
  { id: 'asap', label: 'As soon as possible' },
  { id: '1-3months', label: 'Within 1-3 months' },
  { id: '3-6months', label: 'Within 3-6 months' },
  { id: '6months+', label: '6+ months from now' },
  { id: 'flexible', label: 'Flexible / No rush' },
];

export default function FunnelWrapper({ artistSlug }: FunnelWrapperProps) {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [artistProfile, setArtistProfile] = useState<ArtistProfile | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  
  // Form data
  const [projectType, setProjectType] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<typeof BUDGET_RANGES[0] | null>(null);
  const [timeframe, setTimeframe] = useState('');

  // Total steps (excluding success)
  const totalSteps = 5;

  // Initialize
  useEffect(() => {
    const initFunnel = async () => {
      try {
        setLoading(true);
        
        // Generate session ID
        let storedSessionId = sessionStorage.getItem(`funnel_session_${artistSlug}`);
        if (!storedSessionId) {
          storedSessionId = generateSessionId();
          sessionStorage.setItem(`funnel_session_${artistSlug}`, storedSessionId);
        }
        setSessionId(storedSessionId);
        
        // Fetch artist profile
        console.log(`[Funnel] Fetching artist profile for slug: ${artistSlug}`);
        const response = await fetch(`/api/public/artist/${artistSlug}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`[Funnel] Error fetching artist:`, errorData);
          if (response.status === 404) {
            setError("This booking link is not available");
          } else {
            setError("Something went wrong. Please try again.");
          }
          return;
        }
        
        const data = await response.json();
        console.log(`[Funnel] Artist profile loaded:`, data.displayName);
        setArtistProfile(data);
        
      } catch (err) {
        console.error("[Funnel] Init error:", err);
        setError("Failed to load. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    initFunnel();
  }, [artistSlug]);

  // Handle form submission
  const handleSubmit = async () => {
    if (!artistProfile) {
      console.error('[Funnel] No artist profile');
      return;
    }
    
    console.log('[Funnel] Starting submission...');
    setSubmitting(true);
    
    const submitData = {
      artistId: artistProfile.id,
      sessionId,
      intent: {
        projectType,
        projectDescription,
      },
      contact: {
        name,
        email,
        phone: phone || undefined,
      },
      style: {
        stylePreferences: selectedStyles,
        referenceImages: [],
      },
      budget: {
        placement: projectType,
        estimatedSize: '',
        budgetMin: selectedBudget?.min || 0,
        budgetMax: selectedBudget?.max || 0,
        budgetLabel: selectedBudget?.label || '',
      },
      availability: {
        preferredTimeframe: timeframe,
        preferredMonths: [],
        urgency: 'flexible',
      },
    };
    
    console.log('[Funnel] Submit data:', JSON.stringify(submitData, null, 2));
    
    try {
      const response = await fetch('/api/public/funnel/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });
      
      console.log('[Funnel] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Funnel] Submit error response:', errorText);
        throw new Error(`Failed to submit: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('[Funnel] Submit success:', result);
      
      setSubmitted(true);
      sessionStorage.removeItem(`funnel_session_${artistSlug}`);
      
      // Show install prompt after a short delay on success
      setTimeout(() => {
        setShowInstallPrompt(true);
        console.log('[Funnel] Showing install prompt after successful submission');
      }, 1500);
      
    } catch (err) {
      console.error("[Funnel] Submit error:", err);
      alert("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Validation for each step
  const canProceed = () => {
    switch (currentStep) {
      case 0: // Intent
        return projectType && projectDescription.trim().length >= 10;
      case 1: // Contact
        return name.trim() && email.trim() && email.includes('@');
      case 2: // Style
        return selectedStyles.length > 0;
      case 3: // Budget
        return selectedBudget !== null;
      case 4: // Availability
        return timeframe;
      default:
        return false;
    }
  };

  // Next step
  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  // Previous step
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Toggle style selection
  const toggleStyle = (style: string) => {
    setSelectedStyles(prev => 
      prev.includes(style) 
        ? prev.filter(s => s !== style)
        : [...prev, style]
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-2">Loading...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !artistProfile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Not Available
          </h1>
          <p className="text-gray-600 mb-6">
            {error || "This booking link is not available."}
          </p>
          <p className="text-sm text-gray-500">
            Please contact the artist directly if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Request Submitted!
          </h1>
          <p className="text-gray-600 mb-6">
            Thank you for your interest. {artistProfile.displayName} will review your request and get back to you soon.
          </p>
          <p className="text-sm text-gray-500">
            Check your email for confirmation.
          </p>
        </div>
        
        {/* Show install prompt ONLY after successful submission */}
        {showInstallPrompt && (
          <IOSInstallPrompt 
            forceShow={true} 
            onDismiss={() => setShowInstallPrompt(false)} 
          />
        )}
      </div>
    );
  }

  // Step titles
  const stepTitles = [
    "What are you looking for?",
    "Your contact details",
    "Style preferences",
    "Your budget",
    "When would you like to get tattooed?"
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
        <div className="h-1 bg-gray-100">
          <div 
            className="h-full bg-gray-900 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <span className="text-sm font-medium text-gray-900">
            {artistProfile.displayName}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-6 max-w-lg mx-auto">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">
          {stepTitles[currentStep]}
        </h2>

        {/* Step 0: Intent */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Project type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PROJECT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setProjectType(type.id)}
                    className={`p-3 text-left rounded-lg border transition-colors ${
                      projectType === type.id
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-900">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Describe your idea
              </label>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Tell us about your vision..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none text-gray-900 bg-white placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 mt-1">
                {projectDescription.length < 10 
                  ? `At least ${10 - projectDescription.length} more characters`
                  : 'Great!'
                }
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Contact */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 bg-white placeholder-gray-400"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 bg-white placeholder-gray-400"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone (optional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Your phone number"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 bg-white placeholder-gray-400"
              />
            </div>
          </div>
        )}

        {/* Step 2: Style */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Select all styles you're interested in
            </p>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map((style) => (
                <button
                  key={style}
                  onClick={() => toggleStyle(style)}
                  className={`px-4 py-2 rounded-full border transition-colors ${
                    selectedStyles.includes(style)
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Budget */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              What's your budget for this project?
            </p>
            <div className="space-y-2">
              {BUDGET_RANGES.map((budget) => (
                <button
                  key={budget.label}
                  onClick={() => setSelectedBudget(budget)}
                  className={`w-full p-4 text-left rounded-lg border transition-colors ${
                    selectedBudget?.label === budget.label
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium text-gray-900">{budget.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Availability */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              When are you hoping to get started?
            </p>
            <div className="space-y-2">
              {TIMEFRAME_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setTimeframe(option.id)}
                  className={`w-full p-4 text-left rounded-lg border transition-colors ${
                    timeframe === option.id
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium text-gray-900">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
        <div className="max-w-lg mx-auto flex gap-3">
          {currentStep > 0 && (
            <button
              onClick={handleBack}
              disabled={submitting}
              className="flex-1 py-3 px-6 border border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed() || submitting}
            className={`${currentStep === 0 ? 'w-full' : 'flex-1'} py-3 px-6 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {submitting 
              ? 'Submitting...' 
              : currentStep === totalSteps - 1 
                ? 'Submit Request' 
                : 'Continue'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
