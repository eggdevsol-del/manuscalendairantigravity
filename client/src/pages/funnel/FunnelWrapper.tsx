/**
 * Funnel Wrapper Component
 * 
 * Simple, clean light-mode consultation funnel.
 * Includes expanded contact fields and image upload capabilities.
 */
import { useFunnelController } from "./hooks/useFunnelController";
import {
  PROJECT_TYPES,
  STYLE_OPTIONS,
  BUDGET_RANGES,
  TIMEFRAME_OPTIONS,
  STEP_TITLES
} from "./constants";
import IOSInstallPrompt from "@/components/IOSInstallPrompt";
import ImageUploadSheet, { UploadedImage } from "./components/ImageUploadSheet";
import { Camera, Image as ImageIcon, ChevronRight } from "lucide-react";
import { TeaserRegistrationForm } from "@/components/auth/TeaserRegistrationForm";

export interface FunnelStepData {
  intent?: {
    projectType: string;
    projectDescription: string;
  };
  contact?: {
    firstName: string;
    lastName: string;
    birthdate: string;
    email: string;
    phone?: string;
  };
  style?: {
    stylePreferences: string[];
    referenceImages: string[];
  };
  bodyPlacement?: {
    placementImages: string[];
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

export default function FunnelWrapper({ artistSlug }: FunnelWrapperProps) {
  const {
    loading, error, artistProfile, currentStep, totalSteps,
    submitting, submitted, showInstallPrompt, setShowInstallPrompt,
    projectType, setProjectType, projectDescription, setProjectDescription,
    firstName, setFirstName, lastName, setLastName, birthdate, setBirthdate,
    email, setEmail, phone, setPhone,
    selectedStyles, toggleStyle,
    referenceImages, setReferenceImages, showReferenceUpload, setShowReferenceUpload,
    bodyPlacementImages, setBodyPlacementImages, showBodyPlacementUpload, setShowBodyPlacementUpload,
    selectedBudget, setSelectedBudget, timeframe, setTimeframe,
    handleNext, handleBack, canProceed
  } = useFunnelController(artistSlug);

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

  // Success state (Teaser Registration)
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <TeaserRegistrationForm
          email={email}
          name={`${firstName} ${lastName}`.trim()}
          artistName={artistProfile.displayName}
        />
      </div>
    );
  }


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
          {STEP_TITLES[currentStep]}
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
                    className={`p-3 text-left rounded-lg border transition-colors ${projectType === type.id
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

        {/* Step 1: Contact (Expanded) */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First name *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 bg-white placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last name *
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 bg-white placeholder-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date of birth *
              </label>
              <input
                type="date"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                You must be 18 or older to book a tattoo
              </p>
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
                Phone number
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

        {/* Step 2: Style + Reference Images */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Select all styles you're interested in
              </p>
              <div className="flex flex-wrap gap-2">
                {STYLE_OPTIONS.map((style) => (
                  <button
                    key={style}
                    onClick={() => toggleStyle(style)}
                    className={`px-4 py-2 rounded-full border transition-colors ${selectedStyles.includes(style)
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference Images Upload Button */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference images (optional)
              </label>
              <button
                type="button"
                onClick={() => setShowReferenceUpload(true)}
                className="w-full p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">
                      {referenceImages.length > 0
                        ? `${referenceImages.length} image${referenceImages.length > 1 ? 's' : ''} added`
                        : 'Add reference images'
                      }
                    </p>
                    <p className="text-xs text-gray-500">
                      Tattoos, artwork, or inspiration
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>

              {/* Preview thumbnails */}
              {referenceImages.length > 0 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                  {referenceImages.slice(0, 4).map((img) => (
                    <div key={img.id} className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {referenceImages.length > 4 && (
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-gray-600">+{referenceImages.length - 4}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Body Placement */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <p className="text-sm text-gray-600">
              Upload photos of the body area where you'd like the tattoo. This helps the artist understand the placement and size better.
            </p>

            <button
              type="button"
              onClick={() => setShowBodyPlacementUpload(true)}
              className="w-full p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 transition-colors flex flex-col items-center justify-center gap-3"
            >
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                <Camera className="w-7 h-7 text-gray-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900">
                  {bodyPlacementImages.length > 0
                    ? `${bodyPlacementImages.length} photo${bodyPlacementImages.length > 1 ? 's' : ''} added`
                    : 'Add body placement photos'
                  }
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Take or upload photos of the area
                </p>
              </div>
            </button>

            {/* Preview thumbnails */}
            {bodyPlacementImages.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {bodyPlacementImages.map((img) => (
                  <div key={img.id} className="aspect-square rounded-lg overflow-hidden">
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500 text-center">
              This step is optional but highly recommended
            </p>
          </div>
        )}

        {/* Step 4: Budget */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              What's your budget for this project?
            </p>
            <div className="space-y-2">
              {BUDGET_RANGES.map((budget) => (
                <button
                  key={budget.label}
                  onClick={() => setSelectedBudget(budget)}
                  className={`w-full p-4 text-left rounded-lg border transition-colors ${selectedBudget?.label === budget.label
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

        {/* Step 5: Availability */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              When are you hoping to get started?
            </p>
            <div className="space-y-2">
              {TIMEFRAME_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setTimeframe(option.id)}
                  className={`w-full p-4 text-left rounded-lg border transition-colors ${timeframe === option.id
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
                : currentStep === 3 && bodyPlacementImages.length === 0
                  ? 'Skip for now'
                  : 'Continue'
            }
          </button>
        </div>
      </div>

      {/* Reference Images Upload Sheet */}
      <ImageUploadSheet
        isOpen={showReferenceUpload}
        onClose={() => setShowReferenceUpload(false)}
        onImagesChange={setReferenceImages}
        images={referenceImages}
        title="Reference Images"
        description="Add tattoos or artwork for inspiration"
      />

      {/* Body Placement Upload Sheet */}
      <ImageUploadSheet
        isOpen={showBodyPlacementUpload}
        onClose={() => setShowBodyPlacementUpload(false)}
        onImagesChange={setBodyPlacementImages}
        images={bodyPlacementImages}
        title="Placement Photos"
        description="Show us where the tattoo will go"
      />

      {/* IOS Install Prompt */}
      {showInstallPrompt && (
        <IOSInstallPrompt
          forceShow={showInstallPrompt}
          onDismiss={() => setShowInstallPrompt(false)}
        />
      )}
    </div>
  );
}
