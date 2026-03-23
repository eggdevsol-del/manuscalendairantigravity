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
  STEP_TITLES,
} from "./constants";
import IOSInstallPrompt from "@/components/IOSInstallPrompt";
import ImageUploadSheet, { UploadedImage } from "./components/ImageUploadSheet";
import { Camera, Image as ImageIcon, ChevronRight, Check } from "lucide-react";
import { TeaserRegistrationForm } from "@/components/auth/TeaserRegistrationForm";
import FunnelContactStep from "./steps/FunnelContactStep";

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
    city?: string;
    country?: string;
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
    urgency: "flexible" | "moderate" | "urgent";
  };
}

export interface ArtistProfile {
  id: string;
  slug: string;
  displayName: string;
  tagline?: string;
  theme: "light" | "dark";
  bannerUrl: string | null;
  profileImageUrl?: string;
  coverImageUrl?: string;
  styleOptions: string[];
  placementOptions: string[];
  budgetRanges: { label: string; min: number; max: number | null }[];
  services?: any[];
  enabledSteps: string[];
}

interface FunnelWrapperProps {
  artistSlug: string;
}

export default function FunnelWrapper({ artistSlug }: FunnelWrapperProps) {
  const {
    loading,
    error,
    artistProfile,
    currentStep,
    totalSteps,
    submitting,
    submitted,
    showInstallPrompt,
    setShowInstallPrompt,
    projectType,
    setProjectType,
    projectDescription,
    setProjectDescription,
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
    selectedStyles,
    toggleStyle,
    referenceImages,
    setReferenceImages,
    showReferenceUpload,
    setShowReferenceUpload,
    bodyPlacementImages,
    setBodyPlacementImages,
    showBodyPlacementUpload,
    setShowBodyPlacementUpload,
    selectedBudget,
    setSelectedBudget,
    timeframe,
    setTimeframe,
    handleNext,
    handleBack,
    canProceed,
  } = useFunnelController(artistSlug);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-muted-foreground mb-2">Loading...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !artistProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Not Available
          </h1>
          <p className="text-muted-foreground mb-6">
            {error || "This booking link is not available."}
          </p>
          <p className="text-sm text-muted-foreground/50">
            Please contact the artist directly if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  const availableServices = (artistProfile?.services || [])
    .filter((s: any) => s.showInFunnel !== false)
    .map((s: any) => ({
      id: s.name,
      label: s.name,
      price: s.price,
      duration: s.duration,
      sittings: s.sittings,
    }));

  // Success state (Teaser Registration)
  if (submitted) {
    return (
      <div className={artistProfile.theme === "dark" ? "dark" : ""}>
        <div className="min-h-[100dvh] w-full flex flex-col bg-background font-sans">
          <div className="flex-1 flex items-center justify-center p-4">
            <TeaserRegistrationForm
              email={email}
              name={`${firstName} ${lastName}`.trim()}
              artistId={artistProfile.id}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={artistProfile.theme === "dark" ? "dark" : ""}>
      <div className="min-h-[100dvh] w-full flex flex-col bg-background font-sans relative">
        {/* Banner Image */}
        {artistProfile.bannerUrl && (
          <div className="absolute top-0 left-0 w-full h-[200px] sm:h-[240px] pointer-events-none z-0">
            <div
              className="w-full h-full bg-cover bg-center bg-no-repeat transition-opacity"
              style={{
                backgroundImage: `url(${artistProfile.bannerUrl})`,
                maskImage: "linear-gradient(to right, black 0%, transparent 75%)",
                WebkitMaskImage: "linear-gradient(to right, black 0%, transparent 75%)",
              }}
            />
          </div>
        )}

        {/* Header Profile Section */}
        <div className="relative z-10 w-full pt-12 pb-6 px-4 shrink-0 border-b border-border/50" style={{ transform: 'translate(0px, -24px)' }}>
          <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border" style={{ transform: 'translate(0px, -18px)', height: '89px' }}>
            <div className="h-1 bg-white/5" />
            <div className="px-4 py-3 flex items-center justify-between" style={{ transform: 'translate(0px, 39px)' }}>
              <span className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {totalSteps}
              </span>
              <span className="text-sm font-medium text-foreground">
                {artistProfile.displayName}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="pt-20 pb-32 px-6 max-w-lg mx-auto relative z-10" style={{ width: '337.453125px', transform: 'translate(0px, 110px)', borderRadius: '6px' }}>
          <h2 className="text-2xl font-semibold text-foreground mb-6" style={{ transform: currentStep === 1 ? 'translate(32px, -52px)' : 'translate(0px, -52px)' }}>
            {STEP_TITLES[currentStep]}
          </h2>

          {/* Step 0: Intent */}
          {currentStep === 0 && (
            <div className="space-y-6" style={{ transform: 'translate(0px, -61px)' }}>
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Select a Service
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {availableServices.length > 0 ? (
                    availableServices.map((service: any) => (
                      <button
                        key={service.id}
                        onClick={() => setProjectType(service.id)}
                        className={`relative p-4 rounded-[6px] border-2 text-left transition-all flex flex-col gap-1 ${projectType === service.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:border-primary/50"
                          }`}
                        style={{ height: '56.5px' }}
                      >
                        <div className="flex justify-between items-start w-full pr-8">
                          <span className="font-semibold text-foreground text-sm">
                            {service.label}
                          </span>
                        </div>
                        {projectType === service.id && (
                          <div className="absolute top-1/2 -translate-y-1/2 right-4 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="p-6 border border-dashed border-border rounded-[4px] text-center text-sm text-muted-foreground">
                      This artist has not listed any public services yet.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Describe your idea
                </label>
                <textarea
                  value={projectDescription}
                  onChange={e => setProjectDescription(e.target.value)}
                  placeholder="Tell us about your vision..."
                  rows={4}
                  className="w-full px-4 py-3 border border-border rounded-[4px] focus:outline-none focus:ring-2 focus:ring-foreground focus:border-transparent resize-none text-foreground bg-background placeholder-muted-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {projectDescription.length < 10
                    ? `At least ${10 - projectDescription.length} more characters`
                    : "Great!"}
                </p>
              </div>
            </div>
          )}

          {/* Step 1: Contact — rendered by FunnelContactStep (single source of truth) */}
          {currentStep === 1 && (
            <FunnelContactStep
              artistProfile={artistProfile}
              stepData={{
                contact: { firstName, lastName, birthdate, email, phone, city, country },
              }}
              onNext={(_step: string, data: any) => {
                if (data) {
                  setFirstName(data.firstName || "");
                  setLastName(data.lastName || "");
                  setBirthdate(data.birthdate || "");
                  setEmail(data.email || "");
                  setPhone(data.phone || "");
                  setCity(data.city || "");
                  setCountry(data.country || "");
                }
                handleNext();
              }}
              onBack={handleBack}
              isFirstStep={false}
              isLastStep={false}
              submitting={submitting}
            />
          )}

          {/* Step 2: Style + Reference Images */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  Select all styles you're interested in
                </p>
                <div className="flex flex-wrap gap-2">
                  {STYLE_OPTIONS.map(style => (
                    <button
                      key={style}
                      onClick={() => toggleStyle(style)}
                      className={`px-4 py-2 rounded-full border transition-colors ${selectedStyles.includes(style)
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-foreground hover:border-foreground/30"
                        }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference Images Upload Button */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Reference images (optional)
                </label>
                <button
                  type="button"
                  onClick={() => setShowReferenceUpload(true)}
                  className="w-full p-4 border border-border rounded-[4px] hover:border-foreground/30 transition-colors flex items-center justify-between bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 rounded-[4px] flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">
                        {referenceImages.length > 0
                          ? `${referenceImages.length} image${referenceImages.length > 1 ? "s" : ""} added`
                          : "Add reference images"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tattoos, artwork, or inspiration
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>

                {/* Preview thumbnails */}
                {referenceImages.length > 0 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                    {referenceImages.slice(0, 4).map(img => (
                      <div
                        key={img.id}
                        className="w-16 h-16 rounded-[4px] overflow-hidden flex-shrink-0 border border-border/50"
                      >
                        <img
                          src={img.preview}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                    {referenceImages.length > 4 && (
                      <div className="w-16 h-16 rounded-[4px] bg-white/10 flex items-center justify-center flex-shrink-0 border border-border/50">
                        <span className="text-sm font-medium text-muted-foreground">
                          +{referenceImages.length - 4}
                        </span>
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
              <p className="text-sm text-muted-foreground">
                Upload photos of the body area where you'd like the tattoo. This
                helps the artist understand the placement and size better.
              </p>

              <button
                type="button"
                onClick={() => setShowBodyPlacementUpload(true)}
                className="w-full p-6 border-2 border-dashed border-border rounded-[4px] hover:border-foreground/40 transition-colors flex flex-col items-center justify-center gap-3 bg-white/5"
              >
                <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center">
                  <Camera className="w-7 h-7 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    {bodyPlacementImages.length > 0
                      ? `${bodyPlacementImages.length} photo${bodyPlacementImages.length > 1 ? "s" : ""} added`
                      : "Add body placement photos"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Take or upload photos of the area
                  </p>
                </div>
              </button>

              {/* Preview thumbnails */}
              {bodyPlacementImages.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {bodyPlacementImages.map(img => (
                    <div
                      key={img.id}
                      className="aspect-square rounded-[4px] overflow-hidden border border-border/50"
                    >
                      <img
                        src={img.preview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                This step is optional but highly recommended
              </p>
            </div>
          )}

          {/* Step 4: Budget */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                What's your budget for this project?
              </p>
              <div className="space-y-2">
                {BUDGET_RANGES.map(budget => (
                  <button
                    key={budget.label}
                    onClick={() => setSelectedBudget(budget)}
                    className={`w-full p-4 text-left rounded-[4px] border transition-colors ${selectedBudget?.label === budget.label
                      ? "border-foreground bg-white/10"
                      : "border-border hover:border-foreground/30 bg-white/5"
                      }`}
                  >
                    <span className="font-medium text-foreground">
                      {budget.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Availability */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                When are you hoping to get started?
              </p>
              <div className="space-y-2">
                {TIMEFRAME_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    onClick={() => setTimeframe(option.id)}
                    className={`w-full p-4 text-left rounded-[4px] border transition-colors ${timeframe === option.id
                      ? "border-foreground bg-white/10"
                      : "border-border hover:border-foreground/30 bg-white/5"
                      }`}
                  >
                    <span className="font-medium text-foreground">
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t border-border p-4 z-50">
          <div className="max-w-lg mx-auto flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                disabled={submitting}
                className="flex-1 py-3 px-6 border border-border rounded-[4px] font-medium text-foreground hover:bg-white/10 disabled:opacity-50"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canProceed() || submitting}
              className={`${currentStep === 0 ? "w-full" : "flex-1"} py-3 px-6 bg-primary text-primary-foreground rounded-[4px] font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {submitting
                ? "Submitting..."
                : currentStep === totalSteps - 1
                  ? "Submit Request"
                  : currentStep === 3 && bodyPlacementImages.length === 0
                    ? "Skip for now"
                    : "Continue"}
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
        {
          showInstallPrompt && (
            <IOSInstallPrompt
              forceShow={showInstallPrompt}
              onDismiss={() => setShowInstallPrompt(false)}
            />
          )
        }
      </div>
    </div>
  );
}
